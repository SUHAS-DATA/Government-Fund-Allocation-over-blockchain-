import os
import json
import hashlib
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL", "http://127.0.0.1:7545")
PRIVATE_KEY = os.getenv("BLOCKCHAIN_PRIVATE_KEY", "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba")

# Load Contract Info
contract_info_path = os.path.join(os.path.dirname(__file__), "config", "contract_info.json")
contract_address = None
contract_abi = None

if os.path.exists(contract_info_path):
    with open(contract_info_path, "r") as f:
        info = json.load(f)
        contract_address = info.get("contractAddress")
        contract_abi = info.get("abi")

w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 1.5}))

def is_blockchain_connected():
    try:
        return w3.is_connected()
    except Exception:
        return False

def get_account():
    if not PRIVATE_KEY:
        return None
    return w3.eth.account.from_key(PRIVATE_KEY)

def get_contract():
    if not contract_address or not contract_abi:
        return None
    return w3.eth.contract(address=w3.to_checksum_address(contract_address), abi=contract_abi)

def calculate_sha256(file_path_or_bytes):
    """Compute standard SHA-256 hex digest for document anchoring"""
    hasher = hashlib.sha256()
    if isinstance(file_path_or_bytes, bytes):
        hasher.update(file_path_or_bytes)
    elif os.path.exists(file_path_or_bytes):
        with open(file_path_or_bytes, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                hasher.update(chunk)
    else:
        hasher.update(str(file_path_or_bytes).encode("utf-8"))
    return hasher.hexdigest()

def execute_contract_transaction(func_call):
    """Sign and send a transaction to the Ethereum smart contract"""
    account = get_account()
    if not account or not w3.is_connected():
        raise Exception("Blockchain RPC not connected or private key missing")

    nonce = w3.eth.get_transaction_count(account.address)
    
    # Estimate gas with buffer
    try:
        gas_est = func_call.estimate_gas({"from": account.address})
        gas_limit = int(gas_est * 1.3)
    except Exception:
        gas_limit = 500000

    tx = func_call.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": gas_limit,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id
    })

    signed_tx = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    raw_tx = getattr(signed_tx, "raw_transaction", None) or getattr(signed_tx, "rawTransaction")
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

    tx_hash_hex = receipt.transactionHash.hex() if hasattr(receipt.transactionHash, "hex") else str(receipt.transactionHash)
    if tx_hash_hex.startswith("0x"):
        tx_hash_hex = tx_hash_hex[2:]

    return {
        "tx_hash": tx_hash_hex,
        "block_number": receipt.blockNumber,
        "gas_used": receipt.gasUsed,
        "status": "SUCCESS" if receipt.status == 1 else "FAILED"
    }

# --- Contract Action Wrappers ---

def record_budget_allocation_onchain(alloc_id, scheme, dept, amount):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.allocateBudget(alloc_id, scheme, dept, int(amount))
    )

def record_state_transfer_onchain(trf_id, alloc_id, state_name, amount):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.transferToState(trf_id, alloc_id, state_name, int(amount))
    )

def record_district_allocation_onchain(dist_alloc_id, trf_id, district_name, amount):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.allocateToDistrict(dist_alloc_id, trf_id, district_name, int(amount))
    )

def create_project_escrow_onchain(project_id, project_name, contractor_address, total_budget):
    contract = get_contract()
    if not contract:
        return None
    c_addr = contractor_address if contractor_address and w3.is_address(contractor_address) else get_account().address
    return execute_contract_transaction(
        contract.functions.createProjectEscrow(
            project_id, project_name, w3.to_checksum_address(c_addr), int(total_budget)
        )
    )

def set_project_milestones_onchain(project_id, milestone_amounts):
    contract = get_contract()
    if not contract:
        return None
    amounts = [int(a) for a in milestone_amounts]
    return execute_contract_transaction(
        contract.functions.setMilestones(project_id, amounts)
    )

def submit_milestone_progress_onchain(project_id, milestone_index, proof_hash, percentage):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.submitMilestoneProgress(project_id, int(milestone_index), proof_hash, int(percentage))
    )

def release_milestone_payment_onchain(project_id, milestone_index):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.releaseMilestonePayment(project_id, int(milestone_index))
    )

def anchor_document_hash_onchain(doc_id, doc_hash, doc_type, entity_id):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.anchorDocumentHash(doc_id, doc_hash, doc_type, entity_id)
    )

def verify_document_hash_onchain(doc_id, computed_hash):
    contract = get_contract()
    if not contract:
        return {"is_match": False, "stored_hash": "", "timestamp": 0}
    try:
        is_match, stored_hash, timestamp = contract.functions.verifyDocumentHash(doc_id, computed_hash).call()
        return {
            "is_match": is_match,
            "stored_hash": stored_hash,
            "timestamp": timestamp
        }
    except Exception as e:
        print(f"Document verification call error: {e}")
        return {"is_match": False, "stored_hash": "", "timestamp": 0}

def freeze_project_onchain(project_id, reason):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.freezeProject(project_id, reason)
    )

def unfreeze_project_onchain(project_id):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.unfreezeProject(project_id)
    )

def submit_audit_report_onchain(audit_id, project_id, auditor_name, compliance_score, verdict):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.submitAuditReport(audit_id, project_id, auditor_name, int(compliance_score), verdict)
    )
