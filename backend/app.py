import os
import logging
import asyncio
import time
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn

# Database & Blockchain
from database import db, init_indexes, init_db
from seed_data import seed
import blockchain_service as bcs
from realtime_manager import realtime_manager

# Routers
from routes.auth_routes import auth_bp
from routes.admin_routes import admin_bp
from routes.finance_routes import finance_bp
from routes.state_routes import state_bp
from routes.district_routes import district_bp
from routes.contractor_routes import contractor_bp
from routes.public_routes import public_bp
from routes.notification_routes import notification_bp
from routes.blockchain_routes import blockchain_bp
from routes.evidence_routes import router as evidence_bp
from routes.transaction_routes import transaction_bp

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

def validate_environment():
    """
    Validates required configuration on startup.
    Fails fast in production on missing or insecure secrets.
    """
    env = os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "development"
    is_prod = env.lower() in ["production", "prod"]
    
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret:
        raise RuntimeError("Startup Validation Failed: 'JWT_SECRET' is not configured.")
    if len(jwt_secret) < 32:
        msg = f"'JWT_SECRET' length is {len(jwt_secret)} chars. Recommended minimum is 32 characters for HS256."
        if is_prod:
            raise RuntimeError(f"Startup Validation Failed: {msg}")
        else:
            logging.warning(f"[SECURITY_WARNING] {msg}")

    known_insecure_secrets = [
        "super-secure-govtfund-secret-key-blockchain-2026",
        "super_secret_national_pfs_blockchain_key_2026",
        "super_secret_national_pfs_blockchain_key_2026_production"
    ]
    if is_prod and jwt_secret in known_insecure_secrets:
        raise RuntimeError("Startup Validation Failed: Production environment cannot use default example JWT_SECRET.")

    mongo_uri = os.getenv("MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError("Startup Validation Failed: 'MONGODB_URI' is not configured.")

    contract_addr = os.getenv("CONTRACT_ADDRESS")
    if contract_addr and not (contract_addr.startswith("0x") and len(contract_addr) == 42):
        logging.warning(f"[SECURITY_WARNING] CONTRACT_ADDRESS '{contract_addr}' is not a valid 42-character hex address.")
        if is_prod:
            raise RuntimeError("Startup Validation Failed: Invalid CONTRACT_ADDRESS in production.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("System startup: Validating security configuration...")
    try:
        validate_environment()
        logging.info("[CONFIG_VERIFIED] Environment and security configuration verified.")
    except Exception as e:
        logging.critical(f"[STARTUP_CONFIG_ERROR] {e}")
        raise

    logging.info("System startup: Initializing database indexes and seed data...")
    try:
        loop = asyncio.get_running_loop()
        realtime_manager.set_loop(loop)
    except Exception as e:
        logging.warning(f"Could not bind event loop to realtime_manager: {e}")
    try:
        init_db()
    except Exception as e:
        logging.warning(f"Database initialization warning: {e}")
    try:
        seed()
    except Exception as e:
        logging.warning(f"Database seed warning: {e}")

    # Run blockchain diagnostics in background thread so HTTP requests and login aren't delayed by external RPC checks
    def _run_diag():
        try:
            diag = bcs.get_blockchain_diagnostics()
            if diag.get("warnings"):
                for w in diag["warnings"]:
                    logging.warning(f"[BLOCKCHAIN_CONFIG_ADVISORY] {w}")
            else:
                logging.info(f"[BLOCKCHAIN_READY] Connected to chain {diag['active_chain_id']} at {diag['rpc_url']}")
        except Exception as e:
            logging.warning(f"Startup blockchain diagnostic warning: {e}")

    try:
        asyncio.create_task(asyncio.to_thread(_run_diag))
    except Exception as e:
        logging.warning(f"Could not dispatch background blockchain diagnostic: {e}")

    yield
    logging.info("System shutdown.")

app = FastAPI(
    title="PFMS Blockchain National Fund Allocation System",
    description="Decentralized multi-tier government budget allocation, state treasury transfer, project escrow, and milestone release tracking platform.",
    version="2.0.0",
    lifespan=lifespan
)

# Approved Origins Configuration (No wildcard reflections with credentials)
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
]

configured_cors = os.getenv("CORS_ORIGINS", "")
approved_origins = set(DEFAULT_ALLOWED_ORIGINS)
for o in configured_cors.split(","):
    clean = o.strip()
    if clean and clean != "*":
        approved_origins.add(clean)

def is_origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    if origin in approved_origins:
        return True
    import re
    if re.match(r"^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$", origin):
        return True
    return False

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(approved_origins),
    allow_origin_regex=r"^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# Comprehensive CORS Preflight & Security Headers Middleware
@app.middleware("http")
async def cors_and_security_middleware(request: Request, call_next):
    # Handle preflight OPTIONS requests strictly for approved origins
    if request.method == "OPTIONS":
        origin = request.headers.get("origin")
        preflight_headers = {
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") or "*",
            "Access-Control-Max-Age": "86400",
            "Access-Control-Allow-Private-Network": "true",
        }
        if origin and is_origin_allowed(origin):
            preflight_headers["Access-Control-Allow-Origin"] = origin
            preflight_headers["Access-Control-Allow-Credentials"] = "true"
        return JSONResponse(
            status_code=200,
            content={"message": "OK"},
            headers=preflight_headers
        )

    try:
        response = await call_next(request)
    except Exception as exc:
        logging.error(f"Unhandled exception on {request.url.path}: {exc}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server processing error: {str(exc)}"},
            headers=_cors_headers(request)
        )

    origin = request.headers.get("origin")
    if origin and is_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"

    response.headers["Access-Control-Allow-Private-Network"] = "true"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"

    # Auto-broadcast mutations across all connected devices and laptops (skip auth and websocket routes)
    if request.method in ["POST", "PUT", "PATCH", "DELETE"] and response.status_code < 400:
        if not request.url.path.startswith("/api/auth") and not request.url.path.startswith("/ws"):
            realtime_manager.trigger_broadcast("DATA_MUTATED", {
                "path": request.url.path,
                "method": request.method,
                "status_code": response.status_code
            })

    return response

