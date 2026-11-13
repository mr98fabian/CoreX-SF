"""
KoreX — Lemon Squeezy Subscription Router
"""
import os, hmac, hashlib, logging, json
from typing import Optional
from datetime import datetime

import httpx
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from pydantic import BaseModel

from database import get_session, request_session
from auth import get_current_user_id
from models import Subscription
from plan_guard import PLAN_LIMITS, entitlement, effective_plan_limit, _parse_ts
from helpers import filter_active_debt_accounts
from velocity_engine import daily_interest

logger = logging.getLogger("korex.subscriptions")
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# ── Config ───────────────────────────────────────────────────
LS_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY", "")
LS_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")
LS_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://korexf.com")

PLAN_VARIANTS = {
    "velocity":  {"monthly": os.getenv("LS_VARIANT_VELOCITY_MONTHLY", ""),  "annual": os.getenv("LS_VARIANT_VELOCITY_ANNUAL", "")},
    "accelerator": {"monthly": os.getenv("LS_VARIANT_ACCELERATOR_MONTHLY", ""), "annual": os.getenv("LS_VARIANT_ACCELERATOR_ANNUAL", "")},
    "freedom":   {"monthly": os.getenv("LS_VARIANT_FREEDOM_MONTHLY", ""),   "annual": os.getenv("LS_VARIANT_FREEDOM_ANNUAL", "")},
}


def _parse_legacy_variants(raw: str) -> dict:
    """LS_LEGACY_VARIANTS="velocity:123,velocity:456,accelerator:789" — archived
    variants existing subscribers may still be on. LS prices can't be edited,
    so every price change archives variants; without this map those
    subscribers would be downgraded on their next subscription_updated."""
    out = {}
    for pair in filter(None, (p.strip() for p in raw.split(","))):
        plan, _, vid = pair.partition(":")
        if plan.strip() and vid.strip():
            out[vid.strip()] = plan.strip()
    return out


LEGACY_VARIANTS = _parse_legacy_variants(os.getenv("LS_LEGACY_VARIANTS", ""))
# What is sold, annual USD — keep in sync with frontend lib/pricing.ts (the commercial source).
# Retired tiers (velocity/accelerator) aren't sold, so they have no cost here.
PLAN_COSTS = {"starter": 0, "freedom": 100}
# The only thing checkout sells: the paid plan, annual, through this one LS variant.
SELLABLE = {("freedom", "annual"): "LS_VARIANT_FREEDOM_ANNUAL"}
LS_API_BASE = "https://api.lemonsqueezy.com/v1"


def _ls_headers() -> dict:
    return {"Authorization": f"Bearer {LS_API_KEY}", "Accept": "application/vnd.api+json", "Content-Type": "application/vnd.api+json"}


# ── Checkout ─────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan: str
    billing_cycle: str
    email: Optional[str] = None
    name: Optional[str] = None

class CheckoutResponse(BaseModel):
    checkout_url: str


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(body: CheckoutRequest, user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        if entitlement(s, user_id)["plan"] == "founder":  # can't pay for what they already have
            raise HTTPException(status_code=409, detail="This account already has full access.")
    if not LS_API_KEY or not LS_STORE_ID:
        raise HTTPException(status_code=503, detail="Payment system not configured. Contact support.")

    env_name = SELLABLE.get((body.plan, body.billing_cycle))
    if not env_name:
        raise HTTPException(status_code=400, detail="That plan isn't sold. KoreX Annual is the only paid plan.")
    # Read at request time and never fall back to PLAN_VARIANTS/legacy variants: an old variant
    # would charge a different price than the one shown.
    variant_id = os.getenv(env_name, "").strip()
    if not variant_id:
        raise HTTPException(status_code=503, detail="The annual plan isn't available yet. Try again later.")

    checkout_data = {"custom": {"user_id": user_id}}
    if body.email: checkout_data["email"] = body.email
    if body.name:  checkout_data["name"] = body.name

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": checkout_data,
                "product_options": {"redirect_url": f"{FRONTEND_URL}/dashboard/settings?tab=subscription&checkout=success"},
                "checkout_options": {"embed": False},
            },
            "relationships": {
                "store":  {"data": {"type": "stores", "id": LS_STORE_ID}},
                "variant": {"data": {"type": "variants", "id": variant_id}},
            },
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{LS_API_BASE}/checkouts", json=payload, headers=_ls_headers(), timeout=15.0)
        if resp.status_code not in (200, 201):
            logger.error(f"LS checkout failed: {resp.status_code} — {resp.text}")
            raise HTTPException(status_code=502, detail="Failed to create checkout session. Please try again.")
        checkout_url = resp.json()["data"]["attributes"]["url"]
        logger.info(f"Checkout created for user={user_id} plan={body.plan}/{body.billing_cycle}")
        return CheckoutResponse(checkout_url=checkout_url)
    except httpx.HTTPError as e:
        logger.error(f"LS API connection error: {e}")
        raise HTTPException(status_code=502, detail="Payment service unreachable.")


