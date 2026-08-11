import requests

BASE = 'http://localhost:5000/api'
test_cases = [
    ('CON-KA-APEX', 'Contractor@123'),
    ('contractor.apex', 'Contractor@123'),
    ('contractor@buildcorp.in', 'Contractor@123'),
    ('CON-KA-HIGHWAY', 'Contractor@123'),
    ('contractor.ka', 'Contractor@123'),
    ('contractor.ka@infra.in', 'Contractor@123'),
    ('CON-MH-INFRA', 'Contractor@123'),
    ('contractor.mh', 'Contractor@123'),
    ('contractor.mh@infra.in', 'Contractor@123'),
    ('CON-TN-SOUTHERN', 'Contractor@123'),
    ('contractor.south', 'Contractor@123'),
    ('contractor.south@infra.in', 'Contractor@123')
]

for identifier, pwd in test_cases:
    # Test via /auth/login
    r1 = requests.post(f'{BASE}/auth/login', json={'identifier': identifier, 'password': pwd})
    assert r1.status_code == 200, f"/auth/login failed for {identifier}: {r1.text}"
    
    # Test via /auth/contractor/login
    r2 = requests.post(f'{BASE}/auth/contractor/login', json={'identifier': identifier, 'password': pwd})
    assert r2.status_code == 200, f"/auth/contractor/login failed for {identifier}: {r2.text}"
    
    name = r1.json()["user"]["name"]
    print(f"[OK] Verified '{identifier}' -> Logged in as: {name}", flush=True)

print("\n[SUCCESS] All 12 contractor login variations succeeded with 100% success!", flush=True)
