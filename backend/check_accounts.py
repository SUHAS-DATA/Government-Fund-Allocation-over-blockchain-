import os
import sys
import time
import json
from decimal import Decimal
from web3 import Web3
from dotenv import load_dotenv

# Ensure stdout handles standard characters smoothly
if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

# Load environment variables
backend_env = os.path.join(os.path.dirname(__file__), ".env")
blockchain_env = os.path.join(os.path.dirname(__file__), "..", "blockchain", ".env")

if os.path.exists(backend_env):
    load_dotenv(backend_env)
elif os.path.exists(blockchain_env):
    load_dotenv(blockchain_env)
else:
    load_dotenv()

RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL") or os.getenv("RPC_URL", "http://127.0.0.1:7545")

def check_ganache_accounts(wait_seconds=2):
    print("=" * 75)
    print("           GANACHE BLOCKCHAIN & ACCOUNTS HEALTH CHECK")
    print("=" * 75)
    print(f"[*] Target RPC URL: {RPC_URL}")

    w3 = None
    connected = False

    # Try connecting with short retry in case Ganache is starting
    start_time = time.time()
    while time.time() - start_time < wait_seconds:
        try:
            temp_w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 2}))
            if temp_w3.is_connected():
                w3 = temp_w3
                connected = True
                break
        except Exception:
            pass
        time.sleep(1)

    if not connected:
        fallback_url = "http://127.0.0.1:8545"
        try:
            temp_w3 = Web3(Web3.HTTPProvider(fallback_url, request_kwargs={"timeout": 2}))
            if temp_w3.is_connected():
                w3 = temp_w3
                connected = True
                print(f"[+] Connected via fallback RPC: {fallback_url}")
        except Exception:
            pass

    if not connected:
        print("\n" + "!" * 75)
        print("[X] ERROR: Ganache RPC server is currently NOT responding on port 7545.")
        print("-" * 75)
        print(">> HOW TO ACTIVATE YOUR ACCOUNTS:")
        print(" 1. Ganache is already running in your Windows taskbar / background.")
        print(" 2. Open the Ganache window on your screen.")
        print(" 3. In the Ganache workspace list, click on workspace: 'RSSS'.")
        print("    (Workspace 'RSSS' contains the exact department keys used by this project).")
        print(" 4. As soon as 'RSSS' is opened, Ganache will listen on port 7545.")
        print(" 5. Then re-run this check script!")
        print("!" * 75 + "\n")
        return False

    # 2. Blockchain Node Telemetry
    try:
        chain_id = w3.eth.chain_id
        client_version = w3.client_version
        latest_block = w3.eth.block_number
        gas_price = w3.eth.gas_price
        print(f"[OK] Status         : ONLINE & CONNECTED")
        print(f"[OK] Client Version : {client_version}")
        print(f"[OK] Chain ID       : {chain_id}")
        print(f"[OK] Latest Block   : #{latest_block}")
        print(f"[OK] Gas Price      : {w3.from_wei(gas_price, 'gwei')} Gwei")
    except Exception as e:
        print(f"[!] Warning fetching node info: {e}")

    # 3. Node Accounts
    print("\n" + "=" * 75)
    print(" 1. ACCOUNTS DETECTED ON GANACHE NODE")
    print("=" * 75)

    node_accounts = []
    try:
        node_accounts = w3.eth.accounts
        print(f"Total Accounts Available on Node: {len(node_accounts)}\n")
        print(f"{'Idx':<4} | {'Account Address':<44} | {'Balance (ETH)':<14} | {'Nonce'}")
        print("-" * 75)
        for idx, acc in enumerate(node_accounts):
            bal_wei = w3.eth.get_balance(acc)
            bal_eth = w3.from_wei(bal_wei, "ether")
            nonce = w3.eth.get_transaction_count(acc)
            print(f"#{idx:<3} | {acc:<44} | {bal_eth:>9.4f} ETH | {nonce}")
    except Exception as e:
        print(f"[!] Error reading node accounts: {e}")

    # 4. Department Keys Configuration Verification
    print("\n" + "=" * 75)
    print(" 2. SYSTEM ROLES & DEPARTMENT WALLET VERIFICATION")
    print("=" * 75)

    dept_roles = [
        ("Central Admin / Finance", os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")),
        ("State Treasury Officer", os.getenv("STATE_PRIVATE_KEY")),
        ("District Authority Agency", os.getenv("DISTRICT_PRIVATE_KEY")),
        ("Registered Contractor", os.getenv("CONTRACTOR_PRIVATE_KEY")),
    ]

    all_keys_healthy = True
    validated_senders = []

    for role_name, priv_key in dept_roles:
        print(f"\n[*] Role: {role_name}")
        if not priv_key:
            print("    [X] Status: Private Key NOT set in .env!")
            all_keys_healthy = False
            continue

        try:
            acc = w3.eth.account.from_key(priv_key)
            address = acc.address
            bal_wei = w3.eth.get_balance(address)
            bal_eth = w3.from_wei(bal_wei, "ether")
            nonce = w3.eth.get_transaction_count(address)
            in_node = address.lower() in [a.lower() for a in node_accounts]

            print(f"    Public Address : {address}")
            print(f"    Balance        : {bal_eth:.4f} ETH ({bal_wei} Wei)")
            print(f"    Transactions   : {nonce} tx sent")
            print(f"    Ganache Match  : {'[OK] YES (Matched in active workspace)' if in_node else '[!] NO (Account not in active workspace)'}")

            # Crypto Signature Test
            from eth_account.messages import encode_defunct
            test_msg = "HealthCheckValidation"
            encoded_msg = encode_defunct(text=test_msg)
            signed = acc.sign_message(encoded_msg)
            recovered = w3.eth.account.recover_message(encoded_msg, signature=signed.signature)
            
            sig_ok = (recovered.lower() == address.lower())
            print(f"    ECDSA Signing  : {'[OK] PASSED (Private key operates correctly)' if sig_ok else '[X] FAILED'}")

            if bal_wei > 0 and sig_ok:
                print(f"    Account Status : [OK] HEALTHY & READY TO TRANSACT")
                validated_senders.append((role_name, address, priv_key))
            elif bal_wei == 0:
                print(f"    Account Status : [!] WARNING (Zero balance - cannot pay gas)")
                all_keys_healthy = False
            else:
                print(f"    Account Status : [X] ERROR")
                all_keys_healthy = False

        except Exception as e:
            print(f"    [X] Validation Error: {e}")
            all_keys_healthy = False

    # 5. Live Transaction Execution Test
    print("\n" + "=" * 75)
    print(" 3. LIVE ON-CHAIN TRANSACTION TEST")
    print("=" * 75)

    if validated_senders:
        role_name, test_addr, test_pk = validated_senders[0]
        print(f"Attempting live gas check and test transaction using: {role_name} ({test_addr})...")
        try:
            nonce = w3.eth.get_transaction_count(test_addr)
            tx = {
                "nonce": nonce,
                "to": test_addr,
                "value": 0,
                "gas": 21000,
                "gasPrice": w3.eth.gas_price,
                "chainId": w3.eth.chain_id,
            }
            signed_tx = w3.eth.account.sign_transaction(tx, test_pk)
            raw_tx = getattr(signed_tx, "raw_transaction", None) or getattr(signed_tx, "rawTransaction", None)
            tx_hash = w3.eth.send_raw_transaction(raw_tx)
            print(f"[OK] Transaction Broadcast! Tx Hash: {tx_hash.hex()}")
            
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=8)
            if receipt.status == 1:
                print(f"[OK] Transaction MINED SUCCESSFULLY in Block #{receipt.blockNumber} (Gas Used: {receipt.gasUsed})")
            else:
                print(f"[!] Transaction reverted with status: {receipt.status}")
        except Exception as e:
            print(f"[!] Transaction execution test encountered: {e}")
    else:
        print("[!] Skipped: No funded account available to run transaction test.")

    # 6. Smart Contract Status
    print("\n" + "=" * 75)
    print(" 4. SMART CONTRACT INTEGRITY CHECK")
    print("=" * 75)

    contract_info_path = os.path.join(os.path.dirname(__file__), "config", "contract_info.json")
    contract_addr = os.getenv("CONTRACT_ADDRESS")
    abi = None

    if os.path.exists(contract_info_path):
        try:
            with open(contract_info_path, "r") as f:
                cinfo = json.load(f)
                if not contract_addr:
                    contract_addr = cinfo.get("contractAddress")
                abi = cinfo.get("abi")
        except Exception:
            pass

    print(f"Configured Contract Address: {contract_addr}")

    if contract_addr:
        try:
            code = w3.eth.get_code(contract_addr)
            if code and len(code) > 2:
                print(f"[OK] Contract Bytecode Verified: {len(code)} bytes active on blockchain")
                if abi:
                    c = w3.eth.contract(address=contract_addr, abi=abi)
                    try:
                        admin = c.functions.superAdmin().call()
                        print(f"[OK] Smart Contract Call superAdmin(): {admin}")
                    except Exception as ce:
                        print(f"[*] Note on call: {ce}")
            else:
                print(f"[!] WARNING: No bytecode deployed at {contract_addr} on this Ganache instance.")
                print("    >> To deploy: cd blockchain && npx hardhat run scripts/deploy.js --network ganache")
        except Exception as e:
            print(f"[!] Contract inspection error: {e}")
    else:
        print("[!] No contract address configured.")

    print("\n" + "=" * 75)
    print("                         SUMMARY REPORT")
    print("=" * 75)
    print(f" Ganache Connection    : [OK] ACTIVE (RPC: {w3.provider.endpoint_uri})")
    print(f" Total Node Accounts   : {len(node_accounts)} accounts ready")
    print(f" Department Wallets    : {'[OK] ALL ACCOUNTS OPERATIONAL' if all_keys_healthy else '[!] SOME NEED ATTENTION'}")
    print("=" * 75 + "\n")
    return True

if __name__ == "__main__":
    check_ganache_accounts(wait_seconds=2)
