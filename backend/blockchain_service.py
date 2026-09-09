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

# ==========================================
# MULTI-TIER WALLET & ENTITY DIRECTORY
# ==========================================
WALLET_REGISTRY = {
    # Central Apex
    "ADMIN": {
        "address": "0x1E3A8A93FD0b4c8A9bE14c46f1F0A84D63A50001",
        "name": "Central Secretariat",
        "department": "National Planning Commission",
        "tier": "Tier 1: Central",
        "role": "SUPER_ADMIN"
    },
    "FINANCE": {
        "address": "0x0F766E99F6E4A836bE9344445839DC9E86DA0002",
        "name": "Ministry of Finance",
        "department": "Public Fund Disbursal Authority",
        "tier": "Tier 1: Central Finance",
        "role": "FINANCE"
    },
    # State Treasuries
    "STATE_KA": {
        "address": "0x0369A1BAE6FD3c8290f79BF6Eb2C4F8703650003",
        "name": "Karnataka State Treasury",
        "department": "State Finance & Treasury Dept",
        "state_code": "KA",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_MH": {
        "address": "0x14dC79964da2C08b23698B3D3cc7Ca32193D0004",
        "name": "Maharashtra State Treasury",
        "department": "Finance & Planning Dept",
        "state_code": "MH",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_GJ": {
        "address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C0005",
        "name": "Gujarat State Treasury",
        "department": "State Finance Dept",
        "state_code": "GJ",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_TN": {
        "address": "0x9965507D1a55bcC2695C58ba16FB37d819B00006",
        "name": "Tamil Nadu State Treasury",
        "department": "State Finance Dept",
        "state_code": "TN",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_UP": {
        "address": "0x976EA74026E726554dB657fA54763abd0C3a0007",
        "name": "Uttar Pradesh State Treasury",
        "department": "State Finance Dept",
        "state_code": "UP",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    # District Implementing Agencies
    "DIST_BELAGAVI": {
        "address": "0x7C3AEDDDD6FE90f79BF6eb2C4f870365E7850008",
        "name": "Belagavi District Agency",
        "department": "District Rural Development Agency, Belagavi",
        "district": "Belagavi",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_BENGALURU": {
        "address": "0x90F79bf6EB2c4f870365E785982E1f101E930009",
        "name": "Bengaluru Urban Agency",
        "department": "District Urban Development Agency, Bengaluru",
        "district": "Bengaluru Urban",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_MYSURU": {
        "address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA420010",
        "name": "Mysuru District Agency",
        "department": "District Rural Development Agency, Mysuru",
        "district": "Mysuru",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_MANGALURU": {
        "address": "0x92db14e403b83dfe3df233f83dfa3a0d709600016",
        "name": "Mangaluru District Agency",
        "department": "District Development Office, Mangaluru",
        "district": "Mangaluru",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_PUNE": {
        "address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B20011",
        "name": "Pune District Agency",
        "department": "District Development Agency, Pune",
        "district": "Pune",
        "state_code": "MH",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_NAGPUR": {
        "address": "0x8b3a350cf5c34c9194ca85829a2df0ec315300015",
        "name": "Nagpur District Agency",
        "department": "District Development Agency, Nagpur",
        "district": "Nagpur",
        "state_code": "MH",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_AHMEDABAD": {
        "address": "0xBcd4042DE499D14e55001CcbB24a551F3b900014",
        "name": "Ahmedabad District Agency",
        "department": "District Development Agency, Ahmedabad",
        "district": "Ahmedabad",
        "state_code": "GJ",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_CHENNAI": {
        "address": "0x71bE63f3384f5fb9899544c7b624147781400013",
        "name": "Chennai District Agency",
        "department": "District Development Agency, Chennai",
        "district": "Chennai",
        "state_code": "TN",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_LUCKNOW": {
        "address": "0xa0Ee7A142d267C1f36714E4a8F75612F20a70012",
        "name": "Lucknow District Agency",
        "department": "District Development Agency, Lucknow",
        "district": "Lucknow",
        "state_code": "UP",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    # Contractors & Concessionaires
    "CONTRACTOR_APEX": {
        "address": "0xC2410CFED7AA70997970C51812dc3A010C7d0017",
        "name": "Apex Infrastructure Contractors Pvt Ltd",
        "department": "Civil Infrastructure Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    "CONTRACTOR_KA": {
        "address": "0x5de4111afa1a4b94908f83103eb1f17063670018",
        "name": "Karnataka Highway Infra Concessionaires",
        "department": "Highway Infrastructure Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    "CONTRACTOR_SOUTH": {
        "address": "0x7c852118294e51e653712a81e05800f419140019",
        "name": "Southern Roads & Bridges Infrastructure",
        "department": "Bridge & Road Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    # Smart Contract Escrow Ledger
    "ESCROW_CONTRACT": {
        "address": contract_address or "0x825A248BdC512e02e77445B3D76Ab01eBC46A22B",
        "name": "Government Fund Tracking Smart Contract Escrow",
        "department": "Automated Blockchain Escrow & Milestone Disbursal Vault",
        "tier": "Smart Contract Vault",
        "role": "ESCROW"
    },
    # Auditor
    "AUDITOR": {
        "address": "0xB91C1CFECACAa0Ee7A142d267C1f36714E4a8F750020",
        "name": "CAG Audit & Inspection Directorate",
        "department": "Forensic Audit & Public Accounts",
        "tier": "Oversight & Audit",
        "role": "AUDITOR"
    }
}

def get_entity_wallet(entity_type, identifier=None):
    """
    Lookup or generate the authoritative Ethereum address for an entity:
    - entity_type: 'ADMIN', 'FINANCE', 'STATE', 'DISTRICT', 'CONTRACTOR', 'ESCROW', 'AUDITOR'
    - identifier: state_code, district_name, contractor_name or specific key
    """
    key = str(entity_type).upper()
    if identifier:
        clean_id = str(identifier).strip().replace(" ", "_").upper()
        # Direct key check
        if f"{key}_{clean_id}" in WALLET_REGISTRY:
            return WALLET_REGISTRY[f"{key}_{clean_id}"]["address"]
        # Match district
        for k, v in WALLET_REGISTRY.items():
            if v.get("district", "").upper() == str(identifier).upper():
                return v["address"]
            if v.get("state_code", "").upper() == str(identifier).upper() and k.startswith("STATE_"):
                return v["address"]
            if str(identifier).lower() in v.get("name", "").lower():
                return v["address"]

    if key in WALLET_REGISTRY:
        return WALLET_REGISTRY[key]["address"]
    
    # Fallback to escrow or default account
    if "ESCROW" in key or "CONTRACT" in key:
        return contract_address or "0x825A248BdC512e02e77445B3D76Ab01eBC46A22B"

    # Default fallback
    return WALLET_REGISTRY.get("ADMIN", {}).get("address", "0x1E3A8A93FD0b4c8A9bE14c46f1F0A84D63A50001")

def get_entity_info(address_or_key):
    """Retrieve metadata description for a wallet address or key"""
    if not address_or_key:
        return {"name": "Public Citizen / Network", "tier": "Public", "role": "PUBLIC"}
    
    target = str(address_or_key).lower()
    for k, v in WALLET_REGISTRY.items():
        if v["address"].lower() == target or k.lower() == target:
            return v
    
    if contract_address and target == contract_address.lower():
        return WALLET_REGISTRY["ESCROW_CONTRACT"]
    
    return {
        "name": f"Verified Account ({address_or_key[:6]}...{address_or_key[-4:] if len(address_or_key) > 10 else ''})",
        "tier": "Network Participant",
        "role": "MEMBER",
        "address": address_or_key
    }

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
