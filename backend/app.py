import os
import logging
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Database & Blockchain
from database import db, init_indexes
from seed_data import seed
import blockchain_service as bcs

# Blueprints
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.finance_routes import finance_bp
from routes.state_routes import state_bp
from routes.district_routes import district_bp
from routes.contractor_routes import contractor_bp
from routes.auditor_routes import auditor_bp
from routes.public_routes import public_bp
from routes.notification_routes import notification_bp
from routes.blockchain_routes import blockchain_bp

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

app = Flask(__name__)

# Configurable CORS
cors_origins = os.getenv("CORS_ORIGINS", "*")
CORS(app, resources={r"/api/*": {"origins": cors_origins}}, supports_credentials=True)

# Security Response Headers
@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Static file serving for off-chain document repository
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# Blueprint Registration
app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(admin_bp, url_prefix="/api/admin")
app.register_blueprint(finance_bp, url_prefix="/api/finance")
app.register_blueprint(state_bp, url_prefix="/api/state")
app.register_blueprint(district_bp, url_prefix="/api/district")
app.register_blueprint(contractor_bp, url_prefix="/api/contractor")
app.register_blueprint(auditor_bp, url_prefix="/api/auditor")
app.register_blueprint(public_bp, url_prefix="/api/public")
app.register_blueprint(notification_bp, url_prefix="/api/notifications")
app.register_blueprint(blockchain_bp, url_prefix="/api/blockchain")

# Diagnostic & Health Check API
@app.route("/api/health", methods=["GET"])
def health():
    db_status = "CONNECTED"
    try:
        db.command("ping")
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    bc_connected = bcs.is_blockchain_connected()

    return jsonify({
        "status": "HEALTHY",
        "environment": os.getenv("FLASK_ENV", "production"),
        "database": db_status,
        "blockchain": {
            "connected": bc_connected,
            "contract_address": bcs.contract_address,
            "chain_id": 31337
        }
    })

# Global 404 & 500 error handlers for API consistency
@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith("/api/"):
        return jsonify({"success": False, "message": "API resource endpoint not found"}), 404
    return jsonify({"error": "Not Found"}), 404

@app.errorhandler(500)
def internal_error(error):
    logging.error(f"Internal Server Error on {request.path}: {error}")
    return jsonify({"success": False, "message": "Internal server processing error. Please check server logs."}), 500

if __name__ == "__main__":
    init_indexes()
    seed()
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
