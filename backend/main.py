"""
CoreX Financial System — API Entrypoint (Slim)
All routes live in backend/routers/. This file handles:
  - FastAPI app creation & CORS
  - Startup lifecycle (DB tables + seed data)
  - Health check
  - Router registration
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import create_db_and_tables, seed_data

# ── CORS: easy to change via env var when you buy a domain ──
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://corex-financial.vercel.app")

ALLOWED_ORIGINS = [
    "http://localhost:5173",     # Vite dev server
    "http://localhost:3000",     # Alternative dev port
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


# ── Startup ──────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    seed_data()


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

app.include_router(accounts_router)
app.include_router(cashflow_router)
app.include_router(dashboard_router)
app.include_router(strategy_router)
app.include_router(transactions_router)
app.include_router(demo_router)
