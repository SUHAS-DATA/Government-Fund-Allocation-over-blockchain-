import sys
import requests
import json
import io

BASE_URL = "http://localhost:5000/api"

def print_step(title):
    print(f"\n{'='*70}\n[STEP] {title}\n{'='*70}", flush=True)

def run_tests():
    session = requests.Session()

    # -------------------------------------------------------------
    # 1. Contractor Authentication Verification
    # -------------------------------------------------------------
    print_step("1. Testing Contractor Login Multi-Identifier Support")
    
    # 1a. Login with Contractor ID
    res = session.post(f"{BASE_URL}/auth/contractor/login", json={
        "identifier": "CON-KA-APEX",
        "password": "Contractor@123"
    })
    assert res.status_code == 200, f"Contractor ID login failed: {res.text}"
    token_apex = res.json()["token"]
    user_apex = res.json()["user"]
    print(f"[OK] Contractor ID Login Successful: {user_apex['name']} ({user_apex.get('contractor_id')})", flush=True)

    # 1b. Login with Username
    res = session.post(f"{BASE_URL}/auth/contractor/login", json={
        "identifier": "contractor.ka",
        "password": "Contractor@123"
    })
    assert res.status_code == 200, f"Username login failed: {res.text}"
    token_ka = res.json()["token"]
    print("[OK] Username Login Successful for contractor.ka", flush=True)

    # 1c. Login as Pune Contractor for Isolation Testing
    res = session.post(f"{BASE_URL}/auth/contractor/login", json={
        "identifier": "CON-MH-INFRA",
        "password": "Contractor@123"
    })
    assert res.status_code == 200, f"Pune Contractor login failed: {res.text}"
    token_pune_con = res.json()["token"]
    print("[OK] Login Successful for CON-MH-INFRA (Maharashtra)", flush=True)

    # -------------------------------------------------------------
    # 2. District Officer Login & Project Creation + Assignment
    # -------------------------------------------------------------
    print_step("2. District Officer Login & Project Creation with Contractor Assignment")
    res = session.post(f"{BASE_URL}/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert res.status_code == 200, f"District Login failed: {res.text}"
    token_dist = res.json()["token"]
    dist_headers = {"Authorization": f"Bearer {token_dist}"}

    project_budget = 100000000.0 # 10 Crores
    res = session.post(f"{BASE_URL}/district/projects", json={
        "name": "Belagavi Bypass Multi-Lane Flyover & Smart Corridor",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
        "state_code": "KA",
        "district_name": "Belagavi",
        "total_budget": project_budget,
        "timeline_months": 18,
        "description": "Four-lane grade-separated bypass corridor with storm drainage."
    }, headers=dist_headers)
    assert res.status_code == 201, f"Project creation failed: {res.text}"
    project_id = res.json()["project"]["project_id"]
    print(f"[OK] Project Created: {project_id} with Budget INR {project_budget:,.2f}", flush=True)

    # Assign Contractor Apex
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/assign-contractor", json={
        "contractor_user_id": user_apex["user_id"]
    }, headers=dist_headers)
    assert res.status_code == 200, f"Assign contractor failed: {res.text}"
    print(f"[OK] Assigned Project {project_id} to Apex Infrastructure ({user_apex['email']})", flush=True)

    # -------------------------------------------------------------
    # 3. Contractor Acceptance & Automatic 3-Phase Generation
    # -------------------------------------------------------------
    print_step("3. Contractor Accepts Project & Auto 3-Phase Generation (30%, 40%, 30%)")
    apex_headers = {"Authorization": f"Bearer {token_apex}"}

    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/accept", headers=apex_headers)
    assert res.status_code == 200, f"Contractor accept failed: {res.text}"
    phases = res.json()["phases"]
    assert len(phases) == 3, f"Expected 3 phases, got {len(phases)}"
    
    p1 = phases[0]
    p2 = phases[1]
    p3 = phases[2]
    
    expected_p1 = round(project_budget * 0.30, 2)
    expected_p2 = round(project_budget * 0.40, 2)
    expected_p3 = round(project_budget * 0.30, 2)

    assert p1["amount"] == expected_p1, f"Phase 1 expected {expected_p1}, got {p1['amount']}"
    assert p2["amount"] == expected_p2, f"Phase 2 expected {expected_p2}, got {p2['amount']}"
    assert p3["amount"] == expected_p3, f"Phase 3 expected {expected_p3}, got {p3['amount']}"
    assert p1["status"] == "UNLOCKED", f"Phase 1 should be UNLOCKED, got {p1['status']}"
    assert p2["status"] == "LOCKED", f"Phase 2 should be LOCKED, got {p2['status']}"
    assert p3["status"] == "LOCKED", f"Phase 3 should be LOCKED, got {p3['status']}"
    print(f"[OK] Automatic 3-Phase Division Confirmed:", flush=True)
    print(f"  - Phase 1 (30%): INR {p1['amount']:,.2f} [Status: {p1['status']}]", flush=True)
    print(f"  - Phase 2 (40%): INR {p2['amount']:,.2f} [Status: {p2['status']}]", flush=True)
    print(f"  - Phase 3 (30%): INR {p3['amount']:,.2f} [Status: {p3['status']}]", flush=True)

    # -------------------------------------------------------------
    # 4. Phase Skipping & Excess Funds Security Checks
    # -------------------------------------------------------------
    print_step("4. Security Rules: Prevent Phase Skipping & Prevent Excess Fund Claims")
    
    # 4a. Attempt to request Phase 2 before Phase 1 is completed
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/1/request-funds", json={
        "requested_amount": expected_p2,
        "notes": "Trying to skip Phase 1"
    }, headers=apex_headers)
    assert res.status_code == 400, f"Expected 400 Bad Request for skipping phase, got {res.status_code}: {res.text}"
    print(f"[OK] Phase Skipping Blocked: {res.json()['message']}", flush=True)

    # 4b. Attempt to request excess funds in Phase 1
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/request-funds", json={
        "requested_amount": expected_p1 + 5000000.0, # Excess 50 Lakhs
        "notes": "Excess claim"
    }, headers=apex_headers)
    assert res.status_code == 400, f"Expected 400 Bad Request for excess funds, got {res.status_code}: {res.text}"
    print(f"[OK] Excess Fund Claim Blocked: {res.json()['message']}", flush=True)

    # -------------------------------------------------------------
    # 5. Phase 1 Fund Request & District Officer Approval
    # -------------------------------------------------------------
    print_step("5. Phase 1 Fund Request & District Officer Approval")
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/request-funds", json={
        "requested_amount": expected_p1,
        "notes": "Mobilization advance for survey and site leveling."
    }, headers=apex_headers)
    assert res.status_code == 200, f"Fund request failed: {res.text}"
    print(f"[OK] Contractor Requested Phase 1 Funds: INR {expected_p1:,.2f}", flush=True)

    # District Officer Approves Phase 1 Funds
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/approve-funds", headers=dist_headers)
    assert res.status_code == 200, f"District fund approval failed: {res.text}"
    print(f"[OK] District Officer Approved Phase 1 Funds for work execution.", flush=True)

    # -------------------------------------------------------------
    # 6. Milestone Submission, Rejection with Remarks, & Resubmission
    # -------------------------------------------------------------
    print_step("6. Milestone Proof Upload, Rejection Handling & Resubmission")
    
    # 6a. Contractor uploads initial milestone proof
    fake_photo = io.BytesIO(b"MOCK_IMAGE_DATA_SITE_INSPECTION_BELAGAVI")
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/submit-milestone", data={
        "percentage": 100,
        "notes": "Initial survey and excavation completed."
    }, files={"file": ("site_proof.jpg", fake_photo, "image/jpeg")}, headers=apex_headers)
    assert res.status_code == 200, f"Milestone submit failed: {res.text}"
    print(f"[OK] Milestone Proof Uploaded with SHA-256 Digest: {res.json().get('proof_document_hash')}", flush=True)

    # 6b. District Officer Rejects Milestone
    rejection_remarks = "Concrete compressive test certificate missing and earthwork grading incomplete."
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify", json={
        "action": "REJECT",
        "remarks": rejection_remarks
    }, headers=dist_headers)
    assert res.status_code == 200, f"Milestone reject failed: {res.text}"
    print(f"[OK] District Officer Rejected Phase 1 Deliverables with Reason: '{rejection_remarks}'", flush=True)

    # 6c. Verify Contractor Sees Rejection
    res = session.get(f"{BASE_URL}/contractor/projects/{project_id}", headers=apex_headers)
    assert res.status_code == 200
    p1_status = res.json()["milestones"][0]
    assert p1_status["status"] == "REJECTED"
    assert p1_status["rejection_reason"] == rejection_remarks
    print(f"[OK] Verified Contractor Profile reflects REJECTED status with full remarks.", flush=True)

    # 6d. Contractor Resubmits Milestone Proof
    fake_rectified_photo = io.BytesIO(b"MOCK_RECTIFIED_CONCRETE_TEST_CERTIFICATE")
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/submit-milestone", data={
        "percentage": 100,
        "notes": "Rectified: Added compressive strength lab report and re-graded sub-base."
    }, files={"file": ("rectified_proof.pdf", fake_rectified_photo, "application/pdf")}, headers=apex_headers)
    assert res.status_code == 200, f"Milestone resubmit failed: {res.text}"
    print(f"[OK] Contractor Successfully Resubmitted Milestone Deliverables.", flush=True)

    # -------------------------------------------------------------
    # 7. Final Phase 1 Approval, Payment Release & Auto Phase 2 Unlock
    # -------------------------------------------------------------
    print_step("7. Milestone Approval, Escrow Disbursal & Automatic Next Phase Unlock")
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify", json={
        "action": "APPROVE",
        "remarks": "Site inspection passed. Lab certifications compliant with MoRTH standards."
    }, headers=dist_headers)
    assert res.status_code == 200, f"Milestone approve failed: {res.text}"
    assert res.json()["next_phase_unlocked"] is True
    print(f"[OK] Phase 1 Approved on Blockchain! Escrow Released: INR {expected_p1:,.2f}", flush=True)

    # Verify Phase 2 is now UNLOCKED
    res = session.get(f"{BASE_URL}/contractor/projects/{project_id}", headers=apex_headers)
    milestones_updated = res.json()["milestones"]
    assert milestones_updated[0]["status"] == "COMPLETED", f"Phase 1 should be COMPLETED, got {milestones_updated[0]['status']}"
    assert milestones_updated[1]["status"] == "UNLOCKED", f"Phase 2 should be UNLOCKED, got {milestones_updated[1]['status']}"
    assert milestones_updated[2]["status"] == "LOCKED", f"Phase 3 should remain LOCKED, got {milestones_updated[2]['status']}"
    print(f"[OK] Automatic Next Phase Progression Verified:", flush=True)
    print(f"  - Phase 1: {milestones_updated[0]['status']} (Disbursed)", flush=True)
    print(f"  - Phase 2: {milestones_updated[1]['status']} (Unlocked & Ready for Fund Request)", flush=True)
    print(f"  - Phase 3: {milestones_updated[2]['status']} (Locked)", flush=True)

    # -------------------------------------------------------------
    # 8. Strict Contractor Isolation Verification
    # -------------------------------------------------------------
    print_step("8. Strict Contractor Isolation: Cross-Contractor Access Blocking")
    pune_headers = {"Authorization": f"Bearer {token_pune_con}"}

    # 8a. Maharashtra Contractor attempts to view Belagavi project assigned to Apex
    res = session.get(f"{BASE_URL}/contractor/projects/{project_id}", headers=pune_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for cross-contractor project view, got {res.status_code}: {res.text}"
    print(f"[OK] Cross-Contractor View Blocked (403 Forbidden): {res.json()['message']}", flush=True)

    # 8b. Maharashtra Contractor attempts to request funds on Apex's project
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/1/request-funds", json={
        "requested_amount": expected_p2
    }, headers=pune_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for cross-contractor fund request, got {res.status_code}: {res.text}"
    print(f"[OK] Cross-Contractor Fund Request Blocked (403 Forbidden)", flush=True)

    print("\n" + "="*70, flush=True)
    print("[SUCCESS] ALL CONTRACTOR MODULE TESTS PASSED WITH 100% SUCCESS!", flush=True)
    print("="*70, flush=True)

if __name__ == "__main__":
    run_tests()
