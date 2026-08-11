import requests

BASE_URL = "http://127.0.0.1:5000/api"

def test_dependent_districts():
    print("=== Testing State and District Dependency across multiple states ===")
    
    # 1. Test Public Hierarchy
    res = requests.get(f"{BASE_URL}/public/hierarchy")
    assert res.status_code == 200, f"Hierarchy API failed: {res.text}"
    hierarchy = res.json()
    states = hierarchy.get("states", [])
    districts = hierarchy.get("districts", [])
    print(f"[OK] Fetched hierarchy: {len(states)} states, {len(districts)} total districts in database.")
    
    # 2. Login as Super Admin to test Admin Districts filtering
    admin_login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@govtfund.gov.in",
        "password": "Admin@123"
    })
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    test_states = [
        {"code": "KA", "name": "Karnataka", "expected_sample": ["Bengaluru Urban", "Belagavi", "Mysuru", "Mangaluru (Dakshina Kannada)"], "forbidden_sample": ["Pune", "Ahmedabad", "Chennai", "Lucknow"]},
        {"code": "MH", "name": "Maharashtra", "expected_sample": ["Pune", "Mumbai Suburban", "Nagpur", "Thane", "Nashik"], "forbidden_sample": ["Belagavi", "Bengaluru Urban", "Chennai", "Ahmedabad"]},
        {"code": "GJ", "name": "Gujarat", "expected_sample": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"], "forbidden_sample": ["Pune", "Belagavi", "Chennai", "Lucknow"]},
        {"code": "TN", "name": "Tamil Nadu", "expected_sample": ["Chennai", "Coimbatore", "Madurai"], "forbidden_sample": ["Pune", "Belagavi", "Ahmedabad", "Lucknow"]},
        {"code": "UP", "name": "Uttar Pradesh", "expected_sample": ["Lucknow", "Kanpur Nagar", "Varanasi", "Agra"], "forbidden_sample": ["Pune", "Belagavi", "Ahmedabad", "Chennai"]}
    ]
    
    for st in test_states:
        code = st["code"]
        name = st["name"]
        print(f"\n--- Testing State: {name} ({code}) ---")
        
        # Test Admin Filter API
        res = requests.get(f"{BASE_URL}/admin/districts?state_code={code}", headers=admin_headers)
        assert res.status_code == 200, f"Failed getting districts for {code}: {res.text}"
        data = res.json()
        returned_districts = data.get("districts", [])
        returned_names = [d["name"] for d in returned_districts]
        
        print(f"Total districts returned for {name} ({code}): {len(returned_districts)}")
        
        # Verify all returned districts belong to this state
        for d in returned_districts:
            assert d.get("state_code") == code, f"Pollution detected! District {d['name']} has state_code {d.get('state_code')} instead of {code}"
        
        # Verify expected districts are present
        for exp in st["expected_sample"]:
            assert exp in returned_names, f"Expected district '{exp}' not found in {name} districts!"
            print(f"  [OK] Expected district present: {exp}")
            
        # Verify forbidden districts from other states are NOT present
        for forb in st["forbidden_sample"]:
            assert forb not in returned_names, f"FORBIDDEN district '{forb}' from another state appeared in {name}!"
            print(f"  [OK] Forbidden district excluded: {forb}")

    print("\n=== ALL STATE-DISTRICT DEPENDENCY TESTS PASSED PERFECTLY! ===")

if __name__ == "__main__":
    test_dependent_districts()