# Real-Time WebSocket Synchronization Hub (Cross-Laptop / Multi-Device)
@app.websocket("/ws")
@app.websocket("/api/ws")
async def websocket_realtime_endpoint(websocket: WebSocket):
    await realtime_manager.connect(websocket)
    try:
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
            else:
                try:
                    payload = json.loads(text)
                    if payload.get("type") == "PING":
                        await websocket.send_json({"type": "PONG", "timestamp": time.time()})
                except Exception:
                    pass
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket)
    except Exception as e:
        logging.debug(f"Realtime socket ended: {e}")
        realtime_manager.disconnect(websocket)

@app.get("/api/realtime/status")
@app.get("/api/realtime/version")
async def get_realtime_status():
    return {
        "success": True,
        **realtime_manager.get_status()
    }

# Static file serving for off-chain document repository
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

# Router Registrations
app.include_router(auth_bp, prefix="/api/auth", tags=["Auth"])
app.include_router(admin_bp, prefix="/api/admin", tags=["Admin"])
app.include_router(finance_bp, prefix="/api/finance", tags=["Finance"])
app.include_router(state_bp, prefix="/api/state", tags=["State"])
app.include_router(district_bp, prefix="/api/district", tags=["District"])
app.include_router(contractor_bp, prefix="/api/contractor", tags=["Contractor"])
app.include_router(public_bp, prefix="/api/public", tags=["Public"])
app.include_router(notification_bp, prefix="/api/notifications", tags=["Notifications"])
app.include_router(blockchain_bp, prefix="/api/blockchain", tags=["Blockchain"])
app.include_router(evidence_bp, prefix="/api/evidence", tags=["Evidence"])
app.include_router(transaction_bp, prefix="/api", tags=["BankAccountsAndTransactions"])

@app.get("/api/schemes", tags=["Public"])
async def get_api_schemes_alias():
    from routes.public_routes import get_public_schemes
    return await get_public_schemes()

# Diagnostic & Health Check API
@app.get("/api/health")
async def health():
    db_status = "CONNECTED"
    try:
        db.command("ping")
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    try:
        diag = bcs.get_blockchain_diagnostics(force_refresh=False)
    except Exception as e:
        diag = {
            "environment": os.getenv("APP_ENV") or os.getenv("ENVIRONMENT") or "production",
            "connected": False,
            "contract_address": bcs.contract_address,
            "configured_chain_id": int(os.getenv("CHAIN_ID")) if os.getenv("CHAIN_ID") else (bcs.contract_chain_id or (11155111 if bcs.is_cloud_render else 1337)),
            "active_chain_id": None,
            "contract_deployed": False,
            "rpc_url": bcs.mask_rpc_url(bcs.RPC_URL),
            "chain_id_match": False,
            "roles": {},
            "warnings": [f"Diagnostics temporarily unavailable: {e}"],
            "status": "DEGRADED"
        }

    is_db_ok = not db_status.startswith("ERROR")
    is_bc_ok = bool(diag.get("connected", False)) and bool(diag.get("contract_deployed", False))

    return {
        "status": "HEALTHY" if (is_db_ok and is_bc_ok) else "DEGRADED",
        "framework": "FastAPI",
        "environment": diag.get("environment", "production"),
        "database": db_status,
        "blockchain": {
            "connected": diag.get("connected", False),
            "contract_address": diag.get("contract_address"),
            "chain_id": diag.get("active_chain_id") or diag.get("configured_chain_id"),
            "contract_deployed": diag.get("contract_deployed", False)
        },
        "blockchain_diagnostics": {
            "rpc_url": diag.get("rpc_url"),
            "configured_chain_id": diag.get("configured_chain_id"),
            "active_chain_id": diag.get("active_chain_id"),
            "chain_id_match": diag.get("chain_id_match", False),
            "roles_configured": {k: v.get("ready", False) for k, v in diag.get("roles", {}).items()},
            "warnings": diag.get("warnings", [])
        }
    }

def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Private-Network": "true",
    }
    if origin and is_origin_allowed(origin):
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return headers

# Uniform Error Handlers with Guaranteed CORS Headers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail},
        headers=_cors_headers(request)
    )

@app.exception_handler(404)
async def not_found_error(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "API resource endpoint not found"},
            headers=_cors_headers(request)
        )
    return JSONResponse(status_code=404, content={"error": "Not Found"}, headers=_cors_headers(request))

@app.exception_handler(500)
async def internal_error(request: Request, exc):
    logging.error(f"Internal Server Error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server processing error. Please check server logs."},
        headers=_cors_headers(request)
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled Exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": str(exc)},
        headers=_cors_headers(request)
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
