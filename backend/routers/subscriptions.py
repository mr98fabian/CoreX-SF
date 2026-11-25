"""
KoreX — web subscriptions with Stripe Managed Payments (Stripe is the merchant of record:
it processes the payment and handles the taxes applicable to the sale).

Checkout: POST /checkout creates a Stripe Checkout Session (mode=subscription, managed_payments)
for the one plan sold — KoreX Anual — and returns its URL; the app opens it as before.
Webhook: POST /webhook verifies the Stripe-Signature header (HMAC-SHA256 over "t.body", 5 min
tolerance) and writes the SAME Subscription row the Google Play router writes (routers/google_play.py),
with store_source="stripe". The Android build never reaches this checkout (lib/billing.ts).

Config comes from env vars only (set in Railway, never in the repo): STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_FREEDOM_ANNUAL. Missing → 503 (fail closed). The columns
ls_subscription_id / ls_customer_id keep their historical names and hold the Stripe ids.
"""
import os, hmac, hashlib, logging, json, time
from typing import Optional
from datetime import datetime, timezone

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
from velocity_engine import interest_periods_json

logger = logging.getLogger("korex.subscriptions")
router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# ── Config ───────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://korexf.com")
STRIPE_API_BASE = "https://api.stripe.com/v1"
STRIPE_API_VERSION = "2025-03-31.basil"  # Managed Payments needs basil or later
# Managed Payments: customers manage (cancel, update card) their subscription in Link
STRIPE_MANAGE_URL = "https://app.link.com"
SIGNATURE_TOLERANCE_S = 300
STORE = "stripe"

# What is sold, annual USD — keep in sync with frontend lib/pricing.ts (the commercial source).
# Retired tiers (velocity/accelerator) aren't sold, so they have no cost here.
PLAN_COSTS = {"starter": 0, "freedom": 100}
# Free trial before the first charge — keep in sync with frontend lib/pricing.ts TRIAL_DAYS
# (what the plan card promises is what the checkout gives).
TRIAL_DAYS = 7
# The only thing checkout sells: the paid plan, annual, through this one Stripe price.
SELLABLE = {("freedom", "annual"): "STRIPE_PRICE_FREEDOM_ANNUAL"}

# Stripe subscription status → the row vocabulary plan_guard.subscription_plan understands
_GRANTING = {"trialing": "on_trial", "active": "active", "past_due": "past_due"}
_ENDED = {"canceled", "unpaid", "incomplete_expired"}


def _env(name: str) -> str:
    return os.getenv(name, "").strip()  # read per request: Railway values, tests' monkeypatch


def _stripe_headers() -> dict:
    return {"Authorization": f"Bearer {_env('STRIPE_SECRET_KEY')}", "Stripe-Version": STRIPE_API_VERSION}


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
    if not _env("STRIPE_SECRET_KEY"):
        raise HTTPException(status_code=503, detail="Payment system not configured. Contact support.")

    env_name = SELLABLE.get((body.plan, body.billing_cycle))
    if not env_name:
        raise HTTPException(status_code=400, detail="That plan isn't sold. KoreX Annual is the only paid plan.")
    # Read at request time and never fall back to another price: it would charge a different
    # amount than the one shown.
    price_id = _env(env_name)
    if not price_id:
        raise HTTPException(status_code=503, detail="The annual plan isn't available yet. Try again later.")

    form = {
        "mode": "subscription",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "managed_payments[enabled]": "true",
        "client_reference_id": user_id,
        "metadata[user_id]": user_id,
        "subscription_data[metadata][user_id]": user_id,  # every subscription event carries it
        "success_url": f"{FRONTEND_URL}/dashboard/settings?tab=subscription&checkout=success",
        "cancel_url": f"{FRONTEND_URL}/dashboard/settings?tab=subscription",
    }
    if TRIAL_DAYS > 0:
        form["subscription_data[trial_period_days]"] = str(TRIAL_DAYS)
    if body.email:
        form["customer_email"] = body.email

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{STRIPE_API_BASE}/checkout/sessions", data=form,
                                     headers=_stripe_headers(), timeout=15.0)
        if resp.status_code != 200:
            err = (resp.json().get("error") or {}) if "json" in resp.headers.get("content-type", "") else {}
            logger.error(f"Stripe checkout failed: {resp.status_code} type={err.get('type')} code={err.get('code')} "
                         f"param={err.get('param')}")  # never the body: it may echo customer data
            raise HTTPException(status_code=502, detail="Failed to create checkout session. Please try again.")
        checkout_url = resp.json()["url"]
        logger.info(f"Checkout created for user={user_id} plan={body.plan}/{body.billing_cycle}")
        return CheckoutResponse(checkout_url=checkout_url)
    except httpx.HTTPError as e:
        logger.error(f"Stripe API connection error: {type(e).__name__}")
        raise HTTPException(status_code=502, detail="Payment service unreachable.")


