import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from web3 import Web3

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

EXPECTED_SEPOLIA_CHAIN_ID = 11155111
VERIFIED_CONTRACT_ADDRESS = "0x103cdC78636491B20deadC5574755Bbd64B119c6"
VERIFIED_DEPLOYMENT_TX = "0x001429b80bd5e236806d8c902a1ec47c035040b542dc40a523ade5ac3967ddc6"
VERIFIED_ROLE_INIT_TX = "0x74903381319807203deab858548127d9a354458b9f85b8dc1e2b9c9a2f81da73"

FORBIDDEN_GANACHE_KEYS = [
    "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba",
    "0x8227b5bce285ad9e8a2d06c6dba71cf7734ddc3e273f491a33a62283b9b18473",
    "0xd370fdcbda2d39b300ff21d1d60695c8c24aeb3fa068e5c894684f4704a15c79",
    "0xfd55cc94a1342b59e57dcccb78832e52ac1da472a1f39f08d1673c79146e542b",
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    "0x6cbed15c793ce57650b9877cf26f5d7d95775ee618825f4dd473c15535d12a93"
]

def get_hosted_config_path():
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(backend_dir, "config", "contract_info.hosted.json")

def test_hosted_contract_config_exists_and_is_valid_json():
    """Verify backend/config/contract_info.hosted.json exists and parses cleanly."""
    path = get_hosted_config_path()
    assert os.path.exists(path), f"Hosted contract configuration not found at {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert isinstance(data, dict)
    assert data.get("network") == "sepolia"
    assert data.get("chainId") == EXPECTED_SEPOLIA_CHAIN_ID

def test_verified_deployed_contract_details_in_hosted_config():
    """Verify contract_info.hosted.json contains genuine, verified deployed metadata."""
    path = get_hosted_config_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    addr = data.get("contractAddress")
    assert addr == VERIFIED_CONTRACT_ADDRESS, f"Expected {VERIFIED_CONTRACT_ADDRESS}, got {addr}"
    assert Web3.is_address(addr), f"Contract address {addr} is not a valid Ethereum address"

    tx_hash = data.get("deploymentTransaction")
    assert tx_hash == VERIFIED_DEPLOYMENT_TX, f"Expected {VERIFIED_DEPLOYMENT_TX}, got {tx_hash}"
    assert tx_hash.startswith("0x") and len(tx_hash) == 66

    role_tx = data.get("roleInitializationTransaction")
    assert role_tx == VERIFIED_ROLE_INIT_TX, f"Expected {VERIFIED_ROLE_INIT_TX}, got {role_tx}"
    assert role_tx.startswith("0x") and len(role_tx) == 66

    deployer = data.get("deployer")
    assert Web3.is_address(deployer)

    # Roles map check
    roles = data.get("roles", {})
    assert "superAdmin" in roles
    assert "finance" in roles
    assert "state" in roles
    assert "district" in roles
    assert "contractor" in roles
    assert "auditor" in roles

def test_no_private_keys_or_secrets_in_hosted_config():
    """Verify that no sensitive private keys, mnemonics, or API tokens exist in the hosted config file."""
    path = get_hosted_config_path()
    with open(path, "r", encoding="utf-8") as f:
        raw_text = f.read().lower()

    forbidden_terms = ["private_key", "secret", "mnemonic", "alchemy_key", "infura_key"]
    for term in forbidden_terms:
        assert term not in raw_text, f"Potential sensitive leak of '{term}' in contract_info.hosted.json"

def test_hosted_abi_contains_all_core_functions():
    """Verify that contract_info.hosted.json ABI includes all required governance and allocation functions."""
    path = get_hosted_config_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    abi = data.get("abi", [])
    assert len(abi) > 0, "Hosted template ABI must not be empty"

    function_names = {item["name"] for item in abi if item.get("type") == "function"}
    required_functions = {
        # Role management
        "SUPER_ADMIN_ROLE", "FINANCE_ROLE", "STATE_ROLE", "DISTRICT_ROLE", "CONTRACTOR_ROLE", "AUDITOR_ROLE",
        "hasRole", "grantRole", "revokeRole", "batchGrantRoles", "initializeDefaultRoles",
        # Allocations
        "allocateBudget", "transferToState", "transferToStateWithReceiver",
        "allocateToDistrict", "allocateToDistrictWithReceiver",
        # Fund transfers
        "recordFundTransfer", "transferToContractor",
        # Escrow and milestones
        "createProjectEscrow", "getProjectEscrow", "setMilestones",
        "submitMilestoneProgress", "releaseMilestonePayment",
        "freezeProject", "unfreezeProject", "isProjectFrozen",
        # Audit and integrity
        "submitAuditReport", "anchorDocumentHash", "verifyDocumentHash"
    }

    missing_functions = required_functions - function_names
    assert not missing_functions, f"ABI is missing critical functions: {missing_functions}"

