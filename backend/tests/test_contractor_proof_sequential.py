import os
import sys
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token

client = TestClient(app)

TEST_PID = "PRJ-SEQ-TEST-999"

@pytest.fixture(autouse=True)
def cleanup():
    db.projects.delete_many({"project_id": TEST_PID})
    db.milestones.delete_many({"project_id": TEST_PID})
    db.evidence.delete_many({"project_id": TEST_PID})
    yield
    db.projects.delete_many({"project_id": TEST_PID})
    db.milestones.delete_many({"project_id": TEST_PID})
    db.evidence.delete_many({"project_id": TEST_PID})

def test_phase2_submission_allowed_when_phase1_is_completed():
    contractor_id = "CON-SEQ-001"
    contractor_token = generate_token(
        user_id="usr_contractor_seq",
        email="contractor.seq@test.gov",
        role="CONTRACTOR",
        name="Karnataka Infra Corp",
        state_code="KA",
        district_name="Bengaluru Urban",
        officer_id=contractor_id
    )
    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}

    # Setup Project
    db.projects.insert_one({
        "project_id": TEST_PID,
        "name": "Bengaluru Urban PMAY Housing",
        "scheme_name": "PMAY",
        "department": "Housing",
        "district_name": "Bengaluru Urban",
        "state_code": "KA",
        "state_name": "Karnataka",
        "total_budget": 10000000.0,
        "contractor_id": contractor_id,
        "contractor_name": "Karnataka Infra Corp",
        "contract_id": f"CTR-{TEST_PID}",
        "assignment_status": "ACCEPTED",
        "contract_status": "ACCEPTED",
        "status": "IN_PROGRESS",
        "financial_year": "2026-27"
    })

    # Setup Phase 1 (Completed) and Phase 2 (Approved for work)
    now = datetime.now(timezone.utc)
    db.milestones.insert_one({
        "project_id": TEST_PID,
        "milestone_index": 0,
        "title": "Phase 1: Foundation",
        "percentage_share": 30,
        "amount": 3000000.0,
        "status": "COMPLETED",
        "phase_status": "COMPLETED",
        "evidence_status": "VERIFIED",
        "completed_at": now
    })

    db.milestones.insert_one({
        "project_id": TEST_PID,
        "milestone_index": 1,
        "title": "Phase 2: Superstructure",
        "percentage_share": 40,
        "amount": 4000000.0,
        "status": "APPROVED_FOR_WORK",
        "phase_status": "EXECUTING_WORK",
        "evidence_status": "PENDING"
    })

    # Submit Phase 2 completion proof
    payload = {
        "milestone_index": 1,
        "percentage": 100,
        "notes": "Phase #2 execution complete according to DPR specifications.",
        "material_bills_notes": "Invoices: Cement (500 Bags), Steel TMT (12 MT)",
        "video_url": "https://drive.google.com/site-video-proof"
    }

    res = client.post(
        f"/api/contractor/projects/{TEST_PID}/phases/1/submit-milestone",
        json=payload,
        headers=contractor_headers
    )
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    body = res.json()
    assert body.get("success") is True

    # Verify Phase 2 status in MongoDB
    m2 = db.milestones.find_one({"project_id": TEST_PID, "milestone_index": 1})
    assert m2["status"] == "SUBMITTED"
    assert m2["phase_status"] == "SUBMITTED_FOR_VERIFICATION"
    assert m2["video_url"] == "https://drive.google.com/site-video-proof"
