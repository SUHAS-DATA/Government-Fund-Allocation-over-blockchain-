import re
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import get_current_user

router = APIRouter()
notification_bp = router

def format_denomination(amount):
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    
    if amt >= 10000000:
        cr_val = amt / 10000000
        val_str = f"{cr_val:.2f}".rstrip('0').rstrip('.') if not cr_val.is_integer() else f"{int(cr_val)}"
        return f"{val_str} (Cr)"
    elif amt >= 100000:
        lakh_val = amt / 100000
        val_str = f"{lakh_val:.2f}".rstrip('0').rstrip('.') if not lakh_val.is_integer() else f"{int(lakh_val)}"
        return f"{val_str} (Lakh)"
    elif amt >= 1000:
        k_val = amt / 1000
        val_str = f"{k_val:.2f}".rstrip('0').rstrip('.') if not k_val.is_integer() else f"{int(k_val)}"
        return f"{val_str} (k)"
    else:
        return f"₹{amt:,.2f}"

def transform_notification_message(msg):
    if not msg or not isinstance(msg, str):
        return msg
    
    def repl_parens(match):
        val_str = match.group(1).replace(",", "")
        try:
            val = float(val_str)
            return f"({format_denomination(val)})"
        except ValueError:
            return match.group(0)
            
    msg = re.sub(r'\(INR\s+([\d,]+(?:\.\d+)?)\)', repl_parens, msg)

    def repl_plain(match):
        val_str = match.group(1).replace(",", "")
        try:
            val = float(val_str)
            return format_denomination(val)
        except ValueError:
            return match.group(0)

    msg = re.sub(r'INR\s+([\d,]+(?:\.\d+)?)', repl_plain, msg)
    return msg

def get_user_notification_query(current_user: dict) -> dict:
    """
    Construct scoped MongoDB filter ensuring users only see notifications directed
    to their identity, role, or matching geographical jurisdiction.
    """
    user_id = current_user.get("user_id")
    role = current_user.get("role")
    state_code = current_user.get("state_code")
    district_name = current_user.get("district_name")

    base_or = [
        {"recipient_user_id": user_id},
        {"recipient_role": "ALL"}
    ]

    if role in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        base_or.append({"recipient_role": role})
    elif role == "STATE":
        state_cond = {"recipient_role": "STATE"}
        if state_code:
            sc_clean = state_code.strip().upper()
            state_cond["$or"] = [
                {"recipient_state_code": sc_clean},
                {"recipient_state": sc_clean}
            ]
        else:
            state_cond["$or"] = [
                {"recipient_state_code": None},
                {"recipient_state": None},
                {"recipient_state_code": {"$exists": False}},
                {"recipient_state": {"$exists": False}}
            ]
        base_or.append(state_cond)
    elif role == "DISTRICT":
        dist_cond = {"recipient_role": "DISTRICT"}
        sub = []
        if district_name:
            d_clean = district_name.strip()
            sub.extend([
                {"recipient_district": d_clean},
                {"recipient_district_name": d_clean}
            ])
        if state_code:
            sc_clean = state_code.strip().upper()
            sub.extend([
                {"recipient_state_code": sc_clean},
                {"recipient_state": sc_clean}
            ])
        if sub:
            dist_cond["$or"] = sub
        else:
            dist_cond["$or"] = [
                {"recipient_district": None, "recipient_state_code": None},
                {"recipient_district": {"$exists": False}, "recipient_state_code": {"$exists": False}}
            ]
        base_or.append(dist_cond)
    elif role == "CONTRACTOR":
        base_or.append({"recipient_role": "CONTRACTOR", "recipient_user_id": user_id})

    return {"$or": base_or}

@router.get("")
async def get_notifications(
    current_user: dict = Depends(get_current_user)
):
    query = get_user_notification_query(current_user)

    notifications = list(db.notifications.find(query).sort("created_at", -1).limit(50))
    for n in notifications:
        if "message" in n:
            n["message"] = transform_notification_message(n["message"])
        if "title" in n:
            n["title"] = transform_notification_message(n["title"])

    unread_count = len([n for n in notifications if not n.get("read")])

    return {
        "success": True,
        "unread_count": unread_count,
        "notifications": serialize_doc(notifications)
    }

@router.put("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        oid = ObjectId(notification_id)
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Invalid notification ID"}
        )

    # Scoped query prevents marking other users' or jurisdictions' notifications
    query = get_user_notification_query(current_user)
    query["_id"] = oid

    res = db.notifications.update_one(
        query,
        {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Notification not found or access denied"}
        )

    return {"success": True, "message": "Notification marked as read"}

@router.put("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user)
):
    query = get_user_notification_query(current_user)

    db.notifications.update_many(
        query,
        {"$set": {"read": True}}
    )
    return {"success": True, "message": "All notifications marked as read"}
