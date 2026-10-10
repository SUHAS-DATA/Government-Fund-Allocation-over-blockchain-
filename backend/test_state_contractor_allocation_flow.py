import uuid
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def run_tests():
    print("=== STARTING CONTRACTOR STATE REGISTRATION & ALLOCATION WORKFLOW TEST ===")

    # 1. Register a new contractor in Karnataka (KA)
    unique_suffix = str(uuid.uuid4())[:6]
    con_email = f"contractor.test.{unique_suffix}@infra.in"
    reg_payload = {
        "name": f"Test Karnataka Infra Ltd {unique_suffix}",
        "email": con_email,
        "password": "Contractor@123",
        "role": "CONTRACTOR",
        "state_code": "KA",
        "state_name": "Karnataka",
        "company_name": f"Test Karnataka Infra Ltd {unique_suffix}",
        "gst_number": f"29AABCU{unique_suffix[:4].upper()}1ZM",
        "pan_number": f"AABCU{unique_suffix[:4].upper()}R",
        "license_number": f"PWD/KA/2026/{unique_suffix}",
        "experience_years": 8
    }

    print(f"\n--- 1. Registering new contractor in Karnataka: {con_email} ---")
    res = client.post("/api/auth/register", json=reg_payload)
    assert res.status_code == 201, f"Registration failed: {res.text}"
    con_data = res.json()
    new_con_user_id = con_data["user"]["user_id"]
    print(f"[OK] Contractor registered successfully. User ID: {new_con_user_id}, State: {con_data['user'].get('state_code')}")

    # 2. Login as Karnataka District Officer (Belagavi: KA)
    print("\n--- 2. Login as Belagavi District Officer (KA) ---")
    res = client.post("/api/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert res.status_code == 200, f"Belagavi login failed: {res.text}"
    belagavi_token = res.json()["token"]
    belagavi_headers = {"Authorization": f"Bearer {belagavi_token}"}

    # 3. Check contractors returned to Belagavi District Officer
    print("\n--- 3. Verifying Belagavi District Officer only receives KA contractors ---")
    res = client.get("/api/district/contractors", headers=belagavi_headers)
    assert res.status_code == 200, f"Failed getting contractors: {res.text}"
    belagavi_contractors = res.json()["contractors"]
    print(f"Total contractors returned to Belagavi: {len(belagavi_contractors)}")
    for c in belagavi_contractors:
        c_st = (c.get("state_code") or "").upper()
        assert c_st == "KA", f"Pollution! Belagavi received contractor with state {c_st}: {c.get('company_name')}"
    print("[OK] All contractors returned to Belagavi belong strictly to Karnataka (KA)!")

    # 4. Create a project in Belagavi
    print("\n--- 4. Creating project in Belagavi District ---")
    res = client.post("/api/district/projects", headers=belagavi_headers, json={
        "name": f"Belagavi Rural Link Corridor {unique_suffix}",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 5000000.0,
        "timeline_months": 12,
        "description": "Connecting rural hamlets."
    })
    assert res.status_code == 201, f"Project creation failed: {res.text}"
    project_id = res.json()["project"]["project_id"]
    print(f"[OK] Project created: {project_id}")

    # 5. Try to allocate project to newly registered contractor BEFORE State Dept verification
    print("\n--- 5. Attempting to allocate project before State Department verification (Should be blocked) ---")
    res = client.post(f"/api/district/projects/{project_id}/assign-contractor", headers=belagavi_headers, json={
        "contractor_id": new_con_user_id
    })
    assert res.status_code == 400, f"Expected 400 Bad Request, but got {res.status_code}: {res.text}"
    print(f"[OK] Blocked unverified contractor assignment with 400: {res.json().get('message')}")

    # 6. Login as Karnataka State Treasury Officer (State Dept)
    print("\n--- 6. Login as Karnataka State Department Officer ---")
    res = client.post("/api/auth/login", json={
        "email": "karnataka@govtfund.gov.in",
        "password": "State@123"
    })
    assert res.status_code == 200, f"State login failed: {res.text}"
    state_token = res.json()["token"]
    state_headers = {"Authorization": f"Bearer {state_token}"}

    # 7. State Officer checks contractors
    print("\n--- 7. State Department fetching registered contractors in Karnataka ---")
    res = client.get("/api/state/contractors", headers=state_headers)
    assert res.status_code == 200, f"State contractors failed: {res.text}"
    state_contractors = res.json()["contractors"]
    target_con = next((c for c in state_contractors if c.get("user_id") == new_con_user_id), None)
    assert target_con is not None, f"Newly registered contractor {new_con_user_id} not found in state contractors!"
    assert target_con["kyc_status"] == "UNDER_REVIEW", f"Expected UNDER_REVIEW, got {target_con['kyc_status']}"
    print(f"[OK] Found contractor {target_con['company_name']} with status: {target_con['kyc_status']}")

    # 8. State Department approves the contractor
    print("\n--- 8. State Department verifying and approving contractor ---")
    res = client.post(f"/api/state/contractor/{new_con_user_id}/kyc-review", headers=state_headers, json={
        "action": "APPROVED",
        "remarks": "Statutory Class-1 PWD credentials and GSTIN verified by Karnataka State Department."
    })
    assert res.status_code == 200, f"State approval failed: {res.text}"
    print(f"[OK] Contractor verified and approved by State Department: {res.json().get('message')}")

    # 9. Now Belagavi District Officer allocates the project to the approved contractor
    print("\n--- 9. Belagavi District Officer allocating project to now-verified contractor ---")
    res = client.post(f"/api/district/projects/{project_id}/assign-contractor", headers=belagavi_headers, json={
        "contractor_id": new_con_user_id
    })
    assert res.status_code == 200, f"Allocation failed: {res.text}"
    print(f"[OK] Project successfully allocated to contractor: {res.json().get('message')}")

    # 10. Attempt Cross-State allocation: Belagavi District Officer tries to assign a Maharashtra (MH) contractor
    print("\n--- 10. Attempting cross-state assignment: Belagavi Officer assigning MH contractor (Should be blocked) ---")
    res = client.post(f"/api/district/projects/{project_id}/assign-contractor", headers=belagavi_headers, json={
        "contractor_id": "CON-MH-INFRA"
    })
    assert res.status_code == 400, f"Expected 400 Bad Request for cross-state, but got {res.status_code}: {res.text}"
    print(f"[OK] Cross-state contractor assignment blocked with 400: {res.json().get('message')}")

    # 11. Login as Pune District Officer (MH) and verify only MH contractors are visible
    print("\n--- 11. Login as Pune District Officer (MH) and verify only MH contractors are shown ---")
    res = client.post("/api/auth/district/login", json={
        "identifier": "district.pune",
        "password": "District@123"
    })
    assert res.status_code == 200, f"Pune login failed: {res.text}"
    pune_token = res.json()["token"]
    pune_headers = {"Authorization": f"Bearer {pune_token}"}

    res = client.get("/api/district/contractors", headers=pune_headers)
    assert res.status_code == 200
    pune_contractors = res.json()["contractors"]
    print(f"Total contractors returned to Pune: {len(pune_contractors)}")
    for c in pune_contractors:
        c_st = (c.get("state_code") or "").upper()
        assert c_st == "MH", f"Pollution! Pune received contractor with state {c_st}: {c.get('company_name')}"
    print("[OK] All contractors returned to Pune belong strictly to Maharashtra (MH)!")

    # 12. Test login behavior for unverified contractor (Should return 403)
    print("\n--- 12. Testing unverified contractor login (Should be blocked with 403) ---")
    res = client.post("/api/auth/login", json={
        "email": con_email,
        "password": "Contractor@123"
    })
    # Since contractor was approved in step 8, let's register another contractor specifically to test rejection and under-review!
    con2_suffix = str(uuid.uuid4())[:6]
    con2_email = f"contractor.reject.{con2_suffix}@infra.in"
    res2 = client.post("/api/auth/register", json={
        "name": f"Reject Candidate Infra {con2_suffix}",
        "email": con2_email,
        "password": "Contractor@123",
        "role": "CONTRACTOR",
        "state_code": "KA",
        "state_name": "Karnataka",
        "company_name": f"Reject Candidate Infra {con2_suffix}"
    })
    assert res2.status_code == 201
    reject_con_id = res2.json()["user"]["user_id"]

    # 13. Try logging in while UNDER_REVIEW (Should be 403)
    print("\n--- 13. Testing login while UNDER_REVIEW (Should be blocked with 403) ---")
    res_pending = client.post("/api/auth/login", json={
        "email": con2_email,
        "password": "Contractor@123"
    })
    assert res_pending.status_code == 403, f"Expected 403 for under-review login, got: {res_pending.status_code}"
    assert res_pending.json().get("kyc_status") == "UNDER_REVIEW"
    print(f"[OK] Blocked login for pending contractor with 403: {res_pending.json().get('message')}")

    # 14. State Department REJECTS this contractor
    print("\n--- 14. State Department REJECTS contractor ---")
    res_rej = client.post(f"/api/state/contractor/{reject_con_id}/kyc-review", headers=state_headers, json={
        "action": "REJECTED",
        "remarks": "Invalid PWD Class-1 license documents."
    })
    assert res_rej.status_code == 200

    # 15. Rejected contractor attempts to log in (Must be strictly blocked with 403 REJECTED)
    print("\n--- 15. Testing login after State Department REJECTION (Should be blocked with 403) ---")
    res_rej_login = client.post("/api/auth/login", json={
        "email": con2_email,
        "password": "Contractor@123"
    })
    assert res_rej_login.status_code == 403, f"Expected 403 for rejected login, got: {res_rej_login.status_code}"
    assert res_rej_login.json().get("kyc_status") == "REJECTED"
    print(f"[OK] Blocked login for REJECTED contractor with 403: {res_rej_login.json().get('message')}")

    print("\n=== ALL WORKFLOW & REJECTION TESTS PASSED 100%! ===")

if __name__ == "__main__":
    run_tests()
