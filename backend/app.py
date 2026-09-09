import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import uvicorn

# Database & Blockchain
from database import db, init_indexes
from seed_data import seed
import blockchain_service as bcs

# Routers
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("System startup: Initializing database indexes and seed data...")
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

# Configurable CORS
cors_origins = os.getenv("CORS_ORIGINS", "*")
origins = [o.strip() for o in cors_origins.split(",")] if cors_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Response Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

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
app.include_router(auditor_bp, prefix="/api/auditor", tags=["Auditor"])
app.include_router(public_bp, prefix="/api/public", tags=["Public"])
app.include_router(notification_bp, prefix="/api/notifications", tags=["Notifications"])
app.include_router(blockchain_bp, prefix="/api/blockchain", tags=["Blockchain"])

# Diagnostic & Health Check API
@app.get("/api/health")
async def health():
    db_status = "CONNECTED"
    try:
        db.command("ping")
    except Exception as e:
        db_status = f"ERROR: {str(e)}"

    bc_connected = bcs.is_blockchain_connected()

    return {
        "status": "HEALTHY",
        "framework": "FastAPI",
        "environment": os.getenv("APP_ENV", "production"),
        "database": db_status,
        "blockchain": {
            "connected": bc_connected,
            "contract_address": bcs.contract_address,
            "chain_id": 31337
        }
    }

# Uniform Error Handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": exc.detail}
    )

@app.exception_handler(404)
async def not_found_error(request: Request, exc):
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=404,
            content={"success": False, "message": "API resource endpoint not found"}
        )
    return JSONResponse(status_code=404, content={"error": "Not Found"})

@app.exception_handler(500)
async def internal_error(request: Request, exc):
    logging.error(f"Internal Server Error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server processing error. Please check server logs."}
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
