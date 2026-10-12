import os
import sys
import time
import hashlib
from decimal import Decimal
from web3 import Web3
from dotenv import load_dotenv

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import blockchain_service as bcs

def run_comprehensive_account_verification():
    print("=" * 80)
    print("        COMPREHENSIVE ON-CHAIN TEST FOR ALL 4 GANACHE ACCOUNTS")
    print("=" * 80)

    w3 = bcs.w3
    if not w3.is_connected():
        print("[X] ERROR: Cannot connect to Ganache RPC!")
        sys.exit(1)

    print(f"[*] Ganache RPC Connected: {bcs.RPC_URL}")
    print(f"[*] Chain ID: {w3.eth.chain_id}")
    print(f"[*] Contract Address: {bcs.contract_address}")
    print(f"[*] Current Block: #{w3.eth.block_number}\n")

    # 1. Verification of Keys, Addresses & Balances
    accounts_info = [
        ("Account #0", "FINANCE", bcs.FINANCE_ADDR, os.getenv("FINANCE_PRIVATE_KEY"), "Ministry of Finance (Central Admin)"),
        ("Account #1", "STATE", bcs.STATE_ADDR, os.getenv("STATE_PRIVATE_KEY"), "Karnataka State Treasury"),
        ("Account #2", "DISTRICT", bcs.DISTRICT_ADDR, os.getenv("DISTRICT_PRIVATE_KEY"), "Belagavi District Implementing Agency"),
        ("Account #3", "CONTRACTOR", bcs.CONTRACTOR_ADDR, os.getenv("CONTRACTOR_PRIVATE_KEY"), "Apex Infrastructure Contractors Pvt Ltd"),
    ]

    print("-" * 80)
    print(" STEP 1: VERIFYING CRYPTOGRAPHIC IDENTITIES & INITIAL BALANCES")
    print("-" * 80)

    initial_states = {}
    for label, role, expected_addr, pk, desc in accounts_info:
        acc = w3.eth.account.from_key(pk)
        bal_eth = w3.from_wei(w3.eth.get_balance(acc.address), 'ether')
        nonce = w3.eth.get_transaction_count(acc.address)
        
        assert acc.address.lower() == expected_addr.lower(), f"Address mismatch for {role}!"
        print(f"[OK] {label} ({role:<10}): {acc.address}")
        print(f"     Description : {desc}")
        print(f"     Balance     : {bal_eth:.4f} ETH | Nonce/Tx Count: {nonce}")
        
        initial_states[role] = {
            "address": acc.address,
            "initial_nonce": nonce,
            "initial_bal": bal_eth
        }

    print("\n" + "-" * 80)
    print(" STEP 2: EXECUTING LIVE ON-CHAIN MULTI-TIER WORKFLOW")
    print("-" * 80)

    test_suffix = str(int(time.time()))[-6:]
    alloc_id = f"ALLOC-LIVE-{test_suffix}"
    trf_id = f"TRF-LIVE-{test_suffix}"
    dist_alloc_id = f"DIST-LIVE-{test_suffix}"
    project_id = f"PRJ-LIVE-{test_suffix}"

    # --- Test 1: Account #0 (Finance) ---
    print(f"\n[Test 2.1] Account #0 (Finance) -> Budget Allocation & State Disbursal")
    tx1 = bcs.record_budget_allocation_onchain(
        alloc_id, "National Smart Highway Project", "Transport & Highways", 100000000
    )
    print(f"  [Tx 1] Budget Allocation on-chain:")
    print(f"         Tx Hash : {tx1['tx_hash']}")
    print(f"         Block   : #{tx1['block_number']} (Gas used: {tx1['gas_used']})")
    print(f"         Sender  : {tx1['from_address']} [Matches Account #0]")
    assert tx1['from_address'].lower() == bcs.FINANCE_ADDR.lower()
    assert tx1['status'] == "SUCCESS"

    tx2 = bcs.record_state_transfer_onchain(
        trf_id, alloc_id, "Karnataka", 50000000, receiver_address=bcs.STATE_ADDR
    )
    print(f"  [Tx 2] Transfer to State Treasury:")
    print(f"         Tx Hash : {tx2['tx_hash']}")
    print(f"         Block   : #{tx2['block_number']} (Gas used: {tx2['gas_used']})")
    print(f"         Sender  : {tx2['from_address']} [Matches Account #0]")
    assert tx2['from_address'].lower() == bcs.FINANCE_ADDR.lower()
    assert tx2['status'] == "SUCCESS"

    # --- Test 2: Account #1 (State) ---
    print(f"\n[Test 2.2] Account #1 (State Treasury) -> Allocate to District")
    tx3 = bcs.record_district_allocation_onchain(
        dist_alloc_id, trf_id, "Belagavi", 20000000, receiver_address=bcs.DISTRICT_ADDR
    )
    print(f"  [Tx 3] District Allocation on-chain:")
    print(f"         Tx Hash : {tx3['tx_hash']}")
    print(f"         Block   : #{tx3['block_number']} (Gas used: {tx3['gas_used']})")
    print(f"         Sender  : {tx3['from_address']} [Matches Account #1]")
    assert tx3['from_address'].lower() == bcs.STATE_ADDR.lower(), f"Expected State {bcs.STATE_ADDR}, got {tx3['from_address']}"
    assert tx3['status'] == "SUCCESS"

    # --- Test 3: Account #2 (District Agency) ---
    print(f"\n[Test 2.3] Account #2 (District Agency) -> Create Project Escrow & Set Milestones")
    tx4 = bcs.create_project_escrow_onchain(
        project_id, "Belagavi Ring Road Phase 1", bcs.CONTRACTOR_ADDR, 20000000
    )
    print(f"  [Tx 4] Project Escrow Creation:")
    print(f"         Tx Hash : {tx4['tx_hash']}")
    print(f"         Block   : #{tx4['block_number']} (Gas used: {tx4['gas_used']})")
    print(f"         Sender  : {tx4['from_address']} [Matches Account #2]")
    assert tx4['from_address'].lower() == bcs.DISTRICT_ADDR.lower()
    assert tx4['status'] == "SUCCESS"

    tx5 = bcs.set_project_milestones_onchain(
        project_id, [10000000, 10000000]
    )
    print(f"  [Tx 5] Set Project Milestones:")
    print(f"         Tx Hash : {tx5['tx_hash']}")
    print(f"         Block   : #{tx5['block_number']} (Gas used: {tx5['gas_used']})")
    print(f"         Sender  : {tx5['from_address']} [Matches Account #2]")
    assert tx5['from_address'].lower() == bcs.DISTRICT_ADDR.lower()
    assert tx5['status'] == "SUCCESS"

    # --- Test 4: Account #3 (Contractor) ---
    print(f"\n[Test 2.4] Account #3 (Contractor) -> Submit Milestone Work Evidence Hash")
    dummy_proof_hash = hashlib.sha256(f"Evidence-{test_suffix}".encode()).hexdigest()
    tx6 = bcs.submit_milestone_progress_onchain(
        project_id, 0, dummy_proof_hash, 100
    )
    print(f"  [Tx 6] Submit Milestone Progress Proof:")
    print(f"         Tx Hash : {tx6['tx_hash']}")
    print(f"         Block   : #{tx6['block_number']} (Gas used: {tx6['gas_used']})")
    print(f"         Sender  : {tx6['from_address']} [Matches Account #3]")
    assert tx6['from_address'].lower() == bcs.CONTRACTOR_ADDR.lower()
    assert tx6['status'] == "SUCCESS"

    # --- Test 5: Account #2 (District Agency) releases payment ---
    print(f"\n[Test 2.5] Account #2 (District Agency) -> Release Milestone Payment")
    tx7 = bcs.release_milestone_payment_onchain(
        project_id, 0
    )
    print(f"  [Tx 7] Milestone Payment Release:")
    print(f"         Tx Hash : {tx7['tx_hash']}")
    print(f"         Block   : #{tx7['block_number']} (Gas used: {tx7['gas_used']})")
    print(f"         Sender  : {tx7['from_address']} [Matches Account #2]")
    assert tx7['from_address'].lower() == bcs.DISTRICT_ADDR.lower()
    assert tx7['status'] == "SUCCESS"

    print("\n" + "=" * 80)
    print(" STEP 3: FINAL NONCE & TRANSACTION BROADCAST CONFIRMATION")
    print("=" * 80)

    for label, role, addr, pk, desc in accounts_info:
        final_nonce = w3.eth.get_transaction_count(addr)
        initial_nonce = initial_states[role]["initial_nonce"]
        diff = final_nonce - initial_nonce
        bal = w3.from_wei(w3.eth.get_balance(addr), 'ether')
        print(f"[VERIFIED] {label} ({role:<10}): {addr}")
        print(f"           New Tx Count: {final_nonce} (+{diff} transactions mined in this test run)")
        print(f"           Balance     : {bal:.4f} ETH")
        assert diff > 0, f"Account {label} did not execute any new transaction!"

    print("\n" + "=" * 80)
    print(" >>> ALL 4 ACCOUNTS VERIFIED AND FULLY OPERATIONAL ON GANACHE! <<<")
    print("=" * 80)

if __name__ == "__main__":
    run_comprehensive_account_verification()
