import os
import json
import hashlib
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL") or os.getenv("RPC_URL", "http://127.0.0.1:7545")
PRIVATE_KEY = os.getenv("BLOCKCHAIN_PRIVATE_KEY", "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba")

# Load Contract Info
contract_info_path = os.path.join(os.path.dirname(__file__), "config", "contract_info.json")
contract_address = os.getenv("CONTRACT_ADDRESS")
contract_abi = None

if os.path.exists(contract_info_path):
    with open(contract_info_path, "r") as f:
        info = json.load(f)
        if not contract_address:
            contract_address = info.get("contractAddress")
        contract_abi = info.get("abi")

w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={"timeout": 1.5}))

def _derive_address_from_key(pk: str, fallback: str) -> str:
    if not pk:
        return fallback
    try:
        return w3.eth.account.from_key(pk).address
    except Exception:
        return fallback

# Dynamic Ganache Multi-Department Public Addresses (Derived from environment variables)
FINANCE_ADDR = _derive_address_from_key(os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY"), "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B")
STATE_ADDR = _derive_address_from_key(os.getenv("STATE_PRIVATE_KEY"), "0x3bE9Fb1473BcAEe6790dBb9556A8C9637eCC54bC")
DISTRICT_ADDR = _derive_address_from_key(os.getenv("DISTRICT_PRIVATE_KEY"), "0x2Db964805531b2cc0Cb6961AF0f7d7489F1e4Aa9")
CONTRACTOR_ADDR = _derive_address_from_key(os.getenv("CONTRACTOR_PRIVATE_KEY"), "0xd49155782d0C91e4fF69024ACf6F7811467800C2")

# ==========================================
# MULTI-TIER WALLET & ENTITY DIRECTORY
# (Ganache Multi-Department Accounts)
# ==========================================
# Account 0: 0x1622F9853bDFEc6ba1A40FBf9bba7Fd7e8B451B -> Finance Department
# Account 1: 0x3bE9Fb1473BcAEe6790dBb9556A8C9637eCC54bC -> State Department
# Account 2: 0x2Db964805531b2cc0Cb6961AF0f7d7489F1e4Aa9 -> District Department
# Account 3: 0xd49155782d0C91e4fF69024ACf6F7811467800C2 -> Contractor

WALLET_REGISTRY = {
    # Central Apex & Finance
    "ADMIN": {
        "address": FINANCE_ADDR,
        "name": "Central Secretariat",
        "department": "National Planning Commission",
        "tier": "Tier 1: Central",
        "role": "SUPER_ADMIN"
    },
    "FINANCE": {
        "address": FINANCE_ADDR,
        "name": "Ministry of Finance",
        "department": "Public Fund Disbursal Authority",
        "tier": "Tier 1: Central Finance",
        "role": "FINANCE"
    },
    # State Treasuries (Ganache Account 1)
    "STATE": {
        "address": STATE_ADDR,
        "name": "State Treasury Department",
        "department": "State Finance & Treasury Dept",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_KA": {
        "address": STATE_ADDR,
        "name": "Karnataka State Treasury",
        "department": "State Finance & Treasury Dept",
        "state_code": "KA",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_MH": {
        "address": STATE_ADDR,
        "name": "Maharashtra State Treasury",
        "department": "Finance & Planning Dept",
        "state_code": "MH",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_GJ": {
        "address": STATE_ADDR,
        "name": "Gujarat State Treasury",
        "department": "State Finance Dept",
        "state_code": "GJ",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_TN": {
        "address": STATE_ADDR,
        "name": "Tamil Nadu State Treasury",
        "department": "State Finance Dept",
        "state_code": "TN",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    "STATE_UP": {
        "address": STATE_ADDR,
        "name": "Uttar Pradesh State Treasury",
        "department": "State Finance Dept",
        "state_code": "UP",
        "tier": "Tier 2: State Treasury",
        "role": "STATE"
    },
    # District Implementing Agencies (Ganache Account 2)
    "DISTRICT": {
        "address": DISTRICT_ADDR,
        "name": "District Development Agency",
        "department": "District Implementing Office",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_BELAGAVI": {
        "address": DISTRICT_ADDR,
        "name": "Belagavi District Agency",
        "department": "District Rural Development Agency, Belagavi",
        "district": "Belagavi",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_BENGALURU": {
        "address": DISTRICT_ADDR,
        "name": "Bengaluru Urban Agency",
        "department": "District Urban Development Agency, Bengaluru",
        "district": "Bengaluru Urban",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_MYSURU": {
        "address": DISTRICT_ADDR,
        "name": "Mysuru District Agency",
        "department": "District Rural Development Agency, Mysuru",
        "district": "Mysuru",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_MANGALURU": {
        "address": DISTRICT_ADDR,
        "name": "Mangaluru District Agency",
        "department": "District Development Office, Mangaluru",
        "district": "Mangaluru",
        "state_code": "KA",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_PUNE": {
        "address": DISTRICT_ADDR,
        "name": "Pune District Agency",
        "department": "District Development Agency, Pune",
        "district": "Pune",
        "state_code": "MH",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_NAGPUR": {
        "address": DISTRICT_ADDR,
        "name": "Nagpur District Agency",
        "department": "District Development Agency, Nagpur",
        "district": "Nagpur",
        "state_code": "MH",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_AHMEDABAD": {
        "address": DISTRICT_ADDR,
        "name": "Ahmedabad District Agency",
        "department": "District Development Agency, Ahmedabad",
        "district": "Ahmedabad",
        "state_code": "GJ",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_CHENNAI": {
        "address": DISTRICT_ADDR,
        "name": "Chennai District Agency",
        "department": "District Development Agency, Chennai",
        "district": "Chennai",
        "state_code": "TN",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    "DIST_LUCKNOW": {
        "address": DISTRICT_ADDR,
        "name": "Lucknow District Agency",
        "department": "District Development Agency, Lucknow",
        "district": "Lucknow",
        "state_code": "UP",
        "tier": "Tier 3: District Agency",
        "role": "DISTRICT"
    },
    # Contractors (Ganache Account 3)
    "CONTRACTOR": {
        "address": CONTRACTOR_ADDR,
        "name": "Registered Infrastructure Contractor",
        "department": "Civil Infrastructure Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    "CONTRACTOR_APEX": {
        "address": CONTRACTOR_ADDR,
        "name": "Apex Infrastructure Contractors Pvt Ltd",
        "department": "Civil Infrastructure Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    "CONTRACTOR_KA": {
        "address": CONTRACTOR_ADDR,
        "name": "Karnataka Highway Infra Concessionaires",
        "department": "Highway Infrastructure Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    "CONTRACTOR_SOUTH": {
        "address": CONTRACTOR_ADDR,
        "name": "Southern Roads & Bridges Infrastructure",
        "department": "Bridge & Road Concessionaire",
        "tier": "Tier 4: Contractor Escrow",
        "role": "CONTRACTOR"
    },
    # Smart Contract Escrow Ledger
    "ESCROW_CONTRACT": {
        "address": contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "name": "Government Fund Tracking Smart Contract Escrow",
        "department": "Automated Blockchain Escrow & Milestone Disbursal Vault",
        "tier": "Smart Contract Vault",
        "role": "ESCROW"
    },
    # Auditor
    "AUDITOR": {
        "address": FINANCE_ADDR,
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
        if f"{key}_{clean_id}" in WALLET_REGISTRY:
            return WALLET_REGISTRY[f"{key}_{clean_id}"]["address"]
        for k, v in WALLET_REGISTRY.items():
            if v.get("district", "").upper() == str(identifier).upper():
                return v["address"]
            if v.get("state_code", "").upper() == str(identifier).upper() and k.startswith("STATE_"):
                return v["address"]
            if str(identifier).lower() in v.get("name", "").lower():
                return v["address"]

    if key in ["ADMIN", "SUPER_ADMIN", "FINANCE"]:
        return FINANCE_ADDR
    elif key == "STATE" or key.startswith("STATE_"):
        return STATE_ADDR
    elif key == "DISTRICT" or key.startswith("DIST_"):
        return DISTRICT_ADDR
    elif key == "CONTRACTOR" or key.startswith("CONTRACTOR_"):
        return CONTRACTOR_ADDR
    elif "ESCROW" in key or "CONTRACT" in key:
        return contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20"
    elif key in WALLET_REGISTRY:
        return WALLET_REGISTRY[key]["address"]
    
    return FINANCE_ADDR

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

def get_private_key_for_role(role: str = "FINANCE") -> str:
    """
    Dynamically resolve the private key corresponding to the administrative role:
    - FINANCE / SUPER_ADMIN -> FINANCE_PRIVATE_KEY (Ganache Account 0)
    - STATE                 -> STATE_PRIVATE_KEY   (Ganache Account 1)
    - DISTRICT              -> DISTRICT_PRIVATE_KEY (Ganache Account 2)
    - CONTRACTOR            -> CONTRACTOR_PRIVATE_KEY (Ganache Account 3)
    """
    r = str(role or "FINANCE").strip().upper()
    
    if r in ["SUPER_ADMIN", "ADMIN"]:
        key = os.getenv("ADMIN_PRIVATE_KEY") or os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    elif r == "FINANCE":
        key = os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    elif r == "STATE":
        key = os.getenv("STATE_PRIVATE_KEY") or os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    elif r == "DISTRICT":
        key = os.getenv("DISTRICT_PRIVATE_KEY") or os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    elif r == "CONTRACTOR":
        key = os.getenv("CONTRACTOR_PRIVATE_KEY") or os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    elif r == "AUDITOR":
        key = os.getenv("AUDITOR_PRIVATE_KEY") or os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
    else:
        key = os.getenv("FINANCE_PRIVATE_KEY") or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        
    return key or PRIVATE_KEY

def get_account(role: str = "FINANCE", custom_private_key: str = None):
    pk = custom_private_key or get_private_key_for_role(role)
    if not pk:
        return None
    try:
        return w3.eth.account.from_key(pk)
    except Exception as e:
        print(f"Error loading account for role {role}: {e}")
        return None

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

def execute_contract_transaction(func_call, role: str = "FINANCE", custom_private_key: str = None):
    """
    Sign and send a transaction to the Ethereum smart contract using
    the designated wallet private key for the specified administrative role.
    """
    account = get_account(role=role, custom_private_key=custom_private_key)
    pk = custom_private_key or get_private_key_for_role(role)
    if not account or not pk or not w3.is_connected():
        raise Exception(f"Blockchain RPC not connected or private key missing for role: {role}")

    nonce = w3.eth.get_transaction_count(account.address)
    
    # Estimate gas with buffer
    try:
        gas_est = func_call.estimate_gas({"from": account.address})
        gas_limit = int(gas_est * 1.3)
    except Exception:
        gas_limit = 600000

    try:
        chain_id = w3.eth.chain_id
    except Exception:
        chain_id = int(os.getenv("CHAIN_ID", 5777))

    try:
        gas_price = w3.eth.gas_price or w3.to_wei(20, 'gwei')
    except Exception:
        gas_price = w3.to_wei(20, 'gwei')

    tx = func_call.build_transaction({
        "from": account.address,
        "nonce": nonce,
        "gas": gas_limit,
        "gasPrice": gas_price,
        "chainId": chain_id
    })

    signed_tx = w3.eth.account.sign_transaction(tx, pk)
    raw_tx = getattr(signed_tx, "raw_transaction", None) or getattr(signed_tx, "rawTransaction")
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)

    tx_hash_hex = receipt.transactionHash.hex() if hasattr(receipt.transactionHash, "hex") else str(receipt.transactionHash)
    if not tx_hash_hex.startswith("0x"):
        tx_hash_hex = "0x" + tx_hash_hex

    return {
        "tx_hash": tx_hash_hex,
        "block_number": receipt.blockNumber,
        "gas_used": receipt.gasUsed,
        "from_address": account.address,
        "status": "SUCCESS" if receipt.status == 1 else "FAILED"
    }

# --- Contract Action Wrappers ---

def record_budget_allocation_onchain(alloc_id, scheme, dept, amount):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.allocateBudget(alloc_id, scheme, dept, int(amount)),
        role="SUPER_ADMIN"
    )

def record_state_transfer_onchain(trf_id, alloc_id, state_name, amount, receiver_address=None):
    contract = get_contract()
    if not contract:
        return None
    
    rec_addr = receiver_address or get_entity_wallet("STATE", state_name)
    rec_addr_checksum = w3.to_checksum_address(rec_addr) if w3.is_address(rec_addr) else w3.to_checksum_address(WALLET_REGISTRY["STATE"]["address"])
    
    try:
        func = contract.functions.transferToStateWithReceiver(trf_id, alloc_id, state_name, int(amount), rec_addr_checksum)
    except Exception:
        func = contract.functions.transferToState(trf_id, alloc_id, state_name, int(amount))

    return execute_contract_transaction(func, role="FINANCE")

def record_district_allocation_onchain(dist_alloc_id, trf_id, district_name, amount, receiver_address=None):
    contract = get_contract()
    if not contract:
        return None
    
    rec_addr = receiver_address or get_entity_wallet("DISTRICT", district_name)
    rec_addr_checksum = w3.to_checksum_address(rec_addr) if w3.is_address(rec_addr) else w3.to_checksum_address(WALLET_REGISTRY["DISTRICT"]["address"])

    try:
        func = contract.functions.allocateToDistrictWithReceiver(dist_alloc_id, trf_id, district_name, int(amount), rec_addr_checksum)
    except Exception:
        func = contract.functions.allocateToDistrict(dist_alloc_id, trf_id, district_name, int(amount))

    return execute_contract_transaction(func, role="STATE")

def record_contractor_transfer_onchain(transfer_id, project_id, district_name, contractor_name, amount, receiver_address=None):
    """
    District transfers funds directly to Contractor Concessionaire.
    Signed by DISTRICT_PRIVATE_KEY (Ganache Account 2).
    Transaction TO is the Smart Contract Address.
    Smart contract records & emits FundTransferred with sender=District, receiver=Contractor.
    """
    contract = get_contract()
    if not contract:
        return None
    
    rec_addr = receiver_address or get_entity_wallet("CONTRACTOR", contractor_name)
    rec_addr_checksum = w3.to_checksum_address(rec_addr) if w3.is_address(rec_addr) else w3.to_checksum_address(CONTRACTOR_ADDR)

    try:
        func = contract.functions.transferToContractor(
            transfer_id,
            project_id,
            rec_addr_checksum,
            district_name,
            contractor_name,
            int(amount)
        )
    except Exception:
        func = contract.functions.recordFundTransfer(
            transfer_id,
            rec_addr_checksum,
            district_name,
            contractor_name,
            project_id,
            int(amount)
        )

    return execute_contract_transaction(func, role="DISTRICT")

def create_project_escrow_onchain(project_id, project_name, contractor_address, total_budget):
    contract = get_contract()
    if not contract:
        return None
    c_addr = contractor_address if contractor_address and w3.is_address(contractor_address) else WALLET_REGISTRY["CONTRACTOR"]["address"]
    return execute_contract_transaction(
        contract.functions.createProjectEscrow(
            project_id, project_name, w3.to_checksum_address(c_addr), int(total_budget)
        ),
        role="DISTRICT"
    )

def set_project_milestones_onchain(project_id, milestone_amounts):
    contract = get_contract()
    if not contract:
        return None
    amounts = [int(a) for a in milestone_amounts]
    return execute_contract_transaction(
        contract.functions.setMilestones(project_id, amounts),
        role="DISTRICT"
    )

def submit_milestone_progress_onchain(project_id, milestone_index, proof_hash, percentage):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.submitMilestoneProgress(project_id, int(milestone_index), proof_hash, int(percentage)),
        role="CONTRACTOR"
    )

def release_milestone_payment_onchain(project_id, milestone_index):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.releaseMilestonePayment(project_id, int(milestone_index)),
        role="DISTRICT"
    )

def anchor_document_hash_onchain(doc_id, doc_hash, doc_type, entity_id, role="DISTRICT"):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.anchorDocumentHash(doc_id, doc_hash, doc_type, entity_id),
        role=role
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
        contract.functions.freezeProject(project_id, reason),
        role="AUDITOR"
    )

def unfreeze_project_onchain(project_id):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.unfreezeProject(project_id),
        role="SUPER_ADMIN"
    )

def submit_audit_report_onchain(audit_id, project_id, auditor_name, compliance_score, verdict):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.submitAuditReport(audit_id, project_id, auditor_name, int(compliance_score), verdict),
        role="AUDITOR"
    )

