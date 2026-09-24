import os
import requests
import json
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

PORT = os.getenv("PORT", "5000")
BASE_URL = os.getenv("API_BASE_URL", f"http://127.0.0.1:{PORT}/api")
try:
    requests.get(f"{BASE_URL}/health", timeout=0.5)
except Exception:
    try:
        requests.get("http://127.0.0.1:8000/api/health", timeout=0.5)
        BASE_URL = "http://127.0.0.1:8000/api"
    except Exception:
        pass

RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:7545")
w3 = Web3(Web3.HTTPProvider(RPC_URL))

def run_test():
    print("=======================================================================")
    print("   RUNNING MULTI-TIER DEPARTMENT BLOCKCHAIN WALLET FLOW TEST")
    print("=======================================================================\n")

    # 1. Login as Super Admin to ensure a Central Budget Allocation exists
    print("[Step 1] Logging in as Super Admin...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@govtfund.gov.in",
        "password": "Admin@123"
    })
    admin_data = res.json()
    assert res.status_code == 200, f"Admin login failed: {admin_data}"
    admin_token = admin_data["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Register Flagship Scheme if not present
    print("Registering PMGSY Scheme...")
    res = requests.post(f"{BASE_URL}/admin/schemes", headers=admin_headers, json={
        "code": "PMGSY",
        "name": "Pradhan Mantri Gram Sadak Yojana",
        "department_code": "INFRA",
        "department_name": "Road Transport & Infrastructure",
        "target_budget": 5000000000.0,
        "description": "National rural connectivity infrastructure scheme"
    })
    print(f"Register Scheme Response: {res.status_code}")

    # Create Central Budget Allocation of 100 Crore
    alloc_id = f"ALC-TEST-{os.urandom(3).hex().upper()}"
    print(f"Creating Central Allocation: {alloc_id} (INR 100 Cr)...")
    res = requests.post(f"{BASE_URL}/admin/budget/allocate", headers=admin_headers, json={
        "allocation_id": alloc_id,
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
        "department": "Road Transport & Infrastructure",
        "amount": 1000000000,
        "financial_year": "2026-27"
    })
    print(f"Central Allocation Response: {res.status_code}")

    # 2. Login as Finance Authority
    print("\n[Step 2] Logging in as Finance Authority...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "finance@govtfund.gov.in",
        "password": "Finance@123"
    })
    fin_data = res.json()
    assert res.status_code == 200, f"Finance login failed: {fin_data}"
    fin_token = fin_data["token"]
    fin_headers = {"Authorization": f"Bearer {fin_token}"}

    # Step 1 Transfer: Finance -> State (INR 10,00,00,000 / 10 Crore)
    print("\n>>> Transfer 1: Finance transfers INR 10,00,00,000 (10 Cr) to Karnataka State...")
    res = requests.post(f"{BASE_URL}/finance/approve-and-transfer", headers=fin_headers, json={
        "allocation_id": alloc_id,
        "state_code": "KA",
        "state_name": "Karnataka",
        "amount": 100000000,
        "sign_off_note": "Central Finance Authority sanction to Karnataka State Treasury."
    })
    trf1_data = res.json()
    print("Transfer 1 Response Status:", res.status_code)
    assert res.status_code == 201, f"Transfer 1 failed: {trf1_data}"
    trf1_id = trf1_data["transfer"]["transfer_id"]
    tx1_hash = trf1_data["blockchain"]["tx_hash"]

    # 3. Login as State Authority (Karnataka)
    print("\n[Step 3] Logging in as Karnataka State Authority...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "karnataka@govtfund.gov.in",
        "password": "State@123"
    })
    state_data = res.json()
    assert res.status_code == 200, f"State login failed: {state_data}"
    state_token = state_data["token"]
    state_headers = {"Authorization": f"Bearer {state_token}"}

    # Step 2 Transfer: State -> District (INR 6,00,00,000 / 6 Crore)
    print("\n>>> Transfer 2: Karnataka State transfers INR 6,00,00,000 (6 Cr) to Belagavi District...")
    res = requests.post(f"{BASE_URL}/state/allocate-to-district", headers=state_headers, json={
        "transfer_id": trf1_id,
        "district_name": "Belagavi",
        "amount": 60000000
    })
    trf2_data = res.json()
    print("Transfer 2 Response Status:", res.status_code)
    assert res.status_code == 201, f"Transfer 2 failed: {trf2_data}"
    tx2_hash = trf2_data["blockchain"]["tx_hash"]

    # 4. Login as District Officer (Belagavi)
    print("\n[Step 4] Logging in as Belagavi District Officer...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "belagavi@govtfund.gov.in",
        "password": "Dist@123"
    })
    dist_data = res.json()
    assert res.status_code == 200, f"District login failed: {dist_data}"
    dist_token = dist_data["token"]
    dist_headers = {"Authorization": f"Bearer {dist_token}"}

    # Create District Project for 4 Crore
    print("\nCreating Project under Scheme (INR 4 Crore budget)...")
    res = requests.post(f"{BASE_URL}/district/projects", headers=dist_headers, json={
        "name": "Belagavi Rural Concrete Road Project",
        "scheme_name": "Pradhan Mantri Gram Sadak Yojana (PMGSY)",
        "district_name": "Belagavi",
        "total_budget": 40000000,
        "department": "Rural Road Infrastructure"
    })
    proj_data = res.json()
    print("Create Project Response Status:", res.status_code)
    assert res.status_code == 201, f"Project creation failed: {proj_data}"
    project_id = proj_data["project"]["project_id"]

    # Assign Contractor
    print(f"\nAssigning Contractor to project {project_id}...")
    res = requests.post(f"{BASE_URL}/district/projects/{project_id}/assign-contractor", headers=dist_headers, json={
        "contractor_id": "contractor@apexinfra.gov.in"
    })
    print("Assign Contractor Response Status:", res.status_code)

    # Login as Contractor and Accept Project (which initializes 3 phases)
    print("\nLogging in as Contractor to accept project assignment...")
    res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "contractor@apexinfra.gov.in",
        "password": "Contractor@123"
    })
    c_data = res.json()
    c_token = c_data["token"]
    c_headers = {"Authorization": f"Bearer {c_token}"}

    res = requests.post(f"{BASE_URL}/contractor/projects/{project_id}/accept", headers=c_headers)
    print("Accept Project Response Status:", res.status_code)

    # Step 3 Transfer: District -> Contractor (INR 4,00,00,000 / 4 Crore)
    print("\n>>> Transfer 3: District transfers INR 4,00,00,000 (4 Cr) to Contractor Concessionaire...")
    res = requests.post(f"{BASE_URL}/district/transfer-to-contractor", headers=dist_headers, json={
        "project_id": project_id,
        "amount": 40000000,
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "contractor_wallet": "0xd49155782d0C91e4fF69024ACf6F7811467800C2",
        "notes": "Direct District Fund Disbursal: Belagavi District Agency to Apex Infrastructure Concessionaire"
    })
    trf3_data = res.json()
    print("Transfer 3 Response Status:", res.status_code)
    assert res.status_code == 201, f"Transfer 3 failed: {trf3_data}"
    tx3_hash = trf3_data["blockchain"]["tx_hash"]

    # 5. On-Chain Verification of FROM and TO addresses for each transaction in Ganache
    print("\n=======================================================================")
    print("   ON-CHAIN BLOCKCHAIN VERIFICATION IN GANACHE")
    print("=======================================================================\n")

    contract_addr = os.getenv("CONTRACT_ADDRESS", "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20")

    tx1 = w3.eth.get_transaction(tx1_hash)
    tx2 = w3.eth.get_transaction(tx2_hash)
    tx3 = w3.eth.get_transaction(tx3_hash)

    print("Transaction 1: Finance (₹10 Crore) -> State:")
    print(f"  Tx Hash: {tx1_hash}")
    print(f"  FROM:    {tx1['from']}  [Expected: Finance Account 0: 0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B]")
    print(f"  TO:      {tx1['to']}    [Smart Contract Address: {contract_addr}]")
    assert tx1['from'].lower() == "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B".lower(), f"Tx 1 FROM mismatch! Got {tx1['from']}"
    assert tx1['to'].lower() == contract_addr.lower(), f"Tx 1 TO mismatch! Got {tx1['to']}"

    print("\nTransaction 2: State (₹6 Crore) -> District:")
    print(f"  Tx Hash: {tx2_hash}")
    print(f"  FROM:    {tx2['from']}  [Expected: State Account 1: 0x3bE9Fb1473BcAEe6790dBb9556A8C9637eCC54bC]")
    print(f"  TO:      {tx2['to']}    [Smart Contract Address: {contract_addr}]")
    assert tx2['from'].lower() == "0x3bE9Fb1473BcAEe6790dBb9556A8C9637eCC54bC".lower(), f"Tx 2 FROM mismatch! Got {tx2['from']}"
    assert tx2['to'].lower() == contract_addr.lower(), f"Tx 2 TO mismatch! Got {tx2['to']}"

    print("\nTransaction 3: District (₹4 Crore) -> Contractor:")
    print(f"  Tx Hash: {tx3_hash}")
    print(f"  FROM:    {tx3['from']}  [Expected: District Account 2: 0x2Db964805531b2cc0Cb6961AF0f7d7489F1e4Aa9]")
    print(f"  TO:      {tx3['to']}    [Smart Contract Address: {contract_addr}]")
    assert tx3['from'].lower() == "0x2Db964805531b2cc0Cb6961AF0f7d7489F1e4Aa9".lower(), f"Tx 3 FROM mismatch! Got {tx3['from']}"
    assert tx3['to'].lower() == contract_addr.lower(), f"Tx 3 TO mismatch! Got {tx3['to']}"

    # 6. Verify MongoDB Records
    print("\n=======================================================================")
    print("   MONGODB DATABASE VERIFICATION")
    print("=======================================================================\n")
    from database import db
    t1_doc = db.state_transfers.find_one({"transfer_id": trf1_id})
    print(f"State Transfer in MongoDB: TxHash={t1_doc.get('blockchain_tx_hash')}, Amount=₹{t1_doc.get('amount'):,.0f}, Sender={t1_doc.get('sender_address')}, Receiver={t1_doc.get('receiver_address')}")
    assert t1_doc is not None and t1_doc.get("blockchain_tx_hash") == tx1_hash

    t2_doc = db.district_allocations.find_one({"transfer_id": trf1_id})
    print(f"District Allocation in MongoDB: TxHash={t2_doc.get('blockchain_tx_hash')}, Amount=₹{t2_doc.get('amount'):,.0f}, Sender={t2_doc.get('sender_address')}, Receiver={t2_doc.get('receiver_address')}")
    assert t2_doc is not None and t2_doc.get("blockchain_tx_hash") == tx2_hash

    t3_doc = db.contractor_transfers.find_one({"project_id": project_id})
    print(f"Contractor Transfer in MongoDB: TxHash={t3_doc.get('blockchain_tx_hash')}, Amount=₹{t3_doc.get('amount'):,.0f}, Sender={t3_doc.get('sender_address')}, Receiver={t3_doc.get('receiver_address')}")
    assert t3_doc is not None and t3_doc.get("blockchain_tx_hash") == tx3_hash

    print("\n=======================================================================")
    print("SUCCESS: ALL 3 TRANSACTIONS VERIFIED ON BLOCKCHAIN WITH DIFFERENT WALLETS!")
    print("         AND ALL 3 TRANSFERS CONFIRMED IN MONGODB WITH AUDIT TRAIL!")
    print("=======================================================================")

if __name__ == "__main__":
    run_test()