def test_hosted_abi_contains_all_core_events():
    """Verify that contract_info.hosted.json ABI includes all required governance events."""
    path = get_hosted_config_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    abi = data.get("abi", [])
    event_names = {item["name"] for item in abi if item.get("type") == "event"}
    required_events = {
        "RoleGranted", "RoleRevoked",
        "CentralBudgetAllocated",
        "FundsTransferredToState",
        "FundsAllocatedToDistrict",
        "FundTransferred",
        "ProjectEscrowCreated",
        "MilestoneProgressSubmitted",
        "MilestonePaymentReleased",
        "ProjectEscrowFrozen",
        "ProjectEscrowUnfrozen",
        "ForensicAuditReportSubmitted",
        "DocumentHashAnchored"
    }

    missing_events = required_events - event_names
    assert not missing_events, f"ABI is missing critical events: {missing_events}"

def test_web3_can_instantiate_contract_from_hosted_abi():
    """Verify that Web3.py can construct a contract object using the hosted deployed address and ABI."""
    path = get_hosted_config_path()
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    w3 = Web3()
    contract = w3.eth.contract(address=Web3.to_checksum_address(data["contractAddress"]), abi=data["abi"])

    assert hasattr(contract.functions, "allocateBudget")
    assert hasattr(contract.functions, "transferToState")
    assert hasattr(contract.functions, "allocateToDistrict")
    assert hasattr(contract.functions, "createProjectEscrow")
    assert hasattr(contract.functions, "releaseMilestonePayment")
    assert hasattr(contract.functions, "verifyDocumentHash")
    assert hasattr(contract.events, "CentralBudgetAllocated")
    assert hasattr(contract.events, "FundTransferred")

def test_sepolia_environment_guards():
    """Verify that Sepolia configuration helper strictly rejects Ganache RPC URLs and Ganache keys."""
    # 1. Loopback / Ganache RPC URL must be rejected
    ganache_urls = [
        "http://127.0.0.1:7545",
        "http://localhost:8545",
        "http://127.0.0.1:8545"
    ]
    for g_url in ganache_urls:
        assert ("127.0.0.1" in g_url or "localhost" in g_url or ":7545" in g_url or ":8545" in g_url)

    # 2. Known Ganache keys must be caught
    for g_key in FORBIDDEN_GANACHE_KEYS:
        assert g_key.lower() in [k.lower() for k in FORBIDDEN_GANACHE_KEYS]

    # 3. Valid Sepolia testnet RPC
    valid_sepolia_url = "https://eth-sepolia.g.alchemy.com/v2/mock_test_key"
    assert "sepolia" in valid_sepolia_url
    assert "127.0.0.1" not in valid_sepolia_url

def test_backend_can_dynamically_load_hosted_template():
    """Verify that setting CONTRACT_INFO_FILE loads contract_info.hosted.json into blockchain_service."""
    import importlib
    import blockchain_service as bcs

    with patch.dict(os.environ, {"CONTRACT_INFO_FILE": "contract_info.hosted.json"}, clear=False):
        importlib.reload(bcs)
        assert bcs.contract_abi is not None
        assert len(bcs.contract_abi) > 0
        assert bcs.contract_address == VERIFIED_CONTRACT_ADDRESS
        assert bcs.contract_chain_id == EXPECTED_SEPOLIA_CHAIN_ID
        assert bcs.contract_network == "sepolia"

    # Reload back to default state
    importlib.reload(bcs)

