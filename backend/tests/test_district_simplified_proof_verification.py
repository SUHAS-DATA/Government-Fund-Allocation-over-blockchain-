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

TEST_PID = "PRJ-SIMPLIFIED-TEST-001"
TEST_PID_FROZEN = "PRJ-SIMPLIFIED-FROZEN-002"

@pytest.fixture(autouse=True)
def cleanup():
    db.projects.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.milestones.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.evidence.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.documents.delete_many({"entity_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.notifications.delete_many({"recipient_user_id": "CON-SIMPLIFIED-001"})
    db.audit_logs.delete_many({"target_id": {"$regex": f"^{TEST_PID}"}})
    yield
    db.projects.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.milestones.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.evidence.delete_many({"project_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.documents.delete_many({"entity_id": {"$in": [TEST_PID, TEST_PID_FROZEN]}})
    db.notifications.delete_many({"recipient_user_id": "CON-SIMPLIFIED-001"})
    db.audit_logs.delete_many({"target_id": {"$regex": f"^{TEST_PID}"}})


def create_test_project_and_tokens():
    contractor_id = "CON-SIMPLIFIED-001"
    contractor_token = generate_token(
        user_id="usr_con_simplified",
        email="contractor@test.gov",
        role="CONTRACTOR",
        name="Apex Infrastructure Ltd",
        state_code="KA",
        district_name="Belagavi",
        officer_id=contractor_id
    )
    district_token = generate_token(
        user_id="usr_dist_simplified",
        email="district.belagavi@test.gov",
        role="DISTRICT",
        name="District Officer Belagavi",
        state_code="KA",
        district_name="Belagavi",
        officer_id="DIST-BEL-001"
    )
    wrong_district_token = generate_token(
        user_id="usr_dist_other",
        email="district.mysuru@test.gov",
        role="DISTRICT",
        name="District Officer Mysuru",
        state_code="KA",
        district_name="Mysuru",
        officer_id="DIST-MYS-001"
    )

    now = datetime.now(timezone.utc)
    db.projects.insert_one({
        "project_id": TEST_PID,
        "name": "Belagavi Ring Road Phase 1",
        "scheme_name": "PMGSY",
        "department": "Public Works Department",
        "district_name": "Belagavi",
        "state_code": "KA",
        "state_name": "Karnataka",
        "assigned_contractor_id": contractor_id,
        "assigned_contractor_name": "Apex Infrastructure Ltd",
        "contractor_id": contractor_id,
        "contractor_name": "Apex Infrastructure Ltd",
        "total_budget": 9000000.0,
        "status": "IN_PROGRESS",
        "is_frozen": False,
        "financial_year": "2026-27",
        "created_at": now
    })

    db.milestones.insert_many([
        {
            "project_id": TEST_PID,
            "milestone_id": f"MS-{TEST_PID}-1",
            "milestone_index": 0,
            "title": "Sub-grade & Earthworks",
            "amount": 3000000.0,
            "status": "SUBMITTED",
            "phase_status": "SUBMITTED_FOR_VERIFICATION",
            "evidence_status": "SUBMITTED",
            "fund_status": "RELEASED",
            "proof_document_hash": "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
            "created_at": now
        },
        {
            "project_id": TEST_PID,
            "milestone_id": f"MS-{TEST_PID}-2",
            "milestone_index": 1,
            "title": "Dense Bituminous Macadam",
            "amount": 3000000.0,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "fund_status": "UNFUNDED",
            "created_at": now
        },
        {
            "project_id": TEST_PID,
            "milestone_id": f"MS-{TEST_PID}-3",
            "milestone_index": 2,
            "title": "Asphalt Concrete Wearing Surface",
            "amount": 3000000.0,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "fund_status": "UNFUNDED",
            "created_at": now
        }
    ])

    # Insert test evidence and documents
    doc_id = f"DOC-{TEST_PID}-001"
    db.evidence.insert_one({
        "evidence_id": doc_id,
        "evidenceId": doc_id,
        "project_id": TEST_PID,
        "projectId": TEST_PID,
        "milestone_index": 0,
        "milestone_id": f"MS-{TEST_PID}-1",
        "milestoneId": f"MS-{TEST_PID}-1",
        "contractor_id": contractor_id,
        "contractor_name": "Apex Infrastructure Ltd",
        "file_name": "belagavi_earthworks_quality_test.pdf",
        "file_type": "application/pdf",
        "sha256_hash": "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
        "status": "SUBMITTED",
        "description": "Sub-grade compaction density test report",
        "uploaded_at": now
    })

    db.documents.insert_one({
        "document_id": doc_id,
        "file_name": "belagavi_earthworks_quality_test.pdf",
        "sha256_hash": "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
        "doc_type": "QUALITY_TEST_CERTIFICATE",
        "entity_id": TEST_PID,
        "milestone_index": 0,
        "contractor_id": contractor_id,
        "uploaded_at": now
    })

    return contractor_token, district_token, wrong_district_token


def test_district_single_click_proof_verified_success():
    """District Officer clicking Proof Verified once approves milestone directly and updates evidence and documents."""
    _, district_token, _ = create_test_project_and_tokens()
    headers = {"Authorization": f"Bearer {district_token}"}

    # 1. District Officer submits approval in a single click
    res = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "verified and approved successfully" in body["message"]
    assert body["next_phase_unlocked"] is True

    # 2. Check milestone in database
    m1 = db.milestones.find_one({"project_id": TEST_PID, "milestone_index": 0})
    assert m1["status"] == "COMPLETED"
    assert m1["phase_status"] == "COMPLETED"
    assert m1["evidence_status"] == "VERIFIED"
    assert m1["progress_percentage"] == 100
    assert m1["verified_by"] == "District Officer Belagavi"
    assert m1["completed_at"] is not None

    # 3. Check next milestone is unlocked
    m2 = db.milestones.find_one({"project_id": TEST_PID, "milestone_index": 1})
    assert m2["status"] == "UNLOCKED"
    assert m2["phase_status"] == "READY_FOR_FUND_REQUEST"

    # 4. Check evidence is marked VERIFIED
    ev = db.evidence.find_one({"project_id": TEST_PID, "milestone_index": 0})
    assert ev["status"] == "VERIFIED"
    assert ev["verified_by"] == "District Officer Belagavi"
    assert ev["verified_at"] is not None

    # 5. Check document is marked VERIFIED
    doc = db.documents.find_one({"entity_id": TEST_PID, "milestone_index": 0})
    assert doc["status"] == "VERIFIED"
    assert doc["verified_by"] == "District Officer Belagavi"

    # 6. Check audit log is written
    audit = db.audit_logs.find_one({
        "target_id": f"{TEST_PID}-PHASE-1",
        "event_type": "MILESTONE_PROOF_VERIFICATION",
        "action": "APPROVE"
    })
    assert audit is not None
    assert audit["actor_name"] == "District Officer Belagavi"
    assert audit["status"] == "SUCCESS"

    # 7. Check notification sent to contractor
    notif = db.notifications.find_one({"recipient_user_id": "CON-SIMPLIFIED-001"})
    assert notif is not None
    assert "Completed & Verified" in notif["title"]


def test_district_reject_work_proof_workflow():
    """District Officer can reject milestone work proof with remarks, updating evidence, documents and notifying contractor."""
    _, district_token, _ = create_test_project_and_tokens()
    headers = {"Authorization": f"Bearer {district_token}"}

    rejection_remarks = "Field compaction test failed Proctor density standard (92% achieved vs 98% required)."
    res = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "REJECT", "remarks": rejection_remarks},
        headers=headers
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "rejected" in body["message"].lower()

    # Verify milestone status
    m1 = db.milestones.find_one({"project_id": TEST_PID, "milestone_index": 0})
    assert m1["status"] == "REJECTED_NEEDS_RECTIFICATION"
    assert m1["evidence_status"] == "REJECTED"
    assert m1["rejection_reason"] == rejection_remarks
    assert m1["rejected_by"] == "District Officer Belagavi"

    # Verify evidence status
    ev = db.evidence.find_one({"project_id": TEST_PID, "milestone_index": 0})
    assert ev["status"] == "REJECTED"
    assert ev["rejection_reason"] == rejection_remarks

    # Verify documents status
    doc = db.documents.find_one({"entity_id": TEST_PID, "milestone_index": 0})
    assert doc["status"] == "REJECTED"

    # Verify audit log
    audit = db.audit_logs.find_one({
        "target_id": f"{TEST_PID}-PHASE-1",
        "event_type": "MILESTONE_PROOF_VERIFICATION",
        "action": "REJECT"
    })
    assert audit is not None
    assert audit["action"] == "REJECT"
    assert rejection_remarks in audit["details"]

    # Verify contractor notification
    notif = db.notifications.find_one({"recipient_user_id": "CON-SIMPLIFIED-001"})
    assert notif is not None
    assert "Rejected" in notif["title"]
    assert rejection_remarks in notif["message"]


def test_security_cross_district_and_role_protection():
    """Unauthorized roles and cross-district officers cannot verify work proof."""
    contractor_token, district_token, wrong_district_token = create_test_project_and_tokens()

    # 1. Contractor cannot verify proof
    res_con = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers={"Authorization": f"Bearer {contractor_token}"}
    )
    assert res_con.status_code == 403

    # 2. Officer from Mysuru cannot verify Belagavi project
    res_cross = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers={"Authorization": f"Bearer {wrong_district_token}"}
    )
    assert res_cross.status_code == 403
    assert "Belagavi" in res_cross.json().get("message", "")

    # 3. Unauthenticated request blocked
    res_unauth = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"}
    )
    assert res_unauth.status_code == 401