# ── Webhook ──────────────────────────────────────────────────

def verify_signature(raw_body: bytes, header: str, secret: str, now: Optional[float] = None) -> bool:
    """Stripe-Signature: "t=<unix>,v1=<hex>[,v1=...]". Valid when some v1 equals
    HMAC-SHA256(secret, "<t>.<body>") and t is within the tolerance (replays)."""
    parts = [p.split("=", 1) for p in (header or "").split(",") if "=" in p]
    ts = next((v for k, v in parts if k.strip() == "t"), None)
    sigs = [v.strip() for k, v in parts if k.strip() == "v1"]
    if not ts or not sigs:
        return False
    try:
        if abs((now or time.time()) - int(ts)) > SIGNATURE_TOLERANCE_S:
            return False
    except ValueError:
        return False
    expected = hmac.new(secret.encode("utf-8"), f"{ts}.".encode("utf-8") + raw_body, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, s) for s in sigs)


def _iso(epoch) -> Optional[str]:
    if not epoch:
        return None
    return datetime.fromtimestamp(int(epoch), tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _period_end(sub: dict) -> Optional[str]:
    # basil moved current_period_end to the subscription items; older payloads have it on top
    items = (sub.get("items") or {}).get("data") or []
    end = sub.get("current_period_end") or (items[0].get("current_period_end") if items else None)
    if sub.get("status") == "trialing":
        end = sub.get("trial_end") or end
    if sub.get("cancel_at"):
        end = sub.get("cancel_at")
    return _iso(end)


def _price_to_plan(sub: dict) -> Optional[str]:
    items = (sub.get("items") or {}).get("data") or []
    price = ((items[0].get("price") or {}).get("id") if items else None) or ""
    return "freedom" if price and price == _env("STRIPE_PRICE_FREEDOM_ANNUAL") else None


def _row_state(sub: dict, current_plan: Optional[str]) -> tuple[str, str]:
    """(plan, status) for a Stripe subscription object. Never downgrades on an unknown price."""
    st = sub.get("status") or ""
    plan = _price_to_plan(sub) or current_plan or "starter"
    if st in _ENDED:
        return "starter", "expired"
    if st in _GRANTING:
        if sub.get("cancel_at_period_end") or sub.get("cancel_at"):
            return plan, "cancelled"  # paid (or trial) until period end, then plan_guard drops it
        return plan, _GRANTING[st]
    return plan, st or "incomplete"  # incomplete, paused: no access (plan_guard)


def _invoice_subscription(inv: dict) -> str:
    sub = inv.get("subscription") or (((inv.get("parent") or {}).get("subscription_details") or {}).get("subscription"))
    return str(sub or "")


async def _fetch_subscription(sub_id: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{STRIPE_API_BASE}/subscriptions/{sub_id}", headers=_stripe_headers(), timeout=15.0)
    return resp.json() if resp.status_code == 200 else None


def _apply_subscription(session: Session, user_id: str, sub: dict, existing: Optional[Subscription],
                        event_ts: Optional[str]) -> str:
    sub_id = str(sub.get("id", ""))
    # Ordering: Stripe retries and may deliver out of order — nothing older than what we stored
    if existing and existing.ls_subscription_id == sub_id:
        if event_ts and existing.updated_at and _parse_ts(event_ts) and _parse_ts(existing.updated_at) \
                and _parse_ts(event_ts) < _parse_ts(existing.updated_at):
            return "stale"
    plan, status = _row_state(sub, existing.plan if existing else None)
    # An old subscription ending must not clobber a newer one the user bought after it
    if existing and existing.ls_subscription_id and existing.ls_subscription_id != sub_id and status == "expired":
        return "old-subscription"
    # ...nor a row another store charges now (Google Play): a Stripe end never touches it
    if existing and existing.store_source != STORE and status not in ("on_trial", "active", "past_due", "cancelled"):
        return "other-store"
    _upsert_subscription(session, user_id, plan, status, sub_id, str(sub.get("customer") or ""),
                         _period_end(sub), STRIPE_MANAGE_URL, STRIPE_MANAGE_URL, updated_at=event_ts)
    logger.info(f"Subscription {sub.get('status')}: user={user_id} plan={plan} status={status}")
    return "applied"


@router.post("/webhook")
async def handle_webhook(request: Request, session: Session = Depends(get_session)):
    raw_body = await request.body()

    # Fail closed: without a secret we can't tell Stripe from a forger. 503 (not 401) because it's
    # our misconfiguration, and Stripe retries non-2xx deliveries, so no event is lost once it's set.
    secret = _env("STRIPE_WEBHOOK_SECRET")
    if not secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not set — rejecting webhook")
        return JSONResponse(status_code=503, content={"error": "Webhook not configured"})
    if not verify_signature(raw_body, request.headers.get("Stripe-Signature", ""), secret):
        logger.warning("Webhook signature mismatch")
        return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    etype = event.get("type", "")
    obj = (event.get("data") or {}).get("object") or {}
    event_ts = _iso(event.get("created"))

    def find(user_id: Optional[str], sub_id: str) -> tuple[Optional[str], Optional[Subscription]]:
        if user_id:
            return user_id, session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
        if sub_id:
            row = session.exec(select(Subscription).where(Subscription.ls_subscription_id == sub_id)).first()
            return (row.user_id if row else None), row
        return None, None

    if etype == "checkout.session.completed":
        sub_id = str(obj.get("subscription") or "")
        user_id, existing = find(obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id"), sub_id)
        if not user_id or not sub_id:
            return JSONResponse(status_code=200, content={"ok": True, "warning": "no user_id"})
        sub = await _fetch_subscription(sub_id) if _env("STRIPE_SECRET_KEY") else None
        if sub is None:  # 500 → Stripe retries; the subscription events also carry the state
            logger.error(f"Could not read subscription {sub_id} for user={user_id}")
            return JSONResponse(status_code=500, content={"error": "Subscription not readable yet"})
        result = _apply_subscription(session, user_id, sub, existing, event_ts)
    elif etype.startswith("customer.subscription."):
        sub_id = str(obj.get("id", ""))
        user_id, existing = find((obj.get("metadata") or {}).get("user_id"), sub_id)
        if not user_id:
            return JSONResponse(status_code=200, content={"ok": True, "warning": "no user_id"})
        if etype == "customer.subscription.trial_will_end":
            return JSONResponse(status_code=200, content={"ok": True})  # Stripe emails the reminder
        result = _apply_subscription(session, user_id, obj, existing, event_ts)
    elif etype == "invoice.payment_failed":
        user_id, existing = find(None, _invoice_subscription(obj))
        if existing:  # keep plan + subscription id; Stripe retries the charge (dunning)
            existing.status = "past_due"
            session.add(existing); session.commit()
        logger.warning(f"Payment failed: user={user_id}")
        result = "past_due"
    elif etype in ("invoice.paid", "invoice.payment_succeeded"):
        user_id, existing = find(None, _invoice_subscription(obj))
        if existing and existing.status == "past_due":
            existing.status = "active"
            session.add(existing); session.commit()
            logger.info(f"Payment recovered, subscription reactivated: user={user_id}")
        result = "paid"
    else:
        logger.info(f"Unhandled webhook event: {etype}")
        result = "ignored"

    return JSONResponse(status_code=200, content={"ok": True, "result": result})


# ── Status ───────────────────────────────────────────────────

@router.get("/status")
def get_subscription_status(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session)):
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
        # which store charges the row (stripe | google_play): the app shows the right "manage" door
        "store_source": sub.store_source if sub else None,
    }


@router.post("/portal")
def get_customer_portal(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session)):
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
def get_savings_estimate(user_id: str = Depends(get_current_user_id), session: Session = Depends(get_session),
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
        # THE periods (same function as the dashboard): the client never multiplies the daily figure
        "interes_periodos": interest_periods_json(total_daily_interest),
        "plans": plans_result,
        "social_proof": {"total_accounts_monitored": len(accounts), "total_debt_tracked": round(total_debt, 2)},
    }


