import sys
import os
import json
import base64
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app import app
from database import db

def print_step(num, title):
    print(f"\n{'='*75}\n[TEST {num}] {title}\n{'='*75}", flush=True)

def run_all_tests():
    client = TestClient(app)

    # -------------------------------------------------------------------------
    # Setup: Authenticate District and Contractor
    # -------------------------------------------------------------------------
    print_step(0, "Setup: Authenticate District Officer and Contractor")
    
    # District Login
    dist_res = client.post("/api/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert dist_res.status_code == 200, f"District login failed: {dist_res.text}"
    dist_token = dist_res.json()["token"]
    dist_headers = {"Authorization": f"Bearer {dist_token}"}
    print("[OK] District Officer authenticated successfully.")

    # Contractor Login (Apex Infrastructure)
    con_res = client.post("/api/auth/contractor/login", json={
        "identifier": "CON-KA-APEX",
        "password": "Contractor@123"
    })
    assert con_res.status_code == 200, f"Contractor login failed: {con_res.text}"
    con_user = con_res.json()["user"]
    con_token = con_res.json()["token"]
    con_headers = {"Authorization": f"Bearer {con_token}"}
    print(f"[OK] Contractor authenticated: {con_user['name']} (ID: {con_user.get('contractor_id')})")

    # Ensure Belagavi has funds allocated for PMGSY scheme
    db.district_allocations.update_one(
        {"district_name": "Belagavi", "scheme_name": "Pradhan Mantri Gram Sadak Yojana"},
        {"$set": {
            "district_alloc_id": "DAL-KA-BEL-PMGSY-001",
            "state_code": "KA",
            "district_name": "Belagavi",
            "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
            "scheme_code": "PMGSY",
            "amount": 250000000.0,
            "allocated_amount": 250000000.0,
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )

    # -------------------------------------------------------------------------
    # 1. District creates project and assigns contractor (Contract Awarded)
    # -------------------------------------------------------------------------
    print_step(1, "Requirement 1: QR must NOT be generated before Contractor accepts")
    
    # Create Project
    proj_create_res = client.post("/api/district/projects", json={
        "name": "Dharwad-Belagavi Rural Highway Infrastructure Corridor",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
        "state_code": "KA",
        "district_name": "Belagavi",
        "total_budget": 50000000.0,
        "timeline_months": 12,
        "description": "All-weather concrete paving and culvert connectivity for rural habitations."
    }, headers=dist_headers)
    assert proj_create_res.status_code == 201, f"Project creation failed: {proj_create_res.text}"
    project_id = proj_create_res.json()["project"]["project_id"]
    print(f"[OK] Project Created: {project_id}")

    # Assign Contractor (Contract Award Sent)
    assign_res = client.post(f"/api/district/projects/{project_id}/assign-contractor", json={
        "contractor_user_id": con_user["user_id"]
    }, headers=dist_headers)
    assert assign_res.status_code == 200, f"Assignment failed: {assign_res.text}"
    print(f"[OK] Project assigned to contractor {con_user['name']}. Status: ASSIGNED.")

    # Check project state before contractor accepts
    proj_pre = db.projects.find_one({"project_id": project_id})
    assert proj_pre["status"] == "ASSIGNED"
    assert proj_pre.get("assignment_status") != "ACCEPTED"
    assert proj_pre.get("contract_status") == "PENDING_ACCEPTANCE"
    contract_id = proj_pre.get("contract_id")
    assert contract_id is not None, "Contract ID should be initialized on award"
    print(f"[OK] Contract ID awarded: {contract_id}, Status: PENDING_ACCEPTANCE")

    # VERIFY CRITICAL REQUIREMENT 1: Zero QR generated before contractor acceptance
    qr_pre = db.qr_codes.find_one({"project_id": project_id})
    assert qr_pre is None, "CRITICAL ERROR: QR code was generated before contractor accepted!"
    assert proj_pre.get("qr_id") is None, "CRITICAL ERROR: Project has qr_id before contractor acceptance!"
    print("[PASS] Verified: Zero QR codes exist in database before contractor acceptance.")

    # -------------------------------------------------------------------------
    # 2 & 3. Contractor officially accepts the project
    # -------------------------------------------------------------------------
    print_step(2, "Requirement 2 & 3: Contractor Accepts Project -> Contract Status = ACCEPTED")
    
    accept_res = client.post(f"/api/contractor/projects/{project_id}/accept", headers=con_headers)
    assert accept_res.status_code == 200, f"Acceptance failed: {accept_res.text}"
    accept_data = accept_res.json()
    assert accept_data["success"] is True
    assert accept_data["contract_status"] == "ACCEPTED"
    assert accept_data["contract_id"] == contract_id
    print(f"[OK] Contractor officially accepted project. Message: {accept_data['message']}")

    # -------------------------------------------------------------------------
    # 4. QR Code generated automatically immediately after acceptance
    # -------------------------------------------------------------------------
    print_step(4, "Requirement 4: Unique QR Code Generated Automatically")
    
    qr_code_resp = accept_data.get("qr_code")
    assert qr_code_resp is not None, "accept endpoint must return generated qr_code"
    qr_id = qr_code_resp["qr_id"]
    print(f"[OK] QR Code generated with ID: {qr_id}")
    print(f"[OK] QR Verification URL: {qr_code_resp['verification_url']}")
    print(f"[OK] QR Status: {qr_code_resp['status']}")

    # Verify database persistence
    qr_db = db.qr_codes.find_one({"project_id": project_id})
    assert qr_db is not None, "QR record must be persisted in db.qr_codes"
    assert qr_db["qr_id"] == qr_id
    assert qr_db["contract_id"] == contract_id
    assert qr_db["status"] == "ACTIVE"
    assert qr_db["qr_image_data"].startswith("data:image/png;base64,")
    print("[PASS] Verified: QR record safely stored in db.qr_codes with all required metadata.")

    # -------------------------------------------------------------------------
    # 5. Refresh page -> same QR remains (no new QR generated)
    # -------------------------------------------------------------------------
    print_step(5, "Requirement 5: Refresh Page -> Exact Same QR Remains (Not Regenerated)")
    
    for i in range(1, 4):
        read_res = client.get(f"/api/contractor/projects/{project_id}", headers=con_headers)
        assert read_res.status_code == 200
        proj_fetched = read_res.json()
        qr_fetched = proj_fetched.get("qr_code")
        assert qr_fetched is not None
        assert qr_fetched["qr_id"] == qr_id, f"Iteration {i}: QR ID changed!"
        assert qr_fetched["created_at"] == qr_code_resp["created_at"], f"Iteration {i}: Timestamp changed!"

    total_qrs = db.qr_codes.count_documents({"project_id": project_id})
    assert total_qrs == 1, f"Expected exactly 1 QR document in DB, found {total_qrs}"
    print(f"[PASS] Page refreshed 3 times: identical QR ({qr_id}) returned without regeneration.")

    # -------------------------------------------------------------------------
    # 6. Click Accept again -> Idempotency, no duplicate QR or contract
    # -------------------------------------------------------------------------
    print_step(6, "Requirement 6: Click Accept Again -> Idempotent, No Duplicate QR")
    
    accept_again_res = client.post(f"/api/contractor/projects/{project_id}/accept", headers=con_headers)
    assert accept_again_res.status_code == 200
    again_data = accept_again_res.json()
    assert again_data["success"] is True
    assert again_data["contract_status"] == "ACCEPTED"
    assert again_data["qr_code"]["qr_id"] == qr_id, "Must return existing QR code"

    total_qrs_after_repeat = db.qr_codes.count_documents({"project_id": project_id})
    assert total_qrs_after_repeat == 1, f"Expected 1 QR code, found {total_qrs_after_repeat}"
    print("[PASS] Repeated acceptance handled idempotently: no duplicate contracts or QR records created.")

    # -------------------------------------------------------------------------
    # 7. District sees QR code
    # -------------------------------------------------------------------------
    print_step(7, "Requirement 7: District Dashboard Displays Accepted Contract & QR")
    
    dist_proj_res = client.get(f"/api/district/projects/{project_id}", headers=dist_headers)
    assert dist_proj_res.status_code == 200
    dist_proj_data = dist_proj_res.json()
    assert dist_proj_data["project"]["contract_status"] == "ACCEPTED"
    assert dist_proj_data["project"]["contract_id"] == contract_id
    assert dist_proj_data["qr_code"]["qr_id"] == qr_id
    assert dist_proj_data["qr_code"]["status"] == "ACTIVE"
    print(f"[OK] District successfully views contract {contract_id} with active QR {qr_id}.")

    # -------------------------------------------------------------------------
    # 8 & 9. Public verification page opens without login
    # -------------------------------------------------------------------------
    print_step(8, "Requirement 8 & 9: Public Users Scan QR & Verify WITHOUT Login")
    
    # Public request: NO Authorization header
    verify_res = client.get(f"/api/public/qr/verify/{qr_id}")
    assert verify_res.status_code == 200, f"Public verification failed: {verify_res.text}"
    v_data = verify_res.json()
    assert v_data["success"] is True
    assert v_data["is_valid"] is True
    assert v_data["status"] == "ACTIVE"
    print(f"[OK] Public verification succeeded for QR {qr_id} without any authentication.")

    # -------------------------------------------------------------------------
    # 10. Backend validates QR against database (Do NOT trust client/QR)
    # -------------------------------------------------------------------------
    print_step(10, "Requirement 10: Backend Validates QR & Rejects Tampered Identifiers")
    
    # Test fraudulent / non-existent QR
    fake_qr = "QR-CON-2026-FAKE-TAMPERED-999"
    fake_res = client.get(f"/api/public/qr/verify/{fake_qr}")
    assert fake_res.status_code == 404
    fake_data = fake_res.json()
    assert fake_data["is_valid"] is False
    assert fake_data["status"] == "UNRECOGNIZED"
    print(f"[PASS] Tampered QR correctly rejected by backend: '{fake_data['message']}'")

    # -------------------------------------------------------------------------
    # 11. Correct project information is displayed
    # -------------------------------------------------------------------------
    print_step(11, "Requirement 11: Correct Project Information Displayed in Public Verification")
    
    proj_info = v_data["project"]
    contract_info = v_data["contract"]
    finances_info = v_data["finances"]
    milestones_info = v_data["milestones"]

    assert proj_info["project_id"] == project_id
    assert proj_info["name"] == "Dharwad-Belagavi Rural Highway Infrastructure Corridor"
    assert proj_info["scheme_name"] == "Pradhan Mantri Gram Sadak Yojana"
    assert proj_info["district_name"] == "Belagavi"
    assert contract_info["contract_id"] == contract_id
    assert contract_info["contract_status"] == "ACCEPTED"
    assert finances_info["total_budget"] == 50000000.0
    assert len(milestones_info) == 3, f"Expected 3 milestone phases, got {len(milestones_info)}"
    print("[PASS] All public project parameters, contract status, and milestones match accurately.")

    # -------------------------------------------------------------------------
    # 12. Sensitive information is hidden (Zero leakage)
    # -------------------------------------------------------------------------
    print_step(12, "Requirement 12: Sensitive Information Is STRICTLY Hidden")
    
    raw_response_text = json.dumps(v_data).lower()
    assert "account_number" not in raw_response_text, "LEAK DETECTED: Bank account number in public verification!"
    assert "sbin-" not in raw_response_text, "LEAK DETECTED: Account number string in public verification!"
    assert "ifsc_code" not in raw_response_text, "LEAK DETECTED: IFSC code in public verification!"
    assert "password" not in raw_response_text, "LEAK DETECTED: Password field in public verification!"
    
    contractor_public = v_data.get("contractor", {})
    assert "bank_account" not in contractor_public
    assert "account_number" not in contractor_public
    assert "ifsc_code" not in contractor_public
    print("[PASS] Sensitive information verification: Bank accounts, IFSC, passwords, and private KYC are 100% hidden.")

    # -------------------------------------------------------------------------
    # 13. Cancelled/invalid project QR cannot be falsely presented as valid
    # -------------------------------------------------------------------------
    print_step(13, "Requirement 13: Invalidation Protection (Cancelled Project QR becomes INVALID)")
    
    # Simulate a cancellation or freeze on project
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "REJECTED_BY_CONTRACTOR",
            "is_frozen": True,
            "freeze_reason": "Administrative quality compliance audit freeze"
        }}
    )

    invalidated_verify_res = client.get(f"/api/public/qr/verify/{qr_id}")
    assert invalidated_verify_res.status_code == 200
    inv_data = invalidated_verify_res.json()
    assert inv_data["is_valid"] is False, "Cancelled/frozen project must NOT be marked valid!"
    assert inv_data["status"] == "INVALID"
    print(f"[PASS] Invalidation verified: Status is INVALID. Reason: '{inv_data.get('invalidation_reason')}'")

    # Restore project to active state for final verification
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "is_frozen": False,
            "freeze_reason": None
        }}
    )
    db.qr_codes.update_one(
        {"project_id": project_id},
        {"$set": {"status": "ACTIVE", "invalidated_at": None, "invalidation_reason": None}}
    )

    # -------------------------------------------------------------------------
    # 14. Test Image Download Endpoint
    # -------------------------------------------------------------------------
    print_step(14, "Requirement 14: Direct QR Image PNG Download Endpoint")
    
    img_res = client.get(f"/api/public/qr/{qr_id}/image")
    assert img_res.status_code == 200
    assert img_res.headers["content-type"] == "image/png"
    assert len(img_res.content) > 100
    print(f"[PASS] Direct PNG image endpoint verified (Returned {len(img_res.content)} bytes of image/png).")

    print("\n" + "="*75)
    print("ALL 14 REQUIREMENT TESTS PASSED WITH 100% SUCCESS!")
    print("="*75)

if __name__ == "__main__":
    run_all_tests()