def test_error_scenarios_frozen_project_and_missing_resources():
    """Proper 403/404 handling for frozen projects, invalid IDs, and idempotent completion."""
    _, district_token, _ = create_test_project_and_tokens()
    headers = {"Authorization": f"Bearer {district_token}"}

    # 1. Non-existent project
    res_404_proj = client.post(
        "/api/district/projects/PRJ-NONEXISTENT-999/phases/0/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res_404_proj.status_code == 404

    # 2. Non-existent milestone index
    res_404_ms = client.post(
        f"/api/district/projects/{TEST_PID}/phases/99/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res_404_ms.status_code == 404

    # 3. Frozen project blocks verification
    db.projects.update_one({"project_id": TEST_PID}, {"$set": {"is_frozen": True}})
    res_frozen = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res_frozen.status_code == 403
    assert "FROZEN" in res_frozen.json().get("message", "")

    # Unfreeze and complete
    db.projects.update_one({"project_id": TEST_PID}, {"$set": {"is_frozen": False}})
    res_ok = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res_ok.status_code == 200

    # 4. Already completed milestone is idempotent
    res_again = client.post(
        f"/api/district/projects/{TEST_PID}/phases/0/verify",
        json={"action": "APPROVE"},
        headers=headers
    )
    assert res_again.status_code == 200
    assert res_again.json().get("is_already_completed") is True