# ── Helpers ──────────────────────────────────────────────────

def _upsert_subscription(
    session: Session, user_id: str, plan: str, status: str, ls_subscription_id: str,
    ls_customer_id: str = "", current_period_end: Optional[str] = None,
    update_payment_method_url: Optional[str] = None, customer_portal_url: Optional[str] = None,
    updated_at: Optional[str] = None,
):
    """The web (Stripe) write of the one Subscription row per user. ls_subscription_id /
    ls_customer_id hold the Stripe subscription / customer ids (historical column names)."""
    existing = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    # updated_at keeps the Stripe event's own timestamp when we have it, so ordering can be checked
    now = updated_at or datetime.utcnow().isoformat() + "Z"
    if existing:
        existing.plan = plan; existing.status = status; existing.ls_subscription_id = ls_subscription_id
        existing.ls_customer_id = ls_customer_id or existing.ls_customer_id
        existing.current_period_end = current_period_end or existing.current_period_end
        existing.updated_at = now
        existing.store_source = STORE
        if update_payment_method_url: existing.update_payment_method_url = update_payment_method_url
        if customer_portal_url: existing.customer_portal_url = customer_portal_url
        session.add(existing)
    else:
        session.add(Subscription(
            user_id=user_id, plan=plan, status=status, ls_subscription_id=ls_subscription_id,
            ls_customer_id=ls_customer_id, current_period_end=current_period_end,
            update_payment_method_url=update_payment_method_url, customer_portal_url=customer_portal_url,
            created_at=now, updated_at=now, store_source=STORE,
        ))
    session.commit()
