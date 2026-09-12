import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
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

@router.get("")
async def get_notifications(
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id")
    role = current_user.get("role")

    query = {
        "$or": [
            {"recipient_user_id": user_id},
            {"recipient_role": role},
            {"recipient_role": "ALL"}
        ]
    }

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
    db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True}}
    )
    return {"success": True, "message": "Notification marked as read"}

@router.put("/read-all")
async def mark_all_read(
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("user_id")
    role = current_user.get("role")

    db.notifications.update_many(
        {"$or": [{"recipient_user_id": user_id}, {"recipient_role": role}]},
        {"$set": {"read": True}}
    )
    return {"success": True, "message": "All notifications marked as read"}
