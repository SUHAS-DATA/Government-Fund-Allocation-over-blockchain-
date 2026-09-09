from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import get_current_user

router = APIRouter()
notification_bp = router

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
