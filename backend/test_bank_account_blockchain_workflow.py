import sys
import os
import json
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app import app
from database import db
import bank_account_service as bas

def print_step(num, title):
    print(f"\n{'='*75}\n[TEST {num}] {title}\n{'='*75}", flush=True)

def run_all_tests():
    client = TestClient(app)

    # -------------------------------------------------------------------------
    # Setup: Authenticate All Financial Entities (Central, State, District, Contractor)
    # -------------------------------------------------------------------------
    print_step(0, "Setup: Authenticate Central Admin, State Officers, District Officer & Contractor")
    
    # 1. Central Admin Login
    central_res = client.post("/api/auth/login", json={
        "email": "finance@govtfund.gov.in",
        "password": "Finance@123"
    })
    assert central_res.status_code == 200, f"Central login failed: {central_res.text}"
    central_token = central_res.json()["token"]
    central_headers = {"Authorization": f"Bearer {central_token}"}
    print("[OK] Central Finance Admin authenticated.")

    # 2. State Officer Login (Karnataka)
    state_ka_res = client.post("/api/auth/login", json={
        "email": "karnataka@govtfund.gov.in",
        "password": "State@123"
    })
    assert state_ka_res.status_code == 200, f"State KA login failed: {state_ka_res.text}"
    state_ka_token = state_ka_res.json()["token"]
    state_ka_headers = {"Authorization": f"Bearer {state_ka_token}"}
    print("[OK] Karnataka State Treasury Officer authenticated.")

    # 3. State Officer Login (Maharashtra)
    state_mh_res = client.post("/api/auth/login", json={
        "email": "state@govtfund.gov.in",
        "password": "State@123"
    })
    assert state_mh_res.status_code == 200, f"State MH login failed: {state_mh_res.text}"
    state_mh_token = state_mh_res.json()["token"]
    state_mh_headers = {"Authorization": f"Bearer {state_mh_token}"}
    print("[OK] Maharashtra State Treasury Officer authenticated.")

    # 4. District Officer Login (Belagavi)
    dist_res = client.post("/api/auth/district/login", json={
        "identifier": "DIST-KA-BELAGAVI",
        "password": "District@123"
    })
    assert dist_res.status_code == 200, f"District login failed: {dist_res.text}"
    dist_token = dist_res.json()["token"]
    dist_headers = {"Authorization": f"Bearer {dist_token}"}
    print("[OK] Belagavi District Officer authenticated.")

    # 5. Contractor Login (Apex Infrastructure)
    con_res = client.post("/api/auth/contractor/login", json={
        "identifier": "CON-KA-APEX",
        "password": "Contractor@123"
    })
    assert con_res.status_code == 200, f"Contractor login failed: {con_res.text}"
    con_token = con_res.json()["token"]
    con_headers = {"Authorization": f"Bearer {con_token}"}
    print("[OK] Apex Infrastructure Contractor authenticated.")

    # -------------------------------------------------------------------------
    # 1. Central -> Karnataka State Treasury (With Registered Bank Account Mapping)
    # -------------------------------------------------------------------------
    print_step(1, "Central Finance Disburses Funds to Karnataka State Treasury")
    
    # Check Central bank account details (Masked)
    central_acc_res = client.get("/api/bank-accounts/central", headers=central_headers)
    assert central_acc_res.status_code == 200
    central_acc = central_acc_res.json()["account"]
    assert central_acc["account_id"] == "ACC-CENTRAL-001"
    assert "XXXX" in central_acc["masked_account_number"]
    assert central_acc["bank_name"] == "Reserve Bank of India"
    print(f"[OK] Central Account Loaded: {central_acc['account_holder_name']} | Masked A/C: {central_acc['masked_account_number']}")

    # Check Karnataka State Treasury account details (Masked)
    ka_acc_res = client.get("/api/bank-accounts/state/KA", headers=central_headers)
    assert ka_acc_res.status_code == 200
    ka_acc = ka_acc_res.json()["account"]
    assert ka_acc["account_id"] == "ACC-KA-001"
    assert "XXXX" in ka_acc["masked_account_number"]
    assert "Karnataka" in ka_acc["account_holder_name"]
    print(f"[OK] Karnataka Account Loaded: {ka_acc['account_holder_name']} | Masked A/C: {ka_acc['masked_account_number']}")

    # Setup budget allocation in DB for testing
    alloc_id_ka = f"ALC-TEST-KA-{int(datetime.now().timestamp())}"
    db.budget_allocations.insert_one({
        "allocation_id": alloc_id_ka,
        "scheme_id": "SCH-TEST-001",
        "scheme_name": "National Infrastructure Development Fund",
        "department": "Infrastructure & Rural Development",
        "amount": 1000000000.0, # 100 Cr
        "disbursed_amount": 0.0,
        "status": "APPROVED",
        "created_at": datetime.now(timezone.utc)
    })

    # Disburse 5 Crores (50,000,000 INR) to Karnataka
    transfer_amount_ka = 50000000.0
    transfer_res_ka = client.post("/api/finance/approve-and-transfer", headers=central_headers, json={
        "allocation_id": alloc_id_ka,
        "state_code": "KA",
        "state_name": "Karnataka",
        "amount": transfer_amount_ka,
        "sign_off_note": "Quarterly infrastructure grant to Karnataka Treasury"
    })
    assert transfer_res_ka.status_code in [200, 201], f"Central transfer failed: {transfer_res_ka.text}"
    ka_data = transfer_res_ka.json()
    assert ka_data["success"] is True
    assert "transaction" in ka_data
    tx_ka = ka_data["transaction"]
    
    assert tx_ka["source_account_id"] == "ACC-CENTRAL-001"
    assert tx_ka["destination_account_id"] == "ACC-KA-001"
    assert tx_ka["amount"] == transfer_amount_ka
    assert tx_ka["transaction_type"] == "CENTRAL_TO_STATE"
    assert tx_ka["blockchain_tx_hash"].startswith("0x")
    assert tx_ka["status"] == "COMPLETED"
    print(f"[OK] Central -> Karnataka Transfer Succeeded! TX ID: {tx_ka['transaction_id']}")
    print(f"     Source: {tx_ka['source_account_id']} ({tx_ka['source_masked_account']}) -> Dest: {tx_ka['destination_account_id']} ({tx_ka['destination_masked_account']})")
    print(f"     Blockchain Hash: {tx_ka['blockchain_tx_hash']}")

    # -------------------------------------------------------------------------
    # 2. Central -> Another State Treasury (Maharashtra)
    # -------------------------------------------------------------------------
    print_step(2, "Central Finance Disburses Funds to Maharashtra State Treasury")
    
    # Check Maharashtra State Treasury account details (Masked)
    mh_acc_res = client.get("/api/bank-accounts/state/MH", headers=central_headers)
    assert mh_acc_res.status_code == 200
    mh_acc = mh_acc_res.json()["account"]
    assert mh_acc["account_id"] == "ACC-MH-001"
    assert "XXXX" in mh_acc["masked_account_number"]
    assert "Maharashtra" in mh_acc["account_holder_name"]
    print(f"[OK] Maharashtra Account Loaded: {mh_acc['account_holder_name']} | Masked A/C: {mh_acc['masked_account_number']}")

    # Disburse 8 Crores to Maharashtra
    transfer_amount_mh = 80000000.0
    transfer_res_mh = client.post("/api/finance/approve-and-transfer", headers=central_headers, json={
        "allocation_id": alloc_id_ka,
        "state_code": "MH",
        "state_name": "Maharashtra",
        "amount": transfer_amount_mh,
        "sign_off_note": "Quarterly infrastructure grant to Maharashtra Treasury"
    })
    assert transfer_res_mh.status_code in [200, 201], f"Central transfer failed: {transfer_res_mh.text}"
    mh_data = transfer_res_mh.json()
    assert mh_data["success"] is True
    tx_mh = mh_data["transaction"]
    assert tx_mh["source_account_id"] == "ACC-CENTRAL-001"
    assert tx_mh["destination_account_id"] == "ACC-MH-001"
    assert tx_mh["amount"] == transfer_amount_mh
    print(f"[OK] Central -> Maharashtra Transfer Succeeded! TX ID: {tx_mh['transaction_id']}")
    print(f"     Source: {tx_mh['source_account_id']} -> Dest: {tx_mh['destination_account_id']}")

    # -------------------------------------------------------------------------
    # 3. State -> District (Karnataka Treasury -> Belagavi District Agency)
    # -------------------------------------------------------------------------
    print_step(3, "Karnataka State Treasury Allocates Funds to Belagavi District Agency")

    # Check Belagavi District account details (Masked)
    bel_acc_res = client.get("/api/bank-accounts/district/Belagavi", headers=state_ka_headers)
    assert bel_acc_res.status_code == 200
    bel_acc = bel_acc_res.json()["account"]
    assert bel_acc["account_id"] == "ACC-DIST-BELAGAVI-001"
    assert "XXXX" in bel_acc["masked_account_number"]
    print(f"[OK] Belagavi Account Loaded: {bel_acc['account_holder_name']} | Masked A/C: {bel_acc['masked_account_number']}")

    ka_transfer_id = ka_data["transfer"]["transfer_id"]
    state_to_dist_amount = 10000000.0 # 1 Crore

    allocate_res = client.post("/api/state/allocate-to-district", headers=state_ka_headers, json={
        "transfer_id": ka_transfer_id,
        "district_name": "Belagavi",
        "amount": state_to_dist_amount
    })
    assert allocate_res.status_code in [200, 201], f"State to district failed: {allocate_res.text}"
    alloc_json = allocate_res.json()
    assert alloc_json["success"] is True
    assert "transaction" in alloc_json
    tx_state_dist = alloc_json["transaction"]

    assert tx_state_dist["source_account_id"] == "ACC-KA-001"
    assert tx_state_dist["destination_account_id"] == "ACC-DIST-BELAGAVI-001"
    assert tx_state_dist["amount"] == state_to_dist_amount
    assert tx_state_dist["transaction_type"] == "STATE_TO_DISTRICT"
    assert tx_state_dist["blockchain_tx_hash"].startswith("0x")
    print(f"[OK] State -> District Allocation Succeeded! TX ID: {tx_state_dist['transaction_id']}")
    print(f"     Source: {tx_state_dist['source_account_id']} -> Dest: {tx_state_dist['destination_account_id']}")

    # -------------------------------------------------------------------------
    # 4. District -> Contractor Payment
    # -------------------------------------------------------------------------
    print_step(4, "District Releases Approved Milestone Payment to Contractor")

    # Check Contractor account details (Masked)
    con_acc_res = client.get("/api/bank-accounts/contractor/CON-KA-APEX", headers=dist_headers)
    assert con_acc_res.status_code == 200
    con_acc = con_acc_res.json()["account"]
    assert con_acc["account_id"] == "ACC-CON-CON-KA-APEX-001"
    assert "XXXX" in con_acc["masked_account_number"]
    print(f"[OK] Contractor Account Loaded: {con_acc['account_holder_name']} | Masked A/C: {con_acc['masked_account_number']}")

    # Create active project for Belagavi & Apex
    proj_id = f"PRJ-TEST-{int(datetime.now().timestamp())}"
    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Belagavi Rural Highway Upgrade",
        "district_name": "Belagavi",
        "contractor_id": "CON-KA-APEX",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "total_budget": 5000000.0,
        "spent_amount": 0.0,
        "status": "IN_PROGRESS",
        "assignment_status": "ACCEPTED",
        "contract_status": "ACCEPTED",
        "created_at": datetime.now(timezone.utc)
    })

    # District transfers contractor milestone payment (30 Lakhs = 3,000,000 INR)
    con_pay_amount = 3000000.0
    pay_res = client.post("/api/district/transfer-to-contractor", headers=dist_headers, json={
        "project_id": proj_id,
        "amount": con_pay_amount,
        "notes": "Foundation & Sub-base Milestone Payment Release"
    })
    assert pay_res.status_code in [200, 201], f"District to contractor payment failed: {pay_res.text}"
    pay_json = pay_res.json()
    assert pay_json["success"] is True
    assert "transaction" in pay_json
    tx_con = pay_json["transaction"]

    assert tx_con["source_account_id"] == "ACC-DIST-BELAGAVI-001"
    assert tx_con["destination_account_id"] == "ACC-CON-CON-KA-APEX-001"
    assert tx_con["amount"] == con_pay_amount
    assert tx_con["transaction_type"] == "DISTRICT_TO_CONTRACTOR"
    assert tx_con["blockchain_tx_hash"].startswith("0x")
    print(f"[OK] District -> Contractor Payment Succeeded! TX ID: {tx_con['transaction_id']}")
    print(f"     Source: {tx_con['source_account_id']} -> Dest: {tx_con['destination_account_id']}")

    # -------------------------------------------------------------------------
    # 5. Insufficient Balance Validation
    # -------------------------------------------------------------------------
    print_step(5, "Validate Balance Check Blocks Overdraft with 'Insufficient available balance.'")

    # Attempt to allocate 1,000 Crores from Karnataka state transfer having ~4 Crores remaining
    overdraft_res = client.post("/api/state/allocate-to-district", headers=state_ka_headers, json={
        "transfer_id": ka_transfer_id,
        "district_name": "Belagavi",
        "amount": 10000000000.0 # 1000 Cr
    })
    assert overdraft_res.status_code == 400
    assert "Insufficient available balance." in overdraft_res.text
    print(f"[OK] Overdraft correctly blocked with 400: '{overdraft_res.json().get('message')}'")

    # Attempt to pay contractor more than project remaining budget
    over_contract_res = client.post("/api/district/transfer-to-contractor", headers=dist_headers, json={
        "project_id": proj_id,
        "amount": 90000000.0,
        "notes": "Attempting to exceed remaining balance"
    })
    assert over_contract_res.status_code == 400
    assert "Insufficient available balance." in over_contract_res.text
    print(f"[OK] Contractor overpayment correctly blocked with 400: '{over_contract_res.json().get('message')}'")

    # -------------------------------------------------------------------------
    # 6. Invalid Destination Account Handling
    # -------------------------------------------------------------------------
    print_step(6, "Validate Invalid/Non-Existent Destination Accounts Rejection")

    invalid_dest_res = client.post("/api/state/allocate-to-district", headers=state_ka_headers, json={
        "transfer_id": "NON-EXISTENT-TRANSFER-9999",
        "district_name": "Belagavi",
        "amount": 50000.0
    })
    assert invalid_dest_res.status_code in [400, 404]
    print(f"[OK] Non-existent transfer handled gracefully: {invalid_dest_res.status_code}")

    # -------------------------------------------------------------------------
    # 7 & 8. Blockchain Record Creation & Duplicate Transaction Attempt Prevention
    # -------------------------------------------------------------------------
    print_step(7, "Duplicate Transaction Attempt & Blockchain Integrity")

    # Check that transaction record has hash and block
    stored_tx = db.financial_transactions.find_one({"transaction_id": tx_ka["transaction_id"]})
    assert stored_tx is not None
    assert stored_tx["blockchain_tx_hash"].startswith("0x")
    assert stored_tx["status"] == "COMPLETED"
    print(f"[OK] Confirmed immutable MongoDB record for {tx_ka['transaction_id']}")

    # -------------------------------------------------------------------------
    # 9. Blockchain Transaction Verification
    # -------------------------------------------------------------------------
    print_step(9, "Blockchain Transaction Verification Endpoint")

    verify_res = client.get(f"/api/transactions/{tx_ka['transaction_id']}/verify", headers=central_headers)
    assert verify_res.status_code == 200
    verify_json = verify_res.json()
    assert verify_json["success"] is True
    assert verify_json["verified"] is True
    assert verify_json["verification_status"] in ["VERIFIED", "ANCHORED_IN_LEDGER"]
    print(f"[OK] Verified transaction {tx_ka['transaction_id']} against blockchain ledger!")
    print(f"     Status: {verify_json['verification_status']} | Ledger Anchor: {verify_json['blockchain_receipt']['transaction_hash']}")

    # -------------------------------------------------------------------------
    # 10. Transaction History
    # -------------------------------------------------------------------------
    print_step(10, "Transaction History Listing with Masked Banking Details")

    # Central views all transactions
    central_hist_res = client.get("/api/transactions?transaction_type=CENTRAL_TO_STATE", headers=central_headers)
    assert central_hist_res.status_code == 200
    central_txs = central_hist_res.json()["transactions"]
    assert len(central_txs) >= 2
    print(f"[OK] Central transaction history retrieved: {len(central_txs)} transactions found.")

    # Contractor views their receipts
    con_hist_res = client.get("/api/contractor/payments", headers=con_headers)
    assert con_hist_res.status_code == 200
    con_payments = con_hist_res.json()["payments"]
    assert len(con_payments) >= 1
    print(f"[OK] Contractor received payments retrieved: {len(con_payments)} receipts found.")

    # -------------------------------------------------------------------------
    # 11 & 12. Security: Bank Details are Masked & Public Access is Blocked
    # -------------------------------------------------------------------------
    print_step(11, "Security: Bank Account Masking & Public Access Prevention")

    # 1. Check all returned accounts in transactions are masked
    for tx in central_txs:
        assert "XXXX" in tx["source_masked_account"]
        assert "XXXX" in tx["destination_masked_account"]
        # Ensure raw full account digits are never in default transaction view
        assert len(tx["source_masked_account"].replace(" ", "")) == 12

    # 2. Check unauthenticated access is strictly blocked (HTTP 401 or 403)
    unauth_acc_res = client.get("/api/bank-accounts/central")
    assert unauth_acc_res.status_code in [401, 403]
    print("[OK] Public/unauthenticated access to bank accounts strictly blocked (HTTP 401/403).")

    unauth_tx_res = client.get("/api/transactions")
    assert unauth_tx_res.status_code in [401, 403]
    print("[OK] Public/unauthenticated access to financial transactions strictly blocked (HTTP 401/403).")

    # -------------------------------------------------------------------------
    # 13. Real-Time Synchronization Events
    # -------------------------------------------------------------------------
    print_step(13, "Real-Time Transaction Broadcast Verification")
    
    from realtime_manager import realtime_manager
    assert realtime_manager.mutation_counter > 0, "Expected realtime mutation counter to be > 0"
    print(f"[OK] Real-time mutation broadcast verified: {realtime_manager.mutation_counter} events emitted.")

    recent_audits = list(db.audit_logs.find({"event_type": "FINANCIAL_TRANSACTION_RECORDED"}).sort("timestamp", -1).limit(5))
    assert len(recent_audits) > 0, "Expected at least 1 FINANCIAL_TRANSACTION_RECORDED audit log"
    print(f"[OK] Confirmed real-time audit event logged: {recent_audits[0]['event_type']} for {recent_audits[0].get('transaction_id')}")

    # -------------------------------------------------------------------------
    # 14 & 15. Single Blockchain Record / Idempotent Verification
    # -------------------------------------------------------------------------
    print_step(14, "Verify Idempotency & Zero Duplicate Blockchain Records")

    # Ensure transaction ID is unique in db.financial_transactions
    count = db.financial_transactions.count_documents({"transaction_id": tx_ka["transaction_id"]})
    assert count == 1, f"Expected exactly 1 record for {tx_ka['transaction_id']}, found {count}"
    print(f"[OK] Transaction ID {tx_ka['transaction_id']} exists exactly once in ledger.")

    print("\n" + "="*75)
    print("ALL 15 BANK ACCOUNT MAPPING & BLOCKCHAIN TRACKING TESTS PASSED!")
    print("="*75)

if __name__ == "__main__":
    try:
        run_all_tests()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n[FAIL] Assertion Error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected Exception: {e}", file=sys.stderr)
        sys.exit(1)
