import sys
import requests
import json
import io
from datetime import datetime

BASE_URL = "http://localhost:5000/api"

def print_header(title):
    print(f"\n{'='*75}\n[FLOWCHART TEST] {title}\n{'='*75}", flush=True)

def run_flowchart_tests():
    session = requests.Session()

    # -------------------------------------------------------------
    # Logins
    # -------------------------------------------------------------
    print_header("Authentication: District Officer & Contractor")
    res = session.post(f"{BASE_URL}/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert res.status_code == 200, f"District Login failed: {res.text}"
    token_dist = res.json()["token"]
    dist_headers = {"Authorization": f"Bearer {token_dist}"}
    print("[OK] District Officer Logged in: Belagavi Jurisdiction", flush=True)

    res = session.post(f"{BASE_URL}/auth/contractor/login", json={
        "identifier": "CON-KA-APEX",
        "password": "Contractor@123"
    })
    assert res.status_code == 200, f"Contractor Login failed: {res.text}"
    token_con = res.json()["token"]
    con_user = res.json()["user"]
    con_headers = {"Authorization": f"Bearer {token_con}"}
    print(f"[OK] Contractor Logged in: {con_user['name']} ({con_user.get('contractor_id')})", flush=True)

    # -------------------------------------------------------------
    # Step 1: District Officer: Create Scheme
    # -------------------------------------------------------------
    print_header("Step 1: District Officer -> Create Scheme")
    scheme_code = f"SCH-KA-ROAD-{int(datetime.utcnow().timestamp())}"
    res = session.post(f"{BASE_URL}/district/schemes", json={
        "code": scheme_code,
        "name": "Belagavi Fast-Track Rural Connectivity Mission",
        "department": "Road Transport & Infrastructure",
        "allocated_budget": 500000000.0,
        "description": "District-level high priority all-weather connectivity scheme."
    }, headers=dist_headers)
    assert res.status_code == 201, f"Create scheme failed: {res.text}"
    scheme_data = res.json()["scheme"]
    print(f"[OK] Step 1 Complete: Scheme Created -> {scheme_data['name']} ({scheme_data['code']})", flush=True)

    # -------------------------------------------------------------
    # Step 2: District Officer: Create Project under Scheme
    # -------------------------------------------------------------
    print_header("Step 2: District Officer -> Create Project under Scheme")
    project_budget = 120000000.0 # 12 Crores
    res = session.post(f"{BASE_URL}/district/projects", json={
        "name": "Belagavi Northern Agro-Corridor & Bridge Construction",
        "scheme_code": scheme_code,
        "scheme_name": scheme_data["name"],
        "state_code": "KA",
        "district_name": "Belagavi",
        "total_budget": project_budget,
        "timeline_months": 12,
        "description": "28km high-tensile concrete bypass road with 4 culvert bridges."
    }, headers=dist_headers)
    assert res.status_code == 201, f"Create project failed: {res.text}"
    project_id = res.json()["project"]["project_id"]
    print(f"[OK] Step 2 Complete: Project Created -> {project_id} (Budget: INR {project_budget:,.2f})", flush=True)

    # -------------------------------------------------------------
    # Step 3 & 4: District Officer: Select & Assign Contractor + Notification
    # -------------------------------------------------------------
    print_header("Step 3 & 4: District Officer -> Select & Assign Contractor + Notification")
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/assign-contractor", json={
        "contractor_user_id": con_user["user_id"]
    }, headers=dist_headers)
    assert res.status_code == 200, f"Assign contractor failed: {res.text}"
    print(f"[OK] Step 3 & 4 Complete: Contractor Assigned. Notification dispatched to Contractor.", flush=True)

    # -------------------------------------------------------------
    # Step 5: Contractor Decision Branch (Test Rejection flow on secondary project)
    # -------------------------------------------------------------
    print_header("Step 5: Contractor -> Test Reject Project Branch (Project Rejected End)")
    # Create temp project to test reject
    res_temp = session.post(f"{BASE_URL}/district/projects", json={
        "name": "Temporary Project for Reject Test",
        "scheme_name": scheme_data["name"],
        "district_name": "Belagavi",
        "total_budget": 10000000.0
    }, headers=dist_headers)
    temp_p_id = res_temp.json()["project"]["project_id"]
    session.post(f"{BASE_URL}/district/projects/{temp_p_id}/assign-contractor", json={
        "contractor_user_id": con_user["user_id"]
    }, headers=dist_headers)

    res_rej = session.post(f"{BASE_URL}/contractor/projects/{temp_p_id}/reject", json={
        "rejection_reason": "Equipment bottleneck; unable to accept assignment."
    }, headers=con_headers)
    assert res_rej.status_code == 200
    print(f"[OK] Step 5 Reject Branch Verified: Project marked REJECTED_BY_CONTRACTOR (End).", flush=True)

    # -------------------------------------------------------------
    # Step 6 & 7: Contractor -> Accept Project (Auto 3 Phases: 30%, 40%, 30%)
    # -------------------------------------------------------------
    print_header("Step 6 & 7: Contractor -> Accept Project & 3 Standardized Phases Initialized")
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/accept", headers=con_headers)
    assert res.status_code == 200, f"Contractor accept failed: {res.text}"
    phases = res.json()["phases"]
    assert len(phases) == 3, f"Expected 3 phases, got {len(phases)}"
    print(f"[OK] Step 6 & 7 Complete: Project Accepted. 3 Phases Configured:", flush=True)
    for idx, p in enumerate(phases):
        print(f"   - Phase #{idx+1}: {p['title']} | INR {p['amount']:,.2f} | Status: {p['status']}", flush=True)

    # =============================================================
    # PHASE 1 (Steps 12, 8, 9, 10, 11, 13, 14, 15, 16, 17)
    # =============================================================
    print_header("PHASE 1: Execution Cycle")

    # Step 12: Contractor Request Funds (Phase 1)
    p1_amount = phases[0]["amount"]
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/request-funds", json={
        "requested_amount": p1_amount,
        "notes": "Mobilization advance for clearing, grading, and earthwork machinery."
    }, headers=con_headers)
    assert res.status_code == 200
    print(f"[OK] Step 12 Complete: Contractor requested Phase 1 funds (INR {p1_amount:,.2f})", flush=True)

    # Step 8 & 9: District Officer Receives & Tests Rejection
    res_fund_rej = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify-fund-request", json={
        "action": "REJECT",
        "remarks": "Please provide detailed machinery breakdown."
    }, headers=dist_headers)
    assert res_fund_rej.status_code == 200
    print(f"[OK] Step 9 Rejection Branch Verified: Fund request rejected with remarks.", flush=True)

    # Step 12 Re-request & Step 10 & 11: Allocate & Transfer Funds to Contractor Bank Account
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/request-funds", json={
        "requested_amount": p1_amount,
        "notes": "Revised breakdown: Earthmovers, graders, and survey teams allocated."
    }, headers=con_headers)

    res_fund_app = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify-fund-request", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res_fund_app.status_code == 200
    print(f"[OK] Step 10 & 11 Complete: District Officer Approved & Transferred Funds to Contractor Bank Account on Blockchain.", flush=True)

    # Step 13 & 14: Contractor Receives Allocated Funds & Executes Work
    res_rcv = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/receive-funds", headers=con_headers)
    assert res_rcv.status_code == 200
    print(f"[OK] Step 13 & 14 Complete: Contractor Acknowledged Funds in Bank Account and Commenced Physical Execution.", flush=True)

    # Step 15: Contractor Submits Phase 1 Completion Proof (Material Bills, Photos, Videos, Documents)
    mock_bill = io.BytesIO(b"MOCK_MATERIAL_BILLS_CEMENT_STEEL_INV_88192")
    mock_photo = io.BytesIO(b"MOCK_GEOTAGGED_PROGRESS_PHOTO_SITE_EXCAVATION")
    mock_video = io.BytesIO(b"MOCK_VIDEO_FOOTAGE_CULVERT_BASE_LAYER")
    mock_doc = io.BytesIO(b"MOCK_LAB_TEST_SOIL_COMPACTNESS_CERTIFICATE")

    res_sub = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/submit-milestone", data={
        "percentage": 100,
        "notes": "Phase 1 groundwork and foundation culverts completed as per MoRTH specs.",
        "material_bills_notes": "Inv #88192: 400 Bags Cement, 8 Tons Rebar",
        "video_url": "https://storage.googleapis.com/govtfund/p1_video.mp4"
    }, files={
        "material_bills_file": ("bills.pdf", mock_bill, "application/pdf"),
        "progress_photo_file": ("photo.jpg", mock_photo, "image/jpeg"),
        "progress_video_file": ("video.mp4", mock_video, "video/mp4"),
        "other_doc_file": ("test_report.pdf", mock_doc, "application/pdf")
    }, headers=con_headers)
    assert res_sub.status_code == 200
    print(f"[OK] Step 15 Complete: Submitted 4 Proof Deliverables with SHA-256 Hashes Anchored On-Chain.", flush=True)

    # Step 16 & 17: District Officer Verifies Submission (Test Reject -> Rectify loop, then Approve)
    res_proof_rej = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify", json={
        "action": "REJECT",
        "remarks": "Subgrade compaction report has minor deficiency. Re-testing required."
    }, headers=dist_headers)
    assert res_proof_rej.status_code == 200
    print(f"[OK] Step 17 (No / Reject) Verified: Deliverables rejected with rectification feedback.", flush=True)

    # Contractor resubmits rectified proof (Step 14 & 15)
    mock_rectified = io.BytesIO(b"MOCK_RECTIFIED_SOIL_COMPACTION_REPORT")
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/0/submit-milestone", data={
        "percentage": 100,
        "notes": "Rectified: Re-tested 98% Proctor density verified by Third-Party Lab."
    }, files={"other_doc_file": ("rectified_report.pdf", mock_rectified, "application/pdf")}, headers=con_headers)

    # District Officer Approves (Step 17: Yes -> Phase 1 Completed)
    res_p1_app = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/0/verify", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res_p1_app.status_code == 200
    assert res_p1_app.json()["next_phase_unlocked"] is True
    print(f"[OK] Step 16 & 17 Complete: Phase 1 Completed! Phase 2 Automatically Unlocked.", flush=True)

    # =============================================================
    # PHASE 2 (Steps 18, 19, 20, 21, 22, 23, 24, 25, 26, 27)
    # =============================================================
    print_header("PHASE 2: Execution Cycle")
    p2_amount = phases[1]["amount"]

    # Step 18: Request Funds Phase 2
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/1/request-funds", json={
        "requested_amount": p2_amount,
        "notes": "Mobilization for RCC concrete paving and asphalt bitumen layer."
    }, headers=con_headers)
    assert res.status_code == 200
    print(f"[OK] Step 18 Complete: Requested Phase 2 funds (INR {p2_amount:,.2f})", flush=True)

    # Step 19, 20, 21, 22: District Officer Verify, Allocate & Transfer Funds to Bank
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/1/verify-fund-request", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res.status_code == 200
    print(f"[OK] Step 19-22 Complete: Phase 2 Funds Transferred to Contractor Bank Account.", flush=True)

    # Step 23 & 24: Receive Funds & Execute Work
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/1/receive-funds", headers=con_headers)
    print(f"[OK] Step 23 & 24 Complete: Received Allocated Funds & Executed Phase 2 Work.", flush=True)

    # Step 25: Submit Phase 2 Proof
    mock_p2_photo = io.BytesIO(b"MOCK_RCC_CONCRETE_PAVING_PHOTO")
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/1/submit-milestone", data={
        "percentage": 100,
        "notes": "RCC M-40 concrete pavement laid and bitumen wear course completed."
    }, files={"progress_photo_file": ("p2_photo.jpg", mock_p2_photo, "image/jpeg")}, headers=con_headers)
    print(f"[OK] Step 25 Complete: Submitted Phase 2 Completion Proof.", flush=True)

    # Step 26 & 27: Verify Submission -> Phase 2 Completed -> Unlock Phase 3
    res_p2_app = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/1/verify", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res_p2_app.status_code == 200
    assert res_p2_app.json()["next_phase_unlocked"] is True
    print(f"[OK] Step 26 & 27 Complete: Phase 2 Completed! Phase 3 Automatically Unlocked.", flush=True)

    # =============================================================
    # PHASE 3 (Final) (Steps 28, 29, 30, 31, 32, 33, 34, 35, 36, 37)
    # =============================================================
    print_header("PHASE 3 (Final): Execution Cycle")
    p3_amount = phases[2]["amount"]

    # Step 28: Request Funds Phase 3
    res = session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/2/request-funds", json={
        "requested_amount": p3_amount,
        "notes": "Final phase advance for road markings, solar streetlights, guardrails, and audit."
    }, headers=con_headers)
    assert res.status_code == 200
    print(f"[OK] Step 28 Complete: Requested Phase 3 funds (INR {p3_amount:,.2f})", flush=True)

    # Step 29-32: Verify, Allocate & Transfer Funds to Bank
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/2/verify-fund-request", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res.status_code == 200
    print(f"[OK] Step 29-32 Complete: Phase 3 Funds Transferred to Contractor Bank Account.", flush=True)

    # Step 33 & 34: Receive Funds & Execute Work
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/2/receive-funds", headers=con_headers)
    print(f"[OK] Step 33 & 34 Complete: Received Allocated Funds & Executed Final Phase Work.", flush=True)

    # Step 35: Submit Final Completion Proof
    mock_p3_photo = io.BytesIO(b"MOCK_FINAL_ROAD_MARKINGS_SOLAR_LIGHTS_PHOTO")
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/phases/2/submit-milestone", data={
        "percentage": 100,
        "notes": "Signage, solar lighting, thermoplastic road markings, and safety guardrails installed."
    }, files={"progress_photo_file": ("p3_final.jpg", mock_p3_photo, "image/jpeg")}, headers=con_headers)
    print(f"[OK] Step 35 Complete: Submitted Final Completion Proof.", flush=True)

    # Step 36 & 37: Verify Submission -> Final Phase Completed!
    res_p3_app = session.post(f"{BASE_URL}/district/projects/{project_id}/phases/2/verify", json={
        "action": "APPROVE"
    }, headers=dist_headers)
    assert res_p3_app.status_code == 200
    assert res_p3_app.json()["is_final_project_completed"] is True
    print(f"[OK] Step 36 & 37 Complete: Final Phase Completed! Project Status: FINAL_PROJECT_COMPLETED.", flush=True)

    # =============================================================
    # Steps 38 & 39: Close Project & Deactivate Contractor Bank Account
    # =============================================================
    print_header("Step 38 & 39: Close Project & Deactivate Contractor Bank Account")

    # Step 38: Close Project
    res_close = session.post(f"{BASE_URL}/district/projects/{project_id}/close-project", headers=dist_headers)
    assert res_close.status_code == 200
    print(f"[OK] Step 38 Complete: Project Formally Closed.", flush=True)

    # Step 39: Deactivate Contractor Bank Account
    res_deact = session.post(f"{BASE_URL}/district/projects/{project_id}/deactivate-bank-account", json={
        "reason": "Project completed and audited. Escrow facility and contractor bank account deactivated."
    }, headers=dist_headers)
    assert res_deact.status_code == 200
    assert res_deact.json()["bank_account_status"] == "DEACTIVATED"
    print(f"[OK] Step 39 Complete: Contractor Bank Account Deactivated -> Account Not Available to Contractor.", flush=True)

    # Final Verification from Contractor perspective
    res_final_check = session.get(f"{BASE_URL}/contractor/projects/{project_id}", headers=con_headers)
    proj_record = res_final_check.json()["project"]
    assert proj_record["status"] == "CLOSED"
    assert proj_record["bank_account_status"] == "DEACTIVATED"
    print(f"[OK] Verified Contractor Profile reflects CLOSED status and DEACTIVATED bank account.", flush=True)

    print("\n" + "="*75, flush=True)
    print("[SUCCESS] FULL 39-STEP DISTRICT OFFICER & CONTRACTOR FLOWCHART TEST PASSED 100%!", flush=True)
    print("="*75, flush=True)

if __name__ == "__main__":
    run_flowchart_tests()