# ── Webhook ──────────────────────────────────────────────────

@router.post("/webhook")
async def handle_webhook(request: Request, session: Session = Depends(get_session)):
    raw_body = await request.body()

    # Fail closed: without a secret we can't tell Lemon Squeezy from a forger.
    # 503 (not 401) because it's our misconfiguration, and LS retries non-2xx
    # deliveries, so no real event is lost once the secret is set.
    if not LS_WEBHOOK_SECRET:
        logger.error("LEMONSQUEEZY_WEBHOOK_SECRET is not set — rejecting webhook")
        return JSONResponse(status_code=503, content={"error": "Webhook not configured"})
    expected = hmac.new(LS_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-Signature", "")):
        logger.warning("Webhook signature mismatch")
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    meta = payload.get("meta", {})
    data = payload.get("data", {})
    event_name = meta.get("event_name", "")
    attrs = data.get("attributes", {})
    # Payment events carry a subscription *invoice*; everything else a subscription.
    is_invoice = data.get("type") == "subscription-invoices"
    ls_sub_id = str(attrs.get("subscription_id", "")) if is_invoice else str(data.get("id", ""))
    user_id = meta.get("custom_data", {}).get("user_id")
    logger.info(f"Webhook received: event={event_name} user_id={user_id} ls_sub={ls_sub_id}")

    existing = None
    if user_id:
        existing = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    elif ls_sub_id:
        existing = session.exec(select(Subscription).where(Subscription.ls_subscription_id == ls_sub_id)).first()
        user_id = existing.user_id if existing else None
    if not user_id:
        return JSONResponse(status_code=200, content={"ok": True, "warning": "no user_id"})

    # Idempotency + ordering: LS retries and may deliver out of order. Ignore any
    # subscription event not newer than the state we already stored for it.
    if not is_invoice and existing and existing.ls_subscription_id == ls_sub_id:
        event_ts = _parse_ts(attrs.get("updated_at"))
        stored_ts = _parse_ts(existing.updated_at)
        if event_name == "subscription_created" or (event_ts and stored_ts and event_ts <= stored_ts):
            logger.info(f"Stale/duplicate webhook ignored: event={event_name} user={user_id}")
            return JSONResponse(status_code=200, content={"ok": True, "duplicate": True})

    if event_name in ("subscription_created", "subscription_updated", "subscription_resumed",
                      "subscription_unpaused", "subscription_paused", "subscription_cancelled",
                      "subscription_expired"):
        plan = _variant_to_plan(str(attrs.get("variant_id", "")))
        if plan is None:  # unknown variant: never downgrade on a mapping gap
            plan = existing.plan if existing else "starter"
            logger.warning(f"Unknown LS variant {attrs.get('variant_id')} for user={user_id}; kept plan={plan}")
        status = attrs.get("status") or "active"
        period_end = attrs.get("ends_at") if status in ("cancelled", "expired") else attrs.get("renews_at")
        if event_name == "subscription_expired" or status == "expired":
            plan, status = "starter", "expired"
        _upsert_subscription(session, user_id, plan, status, ls_sub_id,
                             str(attrs.get("customer_id", "")), period_end,
                             attrs.get("urls", {}).get("update_payment_method"),
                             attrs.get("urls", {}).get("customer_portal"),
                             updated_at=attrs.get("updated_at"))
        logger.info(f"Subscription {event_name}: user={user_id} plan={plan} status={status}")
    elif event_name == "subscription_payment_failed":
        if existing:  # keep plan + subscription id; LS retries the charge (dunning)
            existing.status = "past_due"
            session.add(existing); session.commit()
        logger.warning(f"Payment failed: user={user_id}")
    elif event_name in ("subscription_payment_success", "subscription_payment_recovered"):
        if existing and existing.status == "past_due":
            existing.status = "active"
            session.add(existing); session.commit()
            logger.info(f"Payment recovered, subscription reactivated: user={user_id}")
    else:
        logger.info(f"Unhandled webhook event: {event_name}")

    return JSONResponse(status_code=200, content={"ok": True})


# ── Status ───────────────────────────────────────────────────

@router.get("/status")
async def get_subscription_status(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session)):
    ent = entitlement(session, user_id)  # grants first: a founder with no subscriptions row is NOT starter
    sub = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    limit = PLAN_LIMITS.get(ent["plan"])
    ends = ent["grant_ends_at"]
    return {
        "plan": ent["plan"], "status": sub.status if sub else "active",
        "source": ent["source"],
        "grant_plan": ent["grant_plan"],
        "grant_ends_at": ends.isoformat() + "Z" if ends else None,
        # founder, or any current gift: the UI hides checkout and shows the state instead
        "checkout_hidden": ent["plan"] == "founder" or ent["grant_plan"] is not None,
        "accounts_limit": limit if limit is not None else 999,
        "customer_portal_url": sub.customer_portal_url if sub else None,
        "current_period_end": sub.current_period_end if sub else None,
        "ls_subscription_id": sub.ls_subscription_id if sub else None,
    }


