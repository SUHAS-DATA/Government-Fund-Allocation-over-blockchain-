import os
import json
import time
import hashlib
import logging
from web3 import Web3
from dotenv import load_dotenv

_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
else:
    load_dotenv()

bc_logger = logging.getLogger("blockchain_service")

RPC_URL = os.getenv("BLOCKCHAIN_RPC_URL") or os.getenv("RPC_URL", "http://127.0.0.1:7545")
PRIVATE_KEY = os.getenv("BLOCKCHAIN_PRIVATE_KEY")

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

w3 = Web3(Web3.HTTPProvider(RPC_URL, request_kwargs={
    "timeout": 15.0,
    "headers": {
        "bypass-tunnel-reminder": "true",
        "Bypass-Tunnel-Reminder": "1",
        "User-Agent": "Mozilla/5.0"
    }
}))

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
    }
}

def get_entity_wallet(entity_type, identifier=None):
    """
    Lookup or generate the authoritative Ethereum address for an entity:
    - entity_type: 'ADMIN', 'FINANCE', 'STATE', 'DISTRICT', 'CONTRACTOR', 'ESCROW'
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

_bc_connected_cache = {"status": False, "expires_at": 0}

def is_blockchain_connected(force_refresh: bool = False) -> bool:
    global _bc_connected_cache
    now = time.time()
    if not force_refresh and now < _bc_connected_cache["expires_at"]:
        return _bc_connected_cache["status"]
    try:
        status = bool(w3.is_connected())
    except Exception:
        status = False
    _bc_connected_cache = {"status": status, "expires_at": now + 10}
    return status

def mask_rpc_url(url: str) -> str:
    if not url:
        return "NOT_CONFIGURED"
    if "127.0.0.1" in url or "localhost" in url:
        return url
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path
        if len(path) > 10:
            path = path[:6] + "..." + path[-4:]
        return f"{parsed.scheme}://{parsed.netloc}{path}"
    except Exception:
        return url[:15] + "..."

def get_blockchain_diagnostics() -> dict:
    """
    Safely validates active blockchain configuration without exposing private keys or secrets.
    """
    env = os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "development"
    warnings = []
    
    connected = is_blockchain_connected(force_refresh=True)
    active_chain_id = None
    configured_chain_id = int(os.getenv("CHAIN_ID", 1337))
    chain_id_match = False

    if connected:
        try:
            active_chain_id = w3.eth.chain_id
            chain_id_match = (active_chain_id == configured_chain_id)
            if not chain_id_match:
                warnings.append(
                    f"Configured CHAIN_ID ({configured_chain_id}) does not match active network chain ID ({active_chain_id}). "
                    f"Update CHAIN_ID={active_chain_id} in your environment variables."
                )
        except Exception as e:
            warnings.append(f"Unable to query network chain ID: {e}")
    else:
        warnings.append(f"Blockchain RPC node is unreachable at {mask_rpc_url(RPC_URL)}.")

    # Loopback advisory in production
    is_production = env.lower() in ["production", "prod"]
    if is_production and ("127.0.0.1" in RPC_URL or "localhost" in RPC_URL):
        warnings.append(
            "Production environment is using a loopback RPC URL (127.0.0.1/localhost). "
            "Cloud containers (Render) cannot connect to local networks without an external RPC or public tunnel."
        )

    # Contract bytecode verification
    contract_deployed = False
    if connected and contract_address:
        try:
            code = w3.eth.get_code(w3.to_checksum_address(contract_address))
            contract_deployed = len(code) > 2
            if not contract_deployed:
                warnings.append(
                    f"No smart contract bytecode deployed at {contract_address} on chain {active_chain_id}."
                )
        except Exception as e:
            warnings.append(f"Failed to verify contract code: {e}")
    elif not contract_address:
        warnings.append("CONTRACT_ADDRESS is not configured.")

    # Role signing keys presence validation (Never reveals private keys)
    roles = ["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR"]
    roles_status = {}
    for r in roles:
        acc = get_account(r)
        roles_status[r] = {
            "key_configured": bool(get_private_key_for_role(r)),
            "wallet_derived": acc.address if acc else None,
            "ready": bool(acc)
        }
        if not roles_status[r]["ready"]:
            warnings.append(f"Missing or invalid private key for role: {r}")

    return {
        "environment": env,
        "rpc_url": mask_rpc_url(RPC_URL),
        "connected": connected,
        "configured_chain_id": configured_chain_id,
        "active_chain_id": active_chain_id,
        "chain_id_match": chain_id_match,
        "contract_address": contract_address,
        "contract_deployed": contract_deployed,
        "roles": roles_status,
        "warnings": warnings,
        "status": "HEALTHY" if (connected and (chain_id_match or not active_chain_id) and contract_deployed and len(warnings) == 0) else "DEGRADED"
    }

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
        key = (
            os.getenv("ADMIN_PRIVATE_KEY")
            or os.getenv("SUPER_ADMIN_PRIVATE_KEY")
            or os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
    elif r == "FINANCE":
        key = (
            os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("ADMIN_PRIVATE_KEY")
            or os.getenv("SUPER_ADMIN_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
    elif r == "STATE":
        key = (
            os.getenv("STATE_PRIVATE_KEY")
            or os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
    elif r == "DISTRICT":
        key = (
            os.getenv("DISTRICT_PRIVATE_KEY")
            or os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
    elif r == "CONTRACTOR":
        key = (
            os.getenv("CONTRACTOR_PRIVATE_KEY")
            or os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
    else:
        key = (
            os.getenv("FINANCE_PRIVATE_KEY")
            or os.getenv("ADMIN_PRIVATE_KEY")
            or os.getenv("BLOCKCHAIN_PRIVATE_KEY")
        )
        
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
    fn_name = getattr(func_call, "fn_name", "ContractCall")

    if not w3.is_connected():
        err_msg = (
            f"Blockchain RPC node at '{RPC_URL}' is unreachable or disconnected. "
            f"If deploying to cloud (Render), ensure a live public RPC URL or active tunnel is set in BLOCKCHAIN_RPC_URL."
        )
        bc_logger.error(f"[BLOCKCHAIN_TX_ERROR] Op={fn_name} | {err_msg}")
        raise Exception(err_msg)

    pk = custom_private_key or get_private_key_for_role(role)
    if not pk:
        err_msg = (
            f"Signing private key missing for role '{role}'. "
            f"Please set {role}_PRIVATE_KEY or ADMIN_PRIVATE_KEY in your environment variables."
        )
        bc_logger.error(f"[BLOCKCHAIN_TX_ERROR] Op={fn_name} | {err_msg}")
        raise Exception(err_msg)

    account = get_account(role=role, custom_private_key=custom_private_key)
    if not account:
        err_msg = (
            f"Invalid private key configured for role '{role}'. "
            f"Unable to derive Ethereum wallet address."
        )
        bc_logger.error(f"[BLOCKCHAIN_TX_ERROR] Op={fn_name} | {err_msg}")
        raise Exception(err_msg)

    try:
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
            chain_id = int(os.getenv("CHAIN_ID", 1337))

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

        status_str = "SUCCESS" if receipt.status == 1 else "FAILED"
        bc_logger.info(
            f"[BLOCKCHAIN_TX] Op={fn_name} | Role={role} | Sender={account.address} | "
            f"Contract={contract_address} | ChainID={chain_id} | Block=#{receipt.blockNumber} | "
            f"GasUsed={receipt.gasUsed} | Status={status_str} | TxHash={tx_hash_hex}"
        )

        if receipt.status != 1:
            err_msg = f"Blockchain transaction reverted on-chain with status 0. TxHash: {tx_hash_hex}"
            bc_logger.error(f"[BLOCKCHAIN_TX_REVERTED] Op={fn_name} | {err_msg}")
            raise Exception(err_msg)

        return {
            "tx_hash": tx_hash_hex,
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed,
            "from_address": account.address,
            "status": status_str
        }
    except Exception as e:
        bc_logger.error(
            f"[BLOCKCHAIN_TX_FAILED] Op={fn_name} | Role={role} | Sender={account.address} | "
            f"Contract={contract_address} | Error={str(e)}"
        )
        raise

# --- Contract Action Wrappers ---

def record_budget_allocation_onchain(alloc_id, scheme, dept, amount):
    contract = get_contract()
    if not contract:
        return None
    return execute_contract_transaction(
        contract.functions.allocateBudget(alloc_id, scheme, dept, int(amount)),
        role="SUPER_ADMIN"
    )

def send_native_eth_transfer(sender_role: str, receiver_address: str, amount_eth: float = 0.1):
    """
    Sends native ETH between Ganache wallets so that the receiver's balance
    in Ganache visually and measurably increases!
    """
    try:
        account = get_account(role=sender_role)
        pk = get_private_key_for_role(sender_role)
        if not account or not pk or not w3.is_connected():
            return None
        
        target = w3.to_checksum_address(receiver_address)
        if account.address.lower() == target.lower():
            return None

        bal = w3.eth.get_balance(account.address)
        val_wei = w3.to_wei(amount_eth, 'ether')
        if bal <= val_wei + w3.to_wei(0.01, 'ether'):
            val_wei = int(bal * 0.05)
            if val_wei <= 0:
                return None

        nonce = w3.eth.get_transaction_count(account.address)
        chain_id = w3.eth.chain_id
        gas_price = w3.eth.gas_price or w3.to_wei(20, 'gwei')

        tx = {
            "from": account.address,
            "to": target,
            "value": val_wei,
            "gas": 21000,
            "gasPrice": gas_price,
            "nonce": nonce,
            "chainId": chain_id
        }
        signed = w3.eth.account.sign_transaction(tx, pk)
        raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction")
        tx_hash = w3.eth.send_raw_transaction(raw_tx)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=10)
        return receipt
    except Exception as e:
        print(f"Warning sending native ETH transfer ({sender_role} -> {receiver_address}): {e}")
        return None

def acknowledge_state_receipt_onchain(trf_id: str, state_name: str, amount: float):
    """
    State Treasury Officer signs an on-chain receipt anchoring the transfer,
    so that Account #1's TX COUNT in Ganache also increments immediately upon receiving funds!
    """
    try:
        contract = get_contract()
        if not contract or not hasattr(contract.functions, "anchorDocumentHash"):
            return None
        
        doc_id = f"ACK-{trf_id}"
        doc_hash = hashlib.sha256(f"{trf_id}:{state_name}:{amount}".encode()).hexdigest()
        func = contract.functions.anchorDocumentHash(doc_id, doc_hash, "STATE_RECEIPT", trf_id)
        return execute_contract_transaction(func, role="STATE")
    except Exception as e:
        print(f"Warning acknowledging state receipt on-chain: {e}")
        return None

def record_state_transfer_onchain(trf_id, alloc_id, state_name, amount, receiver_address=None):
    contract = get_contract()
    if not contract:
        return None
    
    rec_addr = receiver_address or get_entity_wallet("STATE", state_name)
    rec_addr_checksum = w3.to_checksum_address(rec_addr) if w3.is_address(rec_addr) else w3.to_checksum_address(WALLET_REGISTRY["STATE"]["address"])
    
    code = w3.eth.get_code(contract.address).hex()
    sel_with_receiver = Web3.keccak(text="transferToStateWithReceiver(string,string,string,uint256,address)")[:4].hex()[2:]

    if sel_with_receiver in code and hasattr(contract.functions, "transferToStateWithReceiver"):
        func = contract.functions.transferToStateWithReceiver(trf_id, alloc_id, state_name, int(amount), rec_addr_checksum)
    else:
        func = contract.functions.transferToState(trf_id, alloc_id, state_name, int(amount))

    tx_res = execute_contract_transaction(func, role="FINANCE")

    # 1. Native ETH Transfer: Finance -> State (Updates Ganache Account 1 Balance)
    send_native_eth_transfer("FINANCE", rec_addr_checksum, amount_eth=0.1)

    # 2. State Treasury Receipt: State signs acknowledgment (Updates Ganache Account 1 TX Count)
    ack_res = acknowledge_state_receipt_onchain(trf_id, state_name, amount)
    if ack_res and tx_res:
        tx_res["state_ack_tx_hash"] = ack_res.get("tx_hash")
        tx_res["state_ack_block"] = ack_res.get("block_number")

    return tx_res

def record_district_allocation_onchain(dist_alloc_id, trf_id, district_name, amount, receiver_address=None):
    contract = get_contract()
    if not contract:
        return None
    
    rec_addr = receiver_address or get_entity_wallet("DISTRICT", district_name)
    rec_addr_checksum = w3.to_checksum_address(rec_addr) if w3.is_address(rec_addr) else w3.to_checksum_address(WALLET_REGISTRY["DISTRICT"]["address"])

    code = w3.eth.get_code(contract.address).hex()
    sel_with_receiver = Web3.keccak(text="allocateToDistrictWithReceiver(string,string,string,uint256,address)")[:4].hex()[2:]

    if sel_with_receiver in code and hasattr(contract.functions, "allocateToDistrictWithReceiver"):
        func = contract.functions.allocateToDistrictWithReceiver(dist_alloc_id, trf_id, district_name, int(amount), rec_addr_checksum)
    else:
        func = contract.functions.allocateToDistrict(dist_alloc_id, trf_id, district_name, int(amount))

    tx_res = execute_contract_transaction(func, role="STATE")

    # Native ETH Transfer: State -> District (Updates Ganache Account 2 Balance)
    send_native_eth_transfer("STATE", rec_addr_checksum, amount_eth=0.05)

    return tx_res

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

    code = w3.eth.get_code(contract.address).hex()
    sel_trf = Web3.keccak(text="transferToContractor(string,string,address,string,string,uint256)")[:4].hex()[2:]
    sel_rec = Web3.keccak(text="recordFundTransfer(string,address,string,string,string,uint256)")[:4].hex()[2:]

    res = None
    if sel_trf in code and hasattr(contract.functions, "transferToContractor"):
        func = contract.functions.transferToContractor(
            transfer_id,
            project_id,
            rec_addr_checksum,
            district_name,
            contractor_name,
            int(amount)
        )
        res = execute_contract_transaction(func, role="DISTRICT")
    elif sel_rec in code and hasattr(contract.functions, "recordFundTransfer"):
        func = contract.functions.recordFundTransfer(
            transfer_id,
            rec_addr_checksum,
            district_name,
            contractor_name,
            project_id,
            int(amount)
        )
        res = execute_contract_transaction(func, role="DISTRICT")
    
    if res:
        send_native_eth_transfer("DISTRICT", rec_addr_checksum, amount_eth=0.05)
    return res

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
    res = execute_contract_transaction(
        contract.functions.releaseMilestonePayment(project_id, int(milestone_index)),
        role="DISTRICT"
    )
    if res:
        try:
            escrow = contract.functions.projectEscrows(project_id).call()
            con_addr = escrow[2] if len(escrow) > 2 else CONTRACTOR_ADDR
            send_native_eth_transfer("DISTRICT", con_addr, amount_eth=0.05)
        except Exception:
            send_native_eth_transfer("DISTRICT", CONTRACTOR_ADDR, amount_eth=0.05)
    return res

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

# =========================================================================
# ON-CHAIN STATE QUERY & VERIFICATION ENGINE (PHASE 5)
# =========================================================================

def verify_transaction_onchain(
    tx_hash: str,
    expected_sender: str = None,
    expected_contract: str = None,
    expected_event: str = None,
    expected_chain_id: int = None,
    min_confirmations: int = 0
) -> dict:
    """
    Independently verifies an Ethereum blockchain transaction against the RPC node:
    - Verifies RPC node connection.
    - Queries transaction and checks existence, chain ID, sender address, and target contract address.
    - Queries transaction receipt and checks receipt.status == 1 (not reverted).
    - Checks block confirmations.
    - Decodes receipt logs to verify that the specified smart contract event was emitted.
    - Strictly never reports unverified success if the transaction is pending, reverted, missing, or RPC unreachable.
    """
    if not tx_hash or not isinstance(tx_hash, str) or not tx_hash.startswith("0x"):
        return {
            "verified": False,
            "status": "INVALID_TX_HASH",
            "message": "Invalid transaction hash format. Must be a 0x-prefixed hex string."
        }

    if not is_blockchain_connected(force_refresh=True):
        return {
            "verified": False,
            "status": "RPC_DISCONNECTED",
            "message": f"Blockchain RPC node at '{mask_rpc_url(RPC_URL)}' is unreachable. Cannot verify on-chain state."
        }

    # 1. Query Transaction
    try:
        tx = w3.eth.get_transaction(tx_hash)
    except Exception as e:
        err_str = str(e).lower()
        if "not found" in err_str:
            return {
                "verified": False,
                "status": "NOT_FOUND_ON_CHAIN",
                "message": f"Transaction '{tx_hash}' was not found on the active blockchain ledger."
            }
        return {
            "verified": False,
            "status": "RPC_QUERY_ERROR",
            "message": f"Failed querying blockchain transaction: {str(e)}"
        }

    if not tx:
        return {
            "verified": False,
            "status": "NOT_FOUND_ON_CHAIN",
            "message": f"Transaction '{tx_hash}' was not found on the active blockchain ledger."
        }

    # Check if pending in mempool
    if tx.get("blockNumber") is None:
        return {
            "verified": False,
            "status": "PENDING_IN_MEMPOOL",
            "message": "Transaction is currently pending in the mempool and has not yet been mined into a block."
        }

    # Validate Chain ID
    expected_cid = expected_chain_id or int(os.getenv("CHAIN_ID", 1337))
    tx_chain_id = tx.get("chainId")
    if tx_chain_id is not None and tx_chain_id != expected_cid:
        return {
            "verified": False,
            "status": "CHAIN_ID_MISMATCH",
            "message": f"Transaction chain ID ({tx_chain_id}) does not match expected network chain ID ({expected_cid})."
        }

    # Validate Contract Address ('to')
    target_contract = expected_contract or contract_address
    if target_contract and tx.get("to"):
        if tx["to"].lower() != target_contract.lower():
            return {
                "verified": False,
                "status": "CONTRACT_ADDRESS_MISMATCH",
                "message": f"Transaction recipient '{tx['to']}' does not match expected contract address '{target_contract}'."
            }

    # Validate Sender Address ('from')
    if expected_sender and tx.get("from"):
        if tx["from"].lower() != expected_sender.lower():
            return {
                "verified": False,
                "status": "SENDER_ADDRESS_MISMATCH",
                "message": f"Transaction sender '{tx['from']}' does not match expected authorized address '{expected_sender}'."
            }

    # 2. Query Transaction Receipt
    try:
        receipt = w3.eth.get_transaction_receipt(tx_hash)
    except Exception as e:
        return {
            "verified": False,
            "status": "RECEIPT_NOT_AVAILABLE",
            "message": f"Failed querying transaction receipt: {str(e)}"
        }

    if not receipt:
        return {
            "verified": False,
            "status": "RECEIPT_NOT_FOUND",
            "message": f"Transaction receipt for '{tx_hash}' is not yet available."
        }

    # Validate Receipt Status
    if receipt.status != 1:
        return {
            "verified": False,
            "status": "REVERTED_ON_CHAIN",
            "message": f"Transaction was mined in block #{receipt.blockNumber} but reverted on-chain (status 0).",
            "block_number": receipt.blockNumber,
            "gas_used": receipt.gasUsed
        }

    # Validate Confirmations
    try:
        latest_block = w3.eth.block_number
        confirmations = max(0, latest_block - receipt.blockNumber + 1)
    except Exception:
        confirmations = 1

    if confirmations < min_confirmations:
        return {
            "verified": False,
            "status": "INSUFFICIENT_CONFIRMATIONS",
            "message": f"Transaction has {confirmations} confirmations; minimum {min_confirmations} required.",
            "confirmations": confirmations,
            "block_number": receipt.blockNumber
        }

    # 3. Decode Emitted Contract Events
    decoded_events = []
    contract = get_contract()
    if contract and hasattr(receipt, "logs") and receipt.logs:
        if expected_event:
            event_obj = getattr(contract.events, expected_event, None)
            if event_obj:
                try:
                    processed = event_obj().process_receipt(receipt)
                    for evt in processed:
                        decoded_events.append({
                            "event": evt.event,
                            "args": dict(evt.args)
                        })
                except Exception as log_err:
                    bc_logger.warning(f"Error parsing receipt log for {expected_event}: {log_err}")

            if not decoded_events:
                return {
                    "verified": False,
                    "status": "EVENT_EMISSION_MISMATCH",
                    "message": f"Transaction succeeded on-chain, but expected event '{expected_event}' was not emitted in receipt logs.",
                    "block_number": receipt.blockNumber,
                    "gas_used": receipt.gasUsed
                }

    return {
        "verified": True,
        "status": "VERIFIED_SUCCESS",
        "message": f"Transaction successfully verified on-chain in block #{receipt.blockNumber}.",
        "tx_hash": tx_hash,
        "block_number": receipt.blockNumber,
        "gas_used": receipt.gasUsed,
        "from_address": tx["from"],
        "to_address": tx["to"],
        "confirmations": confirmations,
        "decoded_events": decoded_events
    }

# --- On-chain State Query Getters ---

def get_onchain_budget_allocation(alloc_id: str):
    contract = get_contract()
    if not contract or not hasattr(contract.functions, "budgetAllocations"):
        return None
    try:
        res = contract.functions.budgetAllocations(alloc_id).call()
        return {
            "allocation_id": res[0],
            "scheme_name": res[1],
            "department_name": res[2],
            "total_sanctioned": float(res[3]),
            "disbursed_to_states": float(res[4]),
            "timestamp": int(res[5]),
            "exists": bool(res[6])
        }
    except Exception as e:
        bc_logger.warning(f"Error querying on-chain budget allocation {alloc_id}: {e}")
        return None

def get_onchain_state_transfer(trf_id: str):
    contract = get_contract()
    if not contract or not hasattr(contract.functions, "stateTransfers"):
        return None
    try:
        res = contract.functions.stateTransfers(trf_id).call()
        return {
            "transfer_id": res[0],
            "allocation_id": res[1],
            "state_name": res[2],
            "amount": float(res[3]),
            "allocated_to_districts": float(res[4]),
            "timestamp": int(res[5]),
            "exists": bool(res[6])
        }
    except Exception as e:
        bc_logger.warning(f"Error querying on-chain state transfer {trf_id}: {e}")
        return None

def get_onchain_district_allocation(dist_alloc_id: str):
    contract = get_contract()
    if not contract or not hasattr(contract.functions, "districtAllocations"):
        return None
    try:
        res = contract.functions.districtAllocations(dist_alloc_id).call()
        return {
            "dist_alloc_id": res[0],
            "transfer_id": res[1],
            "district_name": res[2],
            "amount": float(res[3]),
            "disbursed_to_projects": float(res[4]),
            "timestamp": int(res[5]),
            "exists": bool(res[6])
        }
    except Exception as e:
        bc_logger.warning(f"Error querying on-chain district allocation {dist_alloc_id}: {e}")
        return None

def get_onchain_project_escrow(project_id: str):
    contract = get_contract()
    if not contract or not hasattr(contract.functions, "projectEscrows"):
        return None
    try:
        res = contract.functions.projectEscrows(project_id).call()
        return {
            "project_id": res[0],
            "name": res[1],
            "contractor": res[2],
            "total_budget": float(res[3]),
            "released_amount": float(res[4]),
            "milestone_count": int(res[5]),
            "is_frozen": bool(res[6]),
            "freeze_reason": res[7],
            "exists": bool(res[9]) if len(res) > 9 else bool(res[0])
        }
    except Exception as e:
        bc_logger.warning(f"Error querying on-chain project escrow {project_id}: {e}")
        return None

def get_onchain_fund_transfer_record(transfer_key: str):
    contract = get_contract()
    if not contract or not hasattr(contract.functions, "fundTransferRecords"):
        return None
    try:
        res = contract.functions.fundTransferRecords(transfer_key).call()
        return {
            "transfer_key": transfer_key,
            "sender": res[0],
            "receiver": res[1],
            "sender_department": res[2],
            "receiver_department": res[3],
            "project_id": res[4],
            "amount": float(res[5]),
            "timestamp": int(res[6]),
            "exists": bool(res[7])
        }
    except Exception as e:
        bc_logger.warning(f"Error querying on-chain fund transfer record {transfer_key}: {e}")
        return None


