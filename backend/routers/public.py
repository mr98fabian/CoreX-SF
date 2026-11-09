"""
Public Router — unauthenticated landing-page calculator.

No database access, no personal data, no auth. Exists so the landing
page's "Calculate Your Savings" CTA actually calculates something with
the real velocity_engine math, instead of promising a calculation and
delivering a login form (see .claude/skills/legal-expert-usa on claim
substantiation).
"""
import time
from collections import defaultdict, deque
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from velocity_engine import DebtAccount, calculate_debt_free_date
from core_engine.calculators import calculate_minimum_payment

router = APIRouter(prefix="/api/public", tags=["public"])

# ── Minimal in-memory per-IP rate limit (no DB, no extra dependency) ──
_RATE_LIMIT = 10          # requests
_RATE_WINDOW_S = 300      # per 5 minutes
_hits: dict[str, deque] = defaultdict(deque)


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    hits = _hits[ip]
    while hits and now - hits[0] > _RATE_WINDOW_S:
        hits.popleft()
    if len(hits) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests. Try again in a few minutes.")
    hits.append(now)


class VelocityPreviewRequest(BaseModel):
    debt_balance: float = Field(gt=0, le=10_000_000, description="Total debt balance")
    apr: float = Field(ge=0, le=100, description="Annual percentage rate")
    monthly_surplus: float = Field(gt=0, le=1_000_000, description="Extra cash available per month")


@router.post("/velocity-preview")
def velocity_preview(req: VelocityPreviewRequest, request: Request):
    """Landing calculator preview: 3 numbers in, a real projection out.
    No accounts are created, nothing is stored."""
    _check_rate_limit(request.client.host if request.client else "unknown")

    balance = Decimal(str(req.debt_balance))
    apr = Decimal(str(req.apr))
    extra_monthly = Decimal(str(req.monthly_surplus))

    min_payment = calculate_minimum_payment(balance, apr)
    debt = DebtAccount(name="Your debt", balance=balance, interest_rate=apr, min_payment=min_payment)

    projections = calculate_debt_free_date([debt], extra_monthly)

    return {
        "standard_debt_free_date": projections["standard_date"],
        "velocity_debt_free_date": projections["velocity_date"],
        "months_saved": projections["months_saved"],
        "interest_saved": float(projections["interest_saved"]),
        "years_saved": round(projections["months_saved"] / 12, 1),
        "assumptions": {
            "extra_monthly_payment": float(extra_monthly),
            "note": (
                "Estimate based on the numbers you entered. Assumes on-time minimum "
                "payments and that you apply this extra amount every month without interruption."
            ),
        },
    }


# ── Plan limits (single source for Settings "Mi plan" and the landing table) ──

@router.get("/plans")
def public_plans():
    """Read-only, no auth: debt-account limit per plan, straight from the same
    plan_guard.PLAN_LIMITS the server enforces (null = unlimited). Prices are
    not here on purpose: they live in the billing config (pricing.ts / LS)."""
    from plan_guard import PLAN_LIMITS, HIDDEN_PLANS
    return [{"plan": name, "debt_limit": limit} for name, limit in PLAN_LIMITS.items() if name not in HIDDEN_PLANS]