@router.post("/portal")
async def get_customer_portal(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session)):
    sub = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    if not sub or not sub.customer_portal_url:
        raise HTTPException(status_code=404, detail="No active subscription found")
    return {"portal_url": sub.customer_portal_url}


# ── Savings Estimate ─────────────────────────────────────────
# Only REAL figures: the engine's daily interest (velocity_engine.daily_interest) and the
# user's own totals. Plan-vs-minimums savings live in GET /api/velocity/compare
# (compare_paths); nothing here invents an acceleration factor.


def _cents(x) -> float:
    from decimal import Decimal, ROUND_HALF_UP
    return float(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@router.get("/savings-estimate")
async def get_savings_estimate(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session),
                               plan_limit: Optional[int] = Depends(effective_plan_limit)):
    from models import Account
    accounts = session.exec(select(Account).where(Account.user_id == user_id, Account.type == "debt")).all()

    if not accounts:
        return {
            "has_data": False, "total_debt": 0, "daily_interest_all": 0,
            "plans": {p: {"accounts_used": 0, "daily_interest_burning": 0, "plan_cost_annual": PLAN_COSTS[p]} for p in PLAN_COSTS},
            "social_proof": {"total_accounts_monitored": 0, "total_debt_tracked": 0},
        }

    total_debt = sum(float(a.balance or 0) for a in accounts)
    # Engine, on the user's plan-limited set (same as dashboard / plan / logros)
    total_daily_interest = daily_interest(filter_active_debt_accounts(accounts, plan_limit))["total"]

    plans_result = {}
    for plan_name in PLAN_COSTS:
        used = filter_active_debt_accounts(accounts, PLAN_LIMITS[plan_name])
        plans_result[plan_name] = {
            "accounts_used": len(used),
            "daily_interest_burning": _cents(daily_interest(used)["total"]),
            "plan_cost_annual": PLAN_COSTS[plan_name],
        }

    return {
        "has_data": True, "total_debt": round(total_debt, 2), "daily_interest_all": _cents(total_daily_interest),
        "plans": plans_result,
        "social_proof": {"total_accounts_monitored": len(accounts), "total_debt_tracked": round(total_debt, 2)},
    }


# ── Helpers ──────────────────────────────────────────────────

def _variant_to_plan(variant_id: str) -> Optional[str]:
    """Plan for a LS variant id (current or legacy); None if unknown."""
    if not variant_id:
        return None
    for plan_name, variants in PLAN_VARIANTS.items():
        if variant_id in (variants.get("monthly"), variants.get("annual")):
            return plan_name
    return LEGACY_VARIANTS.get(variant_id)


def _upsert_subscription(
    session: Session, user_id: str, plan: str, status: str, ls_subscription_id: str,
    ls_customer_id: str = "", current_period_end: Optional[str] = None,
    update_payment_method_url: Optional[str] = None, customer_portal_url: Optional[str] = None,
    updated_at: Optional[str] = None,
):
    existing = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    # updated_at keeps LS's own timestamp when we have it, so webhook ordering can be checked
    now = updated_at or datetime.utcnow().isoformat() + "Z"
    if existing:
        existing.plan = plan; existing.status = status; existing.ls_subscription_id = ls_subscription_id
        existing.ls_customer_id = ls_customer_id or existing.ls_customer_id
        existing.current_period_end = current_period_end or existing.current_period_end
        existing.updated_at = now
        if update_payment_method_url: existing.update_payment_method_url = update_payment_method_url
        if customer_portal_url: existing.customer_portal_url = customer_portal_url
        session.add(existing)
    else:
        session.add(Subscription(
            user_id=user_id, plan=plan, status=status, ls_subscription_id=ls_subscription_id,
            ls_customer_id=ls_customer_id, current_period_end=current_period_end,
            update_payment_method_url=update_payment_method_url, customer_portal_url=customer_portal_url,
            created_at=now, updated_at=now,
        ))
    session.commit()