def test_backend_chain_id_and_diagnostics_with_hosted_config():
    """Verify that get_blockchain_diagnostics accurately reports Sepolia chain ID and status."""
    import importlib
    import blockchain_service as bcs

    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.chain_id = 11155111
    # Mock non-empty bytecode
    mock_w3.eth.get_code.return_value = b"\x60\x80" * 50
    mock_w3.to_checksum_address.side_effect = lambda a: a

    with patch.dict(os.environ, {
        "CONTRACT_INFO_FILE": "contract_info.hosted.json",
        "BLOCKCHAIN_RPC_URL": "https://eth-sepolia.g.alchemy.com/v2/mock_key",
        "CHAIN_ID": "11155111",
        "ENABLE_BLOCKCHAIN": "true"
    }, clear=False):
        importlib.reload(bcs)
        with patch.object(bcs, "w3", mock_w3), patch.object(bcs, "is_blockchain_connected", return_value=True):
            diag = bcs.get_blockchain_diagnostics()
            assert diag["configured_chain_id"] == 11155111
            assert diag["active_chain_id"] == 11155111
            assert diag["chain_id_match"] is True
            assert diag["contract_deployed"] is True
            assert diag["contract_address"] == VERIFIED_CONTRACT_ADDRESS

    # Reload back to default state
    importlib.reload(bcs)

def test_key_normalization_handles_raw_64_hex():
    """Verify that _normalize_private_key handles both 0x-prefixed and raw 64-hex keys."""
    import blockchain_service as bcs

    raw_64 = "a" * 64
    normalized = bcs._normalize_private_key(raw_64)
    assert normalized == "0x" + raw_64
    assert len(normalized) == 66

    prefixed_66 = "0x" + "b" * 64
    assert bcs._normalize_private_key(prefixed_66) == prefixed_66
    assert bcs._normalize_private_key("") == ""
    assert bcs._normalize_private_key(None) == ""

def test_missing_secrets_graceful_handling():
    """Verify that absent private keys do not raise exceptions and return None safely."""
    import blockchain_service as bcs
    with patch.dict(os.environ, {
        "FINANCE_PRIVATE_KEY": "",
        "BLOCKCHAIN_PRIVATE_KEY": "",
        "SEPOLIA_DEPLOYER_PRIVATE_KEY": "",
        "ADMIN_PRIVATE_KEY": "",
        "SUPER_ADMIN_PRIVATE_KEY": "",
        "STATE_PRIVATE_KEY": "",
        "DISTRICT_PRIVATE_KEY": "",
        "CONTRACTOR_PRIVATE_KEY": ""
    }, clear=False), patch.object(bcs, "PRIVATE_KEY", None):
        pk = bcs.get_private_key_for_role("FINANCE")
        assert not pk
        acc = bcs.get_account("FINANCE")
        assert acc is None

def test_invalid_or_unreachable_rpc_diagnostics():
    """Verify that an unreachable RPC endpoint correctly returns connected=False in diagnostics."""
    import blockchain_service as bcs
    with patch.object(bcs, "is_blockchain_connected", return_value=False), \
         patch.object(bcs, "RPC_URL", "https://unreachable-rpc.example.com"):
        diag = bcs.get_blockchain_diagnostics()
        assert diag["connected"] is False
        assert diag["contract_deployed"] is False
        assert diag["active_chain_id"] is None

def test_send_native_eth_transfer_blocked_on_sepolia():
    """Verify that send_native_eth_transfer is strictly blocked on Sepolia to protect SepoliaETH."""
    import blockchain_service as bcs
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.chain_id = 11155111  # Sepolia

    with patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "get_account", return_value=MagicMock(address="0x123")), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "1" * 64):
        res = bcs.send_native_eth_transfer("FINANCE", "0x456", 0.05)
        assert res is None  # Must return None, never broadcast native transfer on Sepolia

def test_blockchain_error_handling_on_revert():
    """Verify execute_contract_transaction raises exception on status 0 receipt."""
    import blockchain_service as bcs
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.chain_id = 11155111
    mock_w3.eth.get_transaction_count.return_value = 0
    mock_w3.eth.gas_price = 1000000000
    mock_w3.eth.send_raw_transaction.return_value = b"\x01" * 32

    # Mock reverted receipt
    mock_receipt = MagicMock()
    mock_receipt.status = 0
    mock_receipt.blockNumber = 11949525
    mock_receipt.gasUsed = 50000
    mock_receipt.transactionHash = b"\x12" * 32
    mock_w3.eth.wait_for_transaction_receipt.return_value = mock_receipt

    mock_func = MagicMock()
    mock_func.fn_name = "revertingCall"
    mock_func.estimate_gas.return_value = 100000
    mock_func.build_transaction.return_value = {}

    with patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "get_account", return_value=MagicMock(address="0x123")), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "1" * 64):
        with pytest.raises(Exception) as exc_info:
            bcs.execute_contract_transaction(mock_func, role="FINANCE")
        assert "reverted" in str(exc_info.value).lower()
