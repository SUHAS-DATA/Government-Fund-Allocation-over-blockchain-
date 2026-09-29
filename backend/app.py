import os
import logging
import asyncio
import time
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn

# Database & Blockchain
from database import db, init_indexes
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

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("System startup: Initializing database indexes and seed data...")
    try:
        loop = asyncio.get_running_loop()
        realtime_manager.set_loop(loop)
    except Exception as e:
        logging.warning(f"Could not bind event loop to realtime_manager: {e}")
    try:
        init_indexes()
    except Exception as e:
        logging.warning(f"Index initialization warning: {e}")
    try:
        seed()
    except Exception as e:
        logging.warning(f"Database seed warning: {e}")
    yield
    logging.info("System shutdown.")

app = FastAPI(
    title="PFMS Blockchain National Fund Allocation System",
    description="Decentralized multi-tier government budget allocation, state treasury transfer, project escrow, and milestone release tracking platform.",
    version="2.0.0",
    lifespan=lifespan
)

# Configurable CORS (Supports Vercel Deployments, localhost, and custom domains)
cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if (origins and "*" not in origins) else [],
    allow_origin_regex=r"^https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Comprehensive CORS Preflight & Security Headers Middleware
@app.middleware("http")
async def cors_and_security_middleware(request: Request, call_next):
    # Immediately answer preflight OPTIONS requests with 200 OK and complete CORS headers
    if request.method == "OPTIONS":
        origin = request.headers.get("origin")
        preflight_headers = {
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers") or "*",
            "Access-Control-Max-Age": "86400",
        }
        if origin:
            preflight_headers["Access-Control-Allow-Origin"] = origin
            preflight_headers["Access-Control-Allow-Credentials"] = "true"
        else:
            preflight_headers["Access-Control-Allow-Origin"] = "*"
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
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"

    # Auto-broadcast mutations across all connected devices and laptops
    if request.method in ["POST", "PUT", "PATCH", "DELETE"] and response.status_code < 400:
        # Exclude heartbeat or purely internal paths if necessary, but all state-changing endpoints trigger updates
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

    bc_connected = bcs.is_blockchain_connected()

    chain_id = int(os.getenv("CHAIN_ID", 5777))
    if bc_connected:
        try:
            chain_id = bcs.w3.eth.chain_id
        except Exception:
            pass

    return {
        "status": "HEALTHY",
        "framework": "FastAPI",
        "environment": os.getenv("APP_ENV", "production"),
        "database": db_status,
        "blockchain": {
            "connected": bc_connected,
            "contract_address": bcs.contract_address,
            "chain_id": chain_id
        }
    }

def _cors_headers(request: Request) -> dict:
    origin = request.headers.get("origin")
    headers = {
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    else:
        headers["Access-Control-Allow-Origin"] = "*"
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
