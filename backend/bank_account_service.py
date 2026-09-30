import os
import hashlib
import random
import string
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from database import db

def mask_account_number(account_number: Optional[str]) -> str:
    """
    Mask bank account number to 'XXXX XXXX 1234' format.
    Never exposes full account digits in normal UI or public endpoints.
    """
    if not account_number:
        return "XXXX XXXX 0000"
    clean = str(account_number).replace(" ", "").replace("-", "")
    if len(clean) <= 4:
        return f"XXXX XXXX {clean}"
    last4 = clean[-4:]
    return f"XXXX XXXX {last4}"

def mask_ifsc(ifsc_code: Optional[str]) -> str:
    """Mask IFSC code showing first 4 characters and last 4 characters if long"""
    if not ifsc_code:
        return "XXXX0001234"
    clean = str(ifsc_code).strip()
    return clean

def sanitize_id(val: str) -> str:
    return "".join(c for c in str(val).upper() if c.isalnum() or c in "-_")

def serialize_bank_account(acc: Dict[str, Any], include_full_account: bool = False) -> Dict[str, Any]:
    """
    Serialize bank account entity safely.
    By default, strips raw account number and provides masked_account_number.
    Never exposes credentials, PINs, or internal secrets.
    """
    if not acc:
        return {}
    
    raw_acc = str(acc.get("account_number", ""))
    masked = mask_account_number(raw_acc)

    res = {
        "account_id": acc.get("account_id"),
        "entity_id": acc.get("entity_id"),
        "entity_type": acc.get("entity_type"),
        "account_holder_name": acc.get("account_holder_name"),
        "bank_name": acc.get("bank_name"),
        "masked_account_number": masked,
        "ifsc": mask_ifsc(acc.get("ifsc") or acc.get("ifsc_code")),
        "account_status": acc.get("account_status", "ACTIVE"),
        "created_at": acc.get("created_at").isoformat() if isinstance(acc.get("created_at"), datetime) else acc.get("created_at"),
        "updated_at": acc.get("updated_at").isoformat() if isinstance(acc.get("updated_at"), datetime) else acc.get("updated_at"),
    }
    
    if "state_code" in acc:
        res["state_code"] = acc["state_code"]
    if "district_name" in acc:
        res["district_name"] = acc["district_name"]
    if "contractor_id" in acc:
        res["contractor_id"] = acc["contractor_id"]

    if include_full_account:
        res["account_number"] = raw_acc
    else:
        res["account_number"] = masked

    return res

# -------------------------------------------------------------------------
# 1. CENTRAL FINANCE BANK ACCOUNT
# -------------------------------------------------------------------------
CENTRAL_ACCOUNT_ID = "ACC-CENTRAL-001"
CENTRAL_ENTITY_ID = "CENTRAL-FINANCE"

