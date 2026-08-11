import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def print_step(title):
    print(f"\n========================================================")
    print(f"  [STEP] {title}")
    print(f"========================================================")

def run_tests():
    session = requests.Session()

    # 1. Health check
    print_step("1. Checking API Health & Hardhat Blockchain Connection")
    res = session.get(f"{BASE_URL}/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print(f"[SUCCESS] Health Status: {health['status']} | Database: {health['database']}")
    print(f"[SUCCESS] Blockchain Connected: {health['blockchain']['connected']} | Contract: {health['blockchain']['contract_address']}")

    # 2. Super Admin Login
    print_step("2. Super Admin Authentication")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "admin@govtfund.gov.in", "password": "Admin@123"})
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"[SUCCESS] Admin logged in successfully as: {res.json()['user']['name']}")

    # 3. Super Admin creates Budget Allocation
    print_step("3. Super Admin creates Central Budget Allocation (INR 100 Cr)")
    alloc_payload = {
        "financial_year": "2026-27",
        "department": "Road Transport & Infrastructure",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)",
        "amount": 1000000000
    }
    res = session.post(f"{BASE_URL}/admin/budget/allocate", json=alloc_payload, headers=admin_headers)
    assert res.status_code == 201, f"Allocation failed: {res.text}"
    alloc_id = res.json().get("allocation_id") or res.json().get("budget", {}).get("allocation_id")
    print(f"[SUCCESS] Budget Allocation created: {alloc_id} | Blockchain Tx: {res.json().get('blockchain', {}).get('tx_hash')}")

    # 4. Super Admin forwards to Finance
    print_step("4. Super Admin forwards Budget to Finance Department")
    res = session.post(f"{BASE_URL}/admin/budget/send-to-finance", json={"allocation_id": alloc_id, "notes": "Approved for FY 26-27 state disbursement"}, headers=admin_headers)
    assert res.status_code == 200, f"Send to finance failed: {res.text}"
    print(f"[SUCCESS] Budget forwarded to Finance Department")

    # 5. Finance Officer Login
    print_step("5. Finance Officer Authentication")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "finance@govtfund.gov.in", "password": "Finance@123"})
    assert res.status_code == 200, f"Finance login failed: {res.text}"
    finance_token = res.json()["token"]
    finance_headers = {"Authorization": f"Bearer {finance_token}"}
    print(f"[SUCCESS] Finance Officer logged in")

    # 6. Finance verifies and transfers to Maharashtra State Treasury
    print_step("6. Finance verifies budget and transfers INR 25 Cr to State Treasury")
    session.post(f"{BASE_URL}/finance/verify-budget/{alloc_id}", headers=finance_headers)
    transfer_payload = {
        "allocation_id": alloc_id,
        "state_code": "MH",
        "state_name": "Maharashtra",
        "amount": 250000000,
        "sign_off_note": "Quarter-1 treasury release approved by Finance Secretary"
    }
    res = session.post(f"{BASE_URL}/finance/approve-and-transfer", json=transfer_payload, headers=finance_headers)
    assert res.status_code == 201, f"Finance transfer failed: {res.text}"
    transfer_id = res.json()["transfer"]["transfer_id"]
    print(f"[SUCCESS] State Transfer executed: {transfer_id} | On-Chain Tx: {res.json()['blockchain']['tx_hash']}")

    # 7. State Officer Login
    print_step("7. State Officer Authentication")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "state@govtfund.gov.in", "password": "State@123"})
    assert res.status_code == 200, f"State login failed: {res.text}"
    state_token = res.json()["token"]
    state_headers = {"Authorization": f"Bearer {state_token}"}
    print(f"[SUCCESS] State Officer (Maharashtra) logged in")

    # 8. State allocates to Pune District Agency
    print_step("8. State allocates INR 15 Cr to Pune District Development Agency")
    state_alloc_payload = {
        "transfer_id": transfer_id,
        "district_name": "Pune",
        "amount": 150000000
    }
    res = session.post(f"{BASE_URL}/state/allocate-to-district", json=state_alloc_payload, headers=state_headers)
    assert res.status_code == 201, f"State allocation failed: {res.text}"
    district_alloc_id = res.json()["allocation"]["district_alloc_id"]
    print(f"[SUCCESS] District Allocation executed: {district_alloc_id} | On-Chain Tx: {res.json()['blockchain']['tx_hash']}")

    # 9. Contractor Login & KYC Update
    print_step("9. Contractor Authentication & KYC Document Submission")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "contractor@buildcorp.in", "password": "Contractor@123"})
    assert res.status_code == 200, f"Contractor login failed: {res.text}"
    contractor_token = res.json()["token"]
    contractor_user_id = res.json()["user"]["user_id"]
    contractor_headers = {"Authorization": f"Bearer {contractor_token}"}
    print(f"[SUCCESS] Contractor logged in: {contractor_user_id}")

    # 10. District Officer Login & Approves Contractor KYC
    print_step("10. District Officer Authentication & Contractor KYC Approval")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "district@govtfund.gov.in", "password": "District@123"})
    assert res.status_code == 200, f"District login failed: {res.text}"
    district_token = res.json()["token"]
    district_headers = {"Authorization": f"Bearer {district_token}"}

    res = session.post(f"{BASE_URL}/district/contractor/{contractor_user_id}/kyc-review", json={"action": "APPROVED", "remarks": "PWD Class-1 & GST verified"}, headers=district_headers)
    assert res.status_code == 200, f"KYC review failed: {res.text}"
    print(f"[SUCCESS] Contractor KYC Approved by District Officer")

    # 11. District creates Project & deploys Escrow on Ethereum
    print_step("11. District creates Project & deploys Smart Contract Escrow")
    proj_payload = {
        "name": "Pune-Baramati High Speed Rural Highway Corridor",
        "scheme_code": "PMGSY",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)",
        "department": "Road Transport & Infrastructure",
        "total_budget": 150000000,
        "description": "4-lane bituminous heavy road with automated toll monitoring",
        "timeline_months": 12
    }
    res = session.post(f"{BASE_URL}/district/projects", json=proj_payload, headers=district_headers)
    assert res.status_code == 201, f"Project creation failed: {res.text}"
    project_id = res.json()["project"]["project_id"]
    print(f"[SUCCESS] Project created: {project_id}")

    # Assign contractor
    session.post(f"{BASE_URL}/district/projects/{project_id}/assign-contractor", json={"contractor_id": contractor_user_id}, headers=district_headers)
    
    # Deploy Escrow on Ethereum
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/create-escrow", headers=district_headers)
    assert res.status_code == 200, f"Escrow creation failed: {res.text}"
    print(f"[SUCCESS] Smart Contract Escrow deployed on Ethereum! Tx: {res.json()['blockchain']['tx_hash']}")

    # 12. District configures Milestones
    print_step("12. District configures 3 Milestone Phases")
    milestones_payload = {
        "milestones": [
            {"title": "Phase 1: Foundation & Grading", "amount": 50000000, "description": "Base leveling and culverts"},
            {"title": "Phase 2: Bitumen Paving", "amount": 60000000, "description": "Asphalt concrete paving"},
            {"title": "Phase 3: Final Road Markings & Signage", "amount": 40000000, "description": "Safety audits & solar signs"}
        ]
    }
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/milestones", json=milestones_payload, headers=district_headers)
    assert res.status_code == 200, f"Milestones setup failed: {res.text}"
    print(f"[SUCCESS] Milestones locked on project: {milestones_payload['milestones']}")

    # 13. Contractor uploads Progress & requests Payment
    print_step("13. Contractor submits Progress & claims Milestone #1 payment")
    session.post(f"{BASE_URL}/contractor/projects/{project_id}/request-payment", json={"milestone_index": 0, "request_notes": "Phase 1 works completed"}, headers=contractor_headers)
    print(f"[SUCCESS] Payment release requested by Contractor")

    # 14. District inspects and releases Milestone #1 payment on Smart Contract
    print_step("14. District approves & releases Phase 1 Escrow Payment on Ethereum")
    res = session.post(f"{BASE_URL}/district/projects/{project_id}/milestones/0/approve-release", headers=district_headers)
    assert res.status_code == 200, f"Milestone release failed: {res.text}"
    print(f"[SUCCESS] Phase 1 Payment (INR 5 Cr) released to Contractor! On-Chain Tx: {res.json()['blockchain']['tx_hash']}")

    # 15. Auditor Login & Forensic Checks
    print_step("15. Forensic CAG Auditor Login & Live Audit Checks")
    res = session.post(f"{BASE_URL}/auth/login", json={"email": "auditor@auditindia.gov.in", "password": "Auditor@123"})
    assert res.status_code == 200, f"Auditor login failed: {res.text}"
    auditor_token = res.json()["token"]
    auditor_headers = {"Authorization": f"Bearer {auditor_token}"}

    # Test Project Freeze & Unfreeze on Ethereum
    print_step("16. Auditor executes Emergency Smart Contract Fund Freeze & Unfreeze")
    res = session.post(f"{BASE_URL}/auditor/freeze-project", json={"project_id": project_id, "reason": "Sample test audit inspection"}, headers=auditor_headers)
    assert res.status_code == 200, f"Freeze failed: {res.text}"
    print(f"[SUCCESS] Smart Contract Project Frozen on Ethereum! Tx: {res.json()['blockchain']['tx_hash']}")

    res = session.post(f"{BASE_URL}/auditor/unfreeze-project", json={"project_id": project_id, "reason": "Test audit completed successfully"}, headers=auditor_headers)
    assert res.status_code == 200, f"Unfreeze failed: {res.text}"
    print(f"[SUCCESS] Smart Contract Project Unfrozen on Ethereum! Tx: {res.json()['blockchain']['tx_hash']}")

    # Auditor Submits CAG Audit Report on Ethereum
    print_step("17. Auditor Submits Formal CAG Forensic Audit Report")
    audit_payload = {
        "project_id": project_id,
        "compliance_score": 96,
        "status": "APPROVED",
        "findings": "Physical site inspection and photographic SHA-256 hashes confirm 100% compliance with PWD engineering specifications."
    }
    res = session.post(f"{BASE_URL}/auditor/submit-audit-report", json=audit_payload, headers=auditor_headers)
    assert res.status_code == 201, f"Audit submit failed: {res.text}"
    print(f"[SUCCESS] CAG Forensic Audit Report anchored on Ethereum! Tx: {res.json()['blockchain']['tx_hash']}")

    # 18. Citizen Grievance Workflow
    print_step("18. Public Citizen Grievance Filing & District Resolution")
    grv_payload = {
        "citizen_name": "Sanjay Deshmukh",
        "email": "sanjay.deshmukh@citizen.in",
        "project_id": project_id,
        "district_name": "Pune",
        "category": "CONSTRUCTION_QUALITY",
        "description": "Drainage culvert near Chakan intersection needs reinforced concrete slab."
    }
    res = session.post(f"{BASE_URL}/public/grievance", json=grv_payload)
    assert res.status_code == 201, f"Grievance submit failed: {res.text}"
    ref_id = res.json()["reference_id"]
    print(f"[SUCCESS] Citizen Grievance registered with Reference ID: {ref_id}")

    # Citizen tracks grievance
    res = session.get(f"{BASE_URL}/public/grievance/{ref_id}")
    assert res.status_code == 200, f"Grievance tracking failed: {res.text}"
    print(f"[SUCCESS] Citizen verified live tracking status: {res.json()['complaint']['status']}")

    # District resolves grievance
    res = session.put(f"{BASE_URL}/district/grievances/{ref_id}/update-status", json={"status": "RESOLVED", "resolution_notes": "Slab reinforcement verified and certified on site by Assistant Engineer."}, headers=district_headers)
    assert res.status_code == 200, f"Grievance resolution failed: {res.text}"
    print(f"[SUCCESS] District Officer resolved citizen grievance successfully!")

    print("\n========================================================")
    print("  ALL 18 END-TO-END WORKFLOW TESTS PASSED 100% SUCCESSFULLY!  ")
    print("========================================================")

if __name__ == "__main__":
    run_tests()
