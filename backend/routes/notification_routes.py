from datetime import datetime
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import token_required

notification_bp = Blueprint("notification_bp", __name__)

@notification_bp.route("", methods=["GET"])
@token_required
def get_notifications():
    user = g.current_user
    user_id = user.get("user_id")
    role = user.get("role")

    query = {
        "$or": [
            {"recipient_user_id": user_id},
            {"recipient_role": role},
            {"recipient_role": "ALL"}
        ]
    }

    notifications = list(db.notifications.find(query).sort("created_at", -1).limit(50))
    unread_count = len([n for n in notifications if not n.get("read")])

    return jsonify({
        "success": True,
        "unread_count": unread_count,
        "notifications": serialize_doc(notifications)
    })

@notification_bp.route("/<notification_id>/read", methods=["PUT"])
@token_required
def mark_read(notification_id):
    db.notifications.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"read": True}}
    )
    return jsonify({"success": True, "message": "Notification marked as read"})

@notification_bp.route("/read-all", methods=["PUT"])
@token_required
def mark_all_read():
    user = g.current_user
    user_id = user.get("user_id")
    role = user.get("role")

    db.notifications.update_many(
        {"$or": [{"recipient_user_id": user_id}, {"recipient_role": role}]},
        {"$set": {"read": True}}
    )
    return jsonify({"success": True, "message": "All notifications marked as read"})