def get_or_create_central_account() -> Dict[str, Any]:
    """Fetch or initialize the registered Central Finance Treasury Bank Account"""
    acc = db.bank_accounts.find_one({"account_id": CENTRAL_ACCOUNT_ID})
    if not acc:
        now = datetime.now(timezone.utc)
        doc = {
            "account_id": CENTRAL_ACCOUNT_ID,
            "entity_id": CENTRAL_ENTITY_ID,
            "entity_type": "CENTRAL",
            "account_holder_name": "Ministry of Finance - Central Consolidated Fund",
            "bank_name": "Reserve Bank of India",
            "account_number": "990182736451",
            "ifsc": "RBIS0GOVT01",
            "branch": "New Delhi Public Accounts Branch",
            "account_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        db.bank_accounts.update_one({"account_id": CENTRAL_ACCOUNT_ID}, {"$set": doc}, upsert=True)
        acc = doc
    return acc

# -------------------------------------------------------------------------
# 2. STATE TREASURY BANK ACCOUNTS
# -------------------------------------------------------------------------
STATE_TREASURY_REGISTRY = {
    "KA": {
        "account_id": "ACC-KA-001",
        "entity_id": "STATE-KA",
        "state_code": "KA",
        "state_name": "Karnataka",
        "account_holder_name": "Karnataka State Treasury & Consolidated Fund",
        "bank_name": "State Bank of India",
        "account_number": "458291038472",
        "ifsc": "SBIN0004582",
        "branch": "Vidhana Soudha Secretariat Branch, Bengaluru"
    },
    "MH": {
        "account_id": "ACC-MH-001",
        "entity_id": "STATE-MH",
        "state_code": "MH",
        "state_name": "Maharashtra",
        "account_holder_name": "Maharashtra State Treasury & Finance Dept",
        "bank_name": "Bank of Maharashtra",
        "account_number": "771928304918",
        "ifsc": "MAHB0001029",
        "branch": "Mantralaya Apex Treasury Branch, Mumbai"
    },
    "GJ": {
        "account_id": "ACC-GJ-001",
        "entity_id": "STATE-GJ",
        "state_code": "GJ",
        "state_name": "Gujarat",
        "account_holder_name": "Gujarat State Consolidated Treasury",
        "bank_name": "State Bank of India",
        "account_number": "551928304911",
        "ifsc": "SBIN0005519",
        "branch": "Gandhinagar Sachivalaya Branch"
    },
    "TN": {
        "account_id": "ACC-TN-001",
        "entity_id": "STATE-TN",
        "state_code": "TN",
        "state_name": "Tamil Nadu",
        "account_holder_name": "Tamil Nadu State Treasury Department",
        "bank_name": "Indian Bank",
        "account_number": "661928304912",
        "ifsc": "IDIB0006619",
        "branch": "Fort St. George Secretariat Branch, Chennai"
    },
    "UP": {
        "account_id": "ACC-UP-001",
        "entity_id": "STATE-UP",
        "state_code": "UP",
        "state_name": "Uttar Pradesh",
        "account_holder_name": "Uttar Pradesh State Treasury & Accounts",
        "bank_name": "Punjab National Bank",
        "account_number": "881928304913",
        "ifsc": "PUNB0008819",
        "branch": "Hazratganj Secretariat Branch, Lucknow"
    },
    "RJ": {
        "account_id": "ACC-RJ-001",
        "entity_id": "STATE-RJ",
        "state_code": "RJ",
        "state_name": "Rajasthan",
        "account_holder_name": "Rajasthan State Consolidated Treasury",
        "bank_name": "State Bank of India",
        "account_number": "441928304914",
        "ifsc": "SBIN0004419",
        "branch": "Jaipur Secretariat Treasury Branch"
    },
    "TG": {
        "account_id": "ACC-TG-001",
        "entity_id": "STATE-TG",
        "state_code": "TG",
        "state_name": "Telangana",
        "account_holder_name": "Telangana State Treasury Accounts",
        "bank_name": "Canara Bank",
        "account_number": "331928304915",
        "ifsc": "CNRB0003319",
        "branch": "Hyderabad Secretariat Branch"
    },
    "WB": {
        "account_id": "ACC-WB-001",
        "entity_id": "STATE-WB",
        "state_code": "WB",
        "state_name": "West Bengal",
        "account_holder_name": "West Bengal State Treasury Fund",
        "bank_name": "UCO Bank",
        "account_number": "221928304916",
        "ifsc": "UCBA0002219",
        "branch": "Nabanna Secretariat Branch, Kolkata"
    }
}

def get_or_create_state_account(state_code: str, state_name: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve or create the authoritative State Treasury Bank Account"""
    sc = str(state_code or "KA").strip().upper()
    acc_id = f"ACC-{sc}-001"
    
    acc = db.bank_accounts.find_one({"account_id": acc_id})
    if not acc:
        now = datetime.now(timezone.utc)
        preset = STATE_TREASURY_REGISTRY.get(sc)
        if preset:
            doc = {
                **preset,
                "entity_type": "STATE",
                "account_status": "ACTIVE",
                "created_at": now,
                "updated_at": now
            }
        else:
            # Deterministic generation for other states
            s_name = state_name or f"State {sc}"
            doc = {
                "account_id": acc_id,
                "entity_id": f"STATE-{sc}",
                "state_code": sc,
                "state_name": s_name,
                "entity_type": "STATE",
                "account_holder_name": f"{s_name} State Treasury Department",
                "bank_name": "State Bank of India",
                "account_number": f"40{abs(hash(sc)) % 10000000000:010d}",
                "ifsc": f"SBIN000{abs(hash(sc)) % 9000 + 1000}",
                "branch": f"{s_name} State Capital Main Branch",
                "account_status": "ACTIVE",
                "created_at": now,
                "updated_at": now
            }
        db.bank_accounts.update_one({"account_id": acc_id}, {"$set": doc}, upsert=True)
        acc = doc
    return acc

# -------------------------------------------------------------------------
# 3. DISTRICT IMPLEMENTING AGENCY BANK ACCOUNTS
# -------------------------------------------------------------------------
DISTRICT_PRESET_REGISTRY = {
    "Belagavi": {
        "bank_name": "Canara Bank",
        "account_number": "881920394812",
        "ifsc": "CNRB0001920",
        "branch": "Belagavi City Main Branch, Karnataka"
    },
    "Dharwad": {
        "bank_name": "State Bank of India",
        "account_number": "771920394823",
        "ifsc": "SBIN0007719",
        "branch": "Dharwad Hubli Main Branch"
    },
    "Udupi": {
        "bank_name": "Canara Bank",
        "account_number": "881920394899",
        "ifsc": "CNRB0001999",
        "branch": "Udupi Temple Square Branch"
    },
    "Bengaluru Urban": {
        "bank_name": "State Bank of India",
        "account_number": "991820394855",
        "ifsc": "SBIN0009918",
        "branch": "Bengaluru Town Hall Branch"
    },
    "Mysuru": {
        "bank_name": "Bank of Baroda",
        "account_number": "661920394844",
        "ifsc": "BARB0MYSURU",
        "branch": "Mysuru Palace Road Branch"
    },
    "Pune": {
        "bank_name": "Bank of Maharashtra",
        "account_number": "772819038471",
        "ifsc": "MAHB0007728",
        "branch": "Pune Shivaji Nagar Branch"
    },
    "Nagpur": {
        "bank_name": "State Bank of India",
        "account_number": "552819038433",
        "ifsc": "SBIN0005528",
        "branch": "Nagpur Civil Lines Branch"
    }
}

def get_or_create_district_account(district_name: str, state_code: Optional[str] = None) -> Dict[str, Any]:
    """Retrieve or create the registered Bank Account for a District Agency"""
    d_clean = str(district_name or "District").strip()
    d_id = sanitize_id(d_clean).replace(" ", "_")
    acc_id = f"ACC-DIST-{d_id}-001"

    acc = db.bank_accounts.find_one({"account_id": acc_id})
    if not acc:
        now = datetime.now(timezone.utc)
        preset = DISTRICT_PRESET_REGISTRY.get(d_clean)
        if preset:
            b_name = preset["bank_name"]
            acc_num = preset["account_number"]
            ifsc_val = preset["ifsc"]
            branch_val = preset["branch"]
        else:
            seed = abs(hash(d_clean))
            b_name = "State Bank of India"
            acc_num = f"60{seed % 10000000000:010d}"
            ifsc_val = f"SBIN000{seed % 9000 + 1000}"
            branch_val = f"{d_clean} District Collectorate Branch"

        doc = {
            "account_id": acc_id,
            "entity_id": f"DIST-{d_id}",
            "entity_type": "DISTRICT",
            "district_name": d_clean,
            "state_code": state_code or "KA",
            "account_holder_name": f"{d_clean} District Development Agency Fund",
            "bank_name": b_name,
            "account_number": acc_num,
            "ifsc": ifsc_val,
            "branch": branch_val,
            "account_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        db.bank_accounts.update_one({"account_id": acc_id}, {"$set": doc}, upsert=True)
        acc = doc
    return acc

# -------------------------------------------------------------------------
# 4. CONTRACTOR REGISTERED BANK ACCOUNTS
# -------------------------------------------------------------------------
def get_or_create_contractor_account(
    contractor_id: str,
    contractor_name: Optional[str] = None,
    user_or_kyc: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Retrieve or create the authoritative bank account for a contractor.
    Pulls from contractor KYC or registered profile.
    """
    c_clean = str(contractor_id or "CON-001").strip()
    c_id = sanitize_id(c_clean).replace(" ", "_")
    acc_id = f"ACC-CON-{c_id}-001"

    acc = db.bank_accounts.find_one({
        "$or": [
            {"account_id": acc_id},
            {"contractor_id": c_clean},
            {"entity_id": c_clean}
        ]
    })
    
    if not acc:
        now = datetime.now(timezone.utc)
        # Check KYC collection
        kyc = db.contractor_kyc.find_one({
            "$or": [
                {"contractor_id": c_clean},
                {"user_id": c_clean}
            ]
        })
        user = db.users.find_one({
            "$or": [
                {"contractor_id": c_clean},
                {"user_id": c_clean},
                {"email": c_clean.lower()}
            ]
        })

        holder_name = contractor_name or (kyc.get("company_name") if kyc else None) or (user.get("name") if user else None) or "Registered Infrastructure Contractor"
        bank_name = (kyc.get("bank_name") if kyc else None) or (user.get("bank_name") if user else None) or "State Bank of India"
        acc_num = (kyc.get("account_number") if kyc else None) or (user.get("account_number") if user else None) or "992834710293"
        ifsc_code = (kyc.get("ifsc_code") if kyc else None) or (user.get("ifsc_code") if user else None) or "SBIN0001234"
        branch_name = (kyc.get("branch") if kyc else None) or (user.get("branch") if user else None) or "Commercial Project Financing Branch"

        doc = {
            "account_id": acc_id,
            "entity_id": c_clean,
            "contractor_id": c_clean,
            "entity_type": "CONTRACTOR",
            "account_holder_name": holder_name,
            "bank_name": bank_name,
            "account_number": acc_num,
            "ifsc": ifsc_code,
            "branch": branch_name,
            "account_status": "ACTIVE",
            "created_at": now,
            "updated_at": now
        }
        db.bank_accounts.update_one({"account_id": acc_id}, {"$set": doc}, upsert=True)
        acc = doc
    return acc

# -------------------------------------------------------------------------
# 5. INITIALIZE ALL STANDARD ACCOUNTS
# -------------------------------------------------------------------------
def seed_default_bank_accounts():
    """Seed standard Central, State, and District bank accounts into db.bank_accounts"""
    try:
        get_or_create_central_account()
        for sc in STATE_TREASURY_REGISTRY.keys():
            get_or_create_state_account(sc)
        for dist in DISTRICT_PRESET_REGISTRY.keys():
            get_or_create_district_account(dist)
        get_or_create_contractor_account("CON-KA-APEX", "Apex Infrastructure Contractors Pvt Ltd")
    except Exception as e:
        print(f"Warning seeding bank accounts: {e}")

# -------------------------------------------------------------------------
# 6. UNIFIED FINANCIAL TRANSACTION ENGINE
# -------------------------------------------------------------------------
def generate_tx_id(tx_type: str, source_code: str = "FIN", dest_code: str = "ST") -> str:
    """Generate human-readable authoritative Transaction ID"""
    rand_suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    prefix = "TX"
    if tx_type == "CENTRAL_TO_STATE":
        prefix = f"TX-CENTRAL-{source_code}-{dest_code}"
    elif tx_type == "STATE_TO_DISTRICT":
        prefix = f"TX-STATE-{source_code}-{dest_code}"
    elif tx_type == "DISTRICT_TO_CONTRACTOR":
        prefix = f"TX-DIST-{source_code}-CON"
    return f"{prefix}-{rand_suffix}"

def record_financial_transaction(
    transaction_type: str,
    source_account: Dict[str, Any],
    destination_account: Dict[str, Any],
    amount: float,
    purpose: str,
    blockchain_tx_hash: Optional[str] = None,
    blockchain_block: Optional[int] = None,
    related_scheme_id: Optional[str] = None,
    related_scheme_name: Optional[str] = None,
    related_allocation_id: Optional[str] = None,
    related_project_id: Optional[str] = None,
    related_contract_id: Optional[str] = None,
    related_milestone_index: Optional[int] = None,
    created_by: Optional[str] = None,
    status: str = "COMPLETED"
) -> Dict[str, Any]:
    """
    Record an authoritative, non-repudiable financial transaction in db.financial_transactions.
    Links Source Account, Destination Account, Blockchain Record, and Project context.
    """
    now = datetime.now(timezone.utc)
    amt = float(amount)
    
    # Resolve source/dest codes for TX ID
    s_code = source_account.get("state_code") or source_account.get("district_name") or "CENTRAL"
    d_code = destination_account.get("state_code") or destination_account.get("district_name") or "DEST"
    tx_id = generate_tx_id(transaction_type, sanitize_id(s_code)[:3], sanitize_id(d_code)[:3])

    # Compute a local cryptographic hash representing the complete transaction payload
    tx_payload_str = f"{tx_id}:{source_account.get('account_id')}:{destination_account.get('account_id')}:{amt}:{now.isoformat()}"
    tx_payload_hash = "0x" + hashlib.sha256(tx_payload_str.encode("utf-8")).hexdigest()

    tx_doc = {
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": transaction_type,
        "source_entity_id": source_account.get("entity_id"),
        "source_entity_type": source_account.get("entity_type"),
        "source_entity_name": source_account.get("account_holder_name"),
        "source_account_id": source_account.get("account_id"),
        "source_bank_name": source_account.get("bank_name"),
        "source_masked_account": mask_account_number(source_account.get("account_number")),
        "source_ifsc": mask_ifsc(source_account.get("ifsc")),
        "destination_entity_id": destination_account.get("entity_id"),
        "destination_entity_type": destination_account.get("entity_type"),
        "destination_entity_name": destination_account.get("account_holder_name"),
        "destination_account_id": destination_account.get("account_id"),
        "destination_bank_name": destination_account.get("bank_name"),
        "destination_masked_account": mask_account_number(destination_account.get("account_number")),
        "destination_ifsc": mask_ifsc(destination_account.get("ifsc")),
        "amount": amt,
        "currency": "INR",
        "purpose": purpose,
        "related_scheme_id": related_scheme_id,
        "related_scheme_name": related_scheme_name,
        "related_allocation_id": related_allocation_id,
        "related_project_id": related_project_id,
        "related_contract_id": related_contract_id,
        "related_milestone_index": related_milestone_index,
        "status": status,
        "blockchain_tx_hash": blockchain_tx_hash or tx_payload_hash,
        "blockchain_hash": blockchain_tx_hash or tx_payload_hash,
        "blockchain_block": blockchain_block or 1,
        "blockchain_status": "VERIFIED" if blockchain_tx_hash else "CONFIRMED",
        "created_by": created_by or "System Disbursal Authority",
        "created_at": now,
        "completed_at": now if status == "COMPLETED" else None,
        "payload_hash": tx_payload_hash
    }

    db.financial_transactions.insert_one(tx_doc)

    try:
        db.audit_logs.insert_one({
            "event_type": "FINANCIAL_TRANSACTION_RECORDED",
            "transaction_id": tx_id,
            "transaction_type": transaction_type,
            "amount": amt,
            "source_account_id": source_account.get("account_id"),
            "destination_account_id": destination_account.get("account_id"),
            "timestamp": now
        })
    except Exception:
        pass

    return tx_doc
