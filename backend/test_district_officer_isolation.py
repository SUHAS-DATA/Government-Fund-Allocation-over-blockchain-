import requests

BASE_URL = "http://127.0.0.1:5000/api"

def test_district_officer_isolation():
    print("=== STARTING DISTRICT OFFICER LOGIN & ISOLATION TESTS ===")

    # -------------------------------------------------------------
    # 1. Test Login via District Officer ID
    # -------------------------------------------------------------
    print("\n--- 1. Testing Login via Officer ID (Belagavi: DIST-KA-BELAGAVI) ---")
    res = requests.post(f"{BASE_URL}/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert res.status_code == 200, f"Belagavi login failed: {res.text}"
    belagavi_data = res.json()
    belagavi_token = belagavi_data["token"]
    belagavi_user = belagavi_data["user"]
    belagavi_headers = {"Authorization": f"Bearer {belagavi_token}"}
    
    assert belagavi_user["district_name"] == "Belagavi", f"Expected Belagavi, got {belagavi_user.get('district_name')}"
    assert belagavi_user["state_code"] == "KA", f"Expected KA, got {belagavi_user.get('state_code')}"
    assert belagavi_user["role"] == "DISTRICT"
    print(f"[OK] Belagavi Officer Logged In: {belagavi_user['name']} | District: {belagavi_user['district_name']} ({belagavi_user['state_code']})")

    # -------------------------------------------------------------
    # 2. Test Login via Username (Pune: district.pune)
    # -------------------------------------------------------------
    print("\n--- 2. Testing Login via Username (Pune: district.pune) ---")
    res = requests.post(f"{BASE_URL}/auth/district/login", json={
        "identifier": "district.pune",
        "password": "District@123"
    })
    assert res.status_code == 200, f"Pune login failed: {res.text}"
    pune_data = res.json()
    pune_token = pune_data["token"]
    pune_user = pune_data["user"]
    pune_headers = {"Authorization": f"Bearer {pune_token}"}

    assert pune_user["district_name"] == "Pune", f"Expected Pune, got {pune_user.get('district_name')}"
    assert pune_user["state_code"] == "MH", f"Expected MH, got {pune_user.get('state_code')}"
    assert pune_user["role"] == "DISTRICT"
    print(f"[OK] Pune Officer Logged In: {pune_user['name']} | District: {pune_user['district_name']} ({pune_user['state_code']})")

    # -------------------------------------------------------------
    # 3. Test Authorized District Officer Access (Own District)
    # -------------------------------------------------------------
    print("\n--- 3. Testing Authorized Access for Belagavi Officer in Belagavi ---")
    res = requests.get(f"{BASE_URL}/district/dashboard", headers=belagavi_headers)
    assert res.status_code == 200, f"Dashboard access failed: {res.text}"
    db_data = res.json()
    assert db_data["district_name"] == "Belagavi"
    assert db_data["is_locked_district"] is True
    print(f"[OK] Belagavi Dashboard retrieved successfully: Total funds: INR {db_data['metrics']['total_funds_received']:,}")

    res = requests.get(f"{BASE_URL}/district/projects", headers=belagavi_headers)
    assert res.status_code == 200, f"Projects access failed: {res.text}"
    projs = res.json().get("projects", [])
    print(f"[OK] Belagavi Projects retrieved successfully: {len(projs)} projects found in Belagavi.")

    # -------------------------------------------------------------
    # 4. Test Unauthorized / Access Denied for Cross-District Attempt
    # -------------------------------------------------------------
    print("\n--- 4. Testing Cross-District Attack Prevention (Belagavi Officer -> Pune) ---")
    
    # 4a. Query Pune dashboard as Belagavi officer
    res = requests.get(f"{BASE_URL}/district/dashboard?district=Pune", headers=belagavi_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden, but got {res.status_code}: {res.text}"
    print(f"[OK] Blocked cross-district dashboard query with 403 Forbidden: {res.json().get('message')}")

    # 4b. Query Pune projects as Belagavi officer
    res = requests.get(f"{BASE_URL}/district/projects?district=Pune", headers=belagavi_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden, but got {res.status_code}: {res.text}"
    print(f"[OK] Blocked cross-district projects query with 403 Forbidden: {res.json().get('message')}")

    # 4c. Attempt creating project in Pune as Belagavi officer
    res = requests.post(f"{BASE_URL}/district/projects", headers=belagavi_headers, json={
        "name": "Unauthorized Cross-District Project Attempt",
        "scheme_name": "PMGSY",
        "district_name": "Pune",
        "total_budget": 10000000
    })
    assert res.status_code == 403, f"Expected 403 Forbidden for cross-district creation, but got {res.status_code}: {res.text}"
    print(f"[OK] Blocked cross-district project creation with 403 Forbidden: {res.json().get('message')}")

    # -------------------------------------------------------------
    # 5. Test Pune Officer isolation (Pune Officer -> Belagavi)
    # -------------------------------------------------------------
    print("\n--- 5. Testing Cross-District Attack Prevention (Pune Officer -> Belagavi) ---")
    res = requests.get(f"{BASE_URL}/district/dashboard?district=Belagavi", headers=pune_headers)
    assert res.status_code == 403, f"Expected 403 Forbidden, but got {res.status_code}: {res.text}"
    print(f"[OK] Blocked Pune officer accessing Belagavi with 403 Forbidden: {res.json().get('message')}")

    # -------------------------------------------------------------
    # 6. Test Higher Authority (Super Admin) cross-district inspection
    # -------------------------------------------------------------
    print("\n--- 6. Testing Super Admin Cross-District Privileges ---")
    admin_login = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@govtfund.gov.in",
        "password": "Admin@123"
    })
    assert admin_login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {admin_login.json()['token']}"}

    res_belagavi = requests.get(f"{BASE_URL}/district/dashboard?district=Belagavi", headers=admin_headers)
    assert res_belagavi.status_code == 200
    print("[OK] Super Admin can inspect Belagavi District dashboard.")

    res_pune = requests.get(f"{BASE_URL}/district/dashboard?district=Pune", headers=admin_headers)
    assert res_pune.status_code == 200
    print("[OK] Super Admin can inspect Pune District dashboard.")

    print("\n=== ALL DISTRICT OFFICER LOGIN & ISOLATION TESTS PASSED 100%! ===")

if __name__ == "__main__":
    test_district_officer_isolation()
