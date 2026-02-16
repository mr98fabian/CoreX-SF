"""
CoreX Financial System — API Entrypoint (Slim)
All routes live in backend/routers/. This file handles:
  - FastAPI app creation & CORS
  - Startup lifecycle (DB tables + seed data)
  - Health check
  - Global error handling
  - Router registration
"""
import os
import uuid
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import create_db_and_tables, seed_data

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("corex")

# ── CORS: easy to change via env var when you buy a domain ──
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://corex-financial.vercel.app")

ALLOWED_ORIGINS = [
    "http://localhost:5173",     # Vite dev server
    "http://localhost:5174",     # Vite fallback port
    "http://localhost:3000",     # Alternative dev port
    "https://corex-web-bice.vercel.app",  # Current Vercel deployment
    FRONTEND_URL,               # Production (env-var driven)
]

# ── App ──────────────────────────────────────────────────────
app = FastAPI(title="CoreX Financial System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request ID Middleware ────────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    logger.info(f"[{request_id}] {request.method} {request.url.path}")
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ── Global Exception Handler ────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(
        f"[{request_id}] Unhandled error on {request.method} {request.url.path}: "
        f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}"
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "Something went wrong. Please try again.",
            "request_id": request_id,
        },
    )


# ── Startup ──────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    seed_data()
    logger.info("✅ CoreX API ready — tables verified, seed data loaded.")


# ── Health Check ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


# ── Register Routers ─────────────────────────────────────────
from routers.accounts import router as accounts_router
from routers.cashflow import router as cashflow_router
from routers.dashboard import router as dashboard_router
from routers.strategy import router as strategy_router
from routers.transactions import router as transactions_router
from routers.demo import router as demo_router
from routers.analytics import router as analytics_router

app.include_router(accounts_router)
app.include_router(cashflow_router)
app.include_router(dashboard_router)
app.include_router(strategy_router)
app.include_router(transactions_router)
app.include_router(demo_router)
app.include_router(analytics_router)

