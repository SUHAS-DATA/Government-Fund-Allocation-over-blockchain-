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

TEST_PID = "PRJ-SYNC-TEST-001"

@pytest.fixture(autouse=True)
def cleanup():
    db.projects.delete_many({"project_id": TEST_PID})
    db.milestones.delete_many({"project_id": TEST_PID})
    db.evidence.delete_many({"project_id": TEST_PID})
    yield
    db.projects.delete_many({"project_id": TEST_PID})
    db.milestones.delete_many({"project_id": TEST_PID})
    db.evidence.delete_many({"project_id": TEST_PID})

def test_contractor_proof_submission_updates_district_portal():
    contractor_id = "CON-SYNC-001"
    contractor_token = generate_token(
        user_id="usr_contractor_sync",
        email="contractor.sync@test.gov",
        role="CONTRACTOR",
        name="Belagavi Civil Works Ltd",
        state_code="KA",
        district_name="Belagavi",
        officer_id=contractor_id
    )
    district_token = generate_token(
        user_id="usr_district_officer",
        email="district.officer@test.gov",
        role="DISTRICT",
        name="District Officer Belagavi",
        state_code="KA",
        district_name="Belagavi",
        officer_id="DIST-BEL-001"
    )

    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}
    district_headers = {"Authorization": f"Bearer {district_token}"}

    # 1. Setup Project & Milestone
    now = datetime.now(timezone.utc)
    db.projects.insert_one({
        "project_id": TEST_PID,
        "name": "Belagavi Rural Canal Upgrade",
        "scheme_name": "PMGSY",
        "department": "Rural Development",
        "district_name": "Belagavi",
        "state_code": "KA",
        "state_name": "Karnataka",
        "assigned_contractor_id": contractor_id,
        "assigned_contractor_name": "Belagavi Civil Works Ltd",
        "contractor_id": contractor_id,
        "contractor_name": "Belagavi Civil Works Ltd",
        "total_budget": 5000000.0,
        "status": "IN_PROGRESS",
        "financial_year": "2026-27",
        "created_at": now
    })

    db.milestones.insert_one({
        "project_id": TEST_PID,
        "milestone_id": f"MS-{TEST_PID}-1",
        "milestone_index": 0,
        "title": "Excavation and Lining",
        "amount": 1500000.0,
        "status": "IN_PROGRESS",
        "phase_status": "IN_PROGRESS",
        "fund_status": "RELEASED",
        "created_at": now
    })

    # 2. Before submission: district/projects has_pending_proof is False
    res_before = client.get("/api/district/projects", headers=district_headers).json()
    assert res_before["success"] is True
    proj_before = next((p for p in res_before["projects"] if p["project_id"] == TEST_PID), None)
    assert proj_before is not None
    assert proj_before.get("has_pending_proof") is False

    # 3. Contractor submits milestone proof
    submit_payload = {
        "work_completion_notes": "Completed canal earth excavation 1.2km and slope concrete lining according to engineering spec.",
        "site_geotag": "15.8497 N, 74.4977 E",
        "material_bills_notes": "INV-2026-881 for 400 metric tonnes M25 cement and aggregate mix",
        "photo_count": 8,
        "video_url": "https://inspection-storage.gov.in/videos/belagavi-canal-phase1.mp4",
        "lab_test_report": "Compressive cube strength 28.4 N/mm2 passed IS 456-2000 specification"
    }
    submit_res = client.post(f"/api/contractor/projects/{TEST_PID}/phases/0/submit-milestone", json=submit_payload, headers=contractor_headers).json()
    assert submit_res["success"] is True
    assert "proof_document_hash" in submit_res

    # 4. Check district/projects: project must immediately show has_pending_proof: True & milestones attached
    res_after = client.get("/api/district/projects", headers=district_headers).json()
    assert res_after["success"] is True
    proj_after = next((p for p in res_after["projects"] if p["project_id"] == TEST_PID), None)
    assert proj_after is not None
    assert proj_after["has_pending_proof"] is True
    assert len(proj_after["milestones"]) == 1
    assert proj_after["milestones"][0]["status"] == "SUBMITTED"
    assert proj_after["milestones"][0]["phase_status"] == "SUBMITTED_FOR_VERIFICATION"
    assert "INV-2026-881" in proj_after["milestones"][0]["material_bills_notes"]

    # 5. Check district/dashboard: pending_milestones count >= 1 and pending_verifications includes TEST_PID
    res_dash = client.get("/api/district/dashboard?district=Belagavi", headers=district_headers).json()
    assert res_dash["success"] is True
    assert res_dash["metrics"]["pending_milestones"] >= 1
    pending_items = [v for v in res_dash.get("pending_verifications", []) if v["project_id"] == TEST_PID]
    assert len(pending_items) == 1
    assert pending_items[0]["stage"] == "Excavation and Lining"
    assert pending_items[0]["amount"] == 1500000.0

    # 6. Check single project details endpoint
    res_details = client.get(f"/api/district/projects/{TEST_PID}", headers=district_headers).json()
    assert res_details["success"] is True
    assert len(res_details["milestones"]) == 1
    assert res_details["milestones"][0]["status"] == "SUBMITTED"

    # 7. District verifies & approves the proof submission
    res_verify = client.post(f"/api/district/projects/{TEST_PID}/phases/0/verify", json={"action": "APPROVE"}, headers=district_headers).json()
    assert res_verify["success"] is True

    # 8. Check district/projects: has_pending_proof is now False, milestone is COMPLETED
    res_post_approval = client.get("/api/district/projects", headers=district_headers).json()
    proj_final = next((p for p in res_post_approval["projects"] if p["project_id"] == TEST_PID), None)
    assert proj_final["has_pending_proof"] is False
    assert proj_final["milestones"][0]["status"] == "COMPLETED"
