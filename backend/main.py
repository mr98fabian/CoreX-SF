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
import time
import logging
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from database import create_db_and_tables, seed_data
from exceptions import CoreXError

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("corex")

# ── CORS: Production domain + local dev servers ──────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://korexf.com")

ALLOWED_ORIGINS = [
    "http://localhost:5173",     # Vite dev server
    "http://localhost:5174",     # Vite fallback port
    "http://localhost:3000",     # Alternative dev port
    "http://localhost",          # Capacitor Android WebView
    "capacitor://localhost",    # Capacitor iOS WebView
    "https://korexf.com",       # Production domain
    "https://www.korexf.com",   # Production domain (www)
    FRONTEND_URL,               # Env-var override (if different)
]

# ── App ──────────────────────────────────────────────────────
app = FastAPI(title="CoreX Financial System", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],
    expose_headers=["X-Process-Time", "X-Request-Id"],
    max_age=600,
)


# ── Request ID + Process Time Middleware ─────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    start = time.perf_counter()
    logger.info(f"[{request_id}] {request.method} {request.url.path}")
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{elapsed_ms}ms"
    return response


# ── CoreXError Handler (structured business errors) ─────────
@app.exception_handler(CoreXError)
async def corex_error_handler(request: Request, exc: CoreXError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.warning(
        f"[{request_id}] {exc.error_code}: {exc.message} | details={exc.details}"
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error_code,
            "message": exc.message,
            "details": exc.details,
            "request_id": request_id,
        },
    )


# ── Global Exception Handler (catch-all for unhandled errors) 
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
            "error": "INTERNAL_ERROR",
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
from routers.subscriptions import router as subscriptions_router
from routers.notifications import router as notifications_router

app.include_router(accounts_router)
app.include_router(cashflow_router)
app.include_router(dashboard_router)
app.include_router(strategy_router)
app.include_router(transactions_router)
app.include_router(demo_router)
app.include_router(analytics_router)
app.include_router(subscriptions_router)
app.include_router(notifications_router)

