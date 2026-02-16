"""
CoreX Financial System — Lemon Squeezy Subscription Router

Endpoints:
  POST /api/subscriptions/checkout   → Create LS checkout session, return URL
  POST /api/subscriptions/webhook    → Receive LS webhook events (no auth)
  GET  /api/subscriptions/status     → Current user's subscription status
  POST /api/subscriptions/portal     → Get LS customer portal URL
"""
import os
import hmac
import hashlib
import logging
from typing import Optional
from datetime import datetime

import httpx
from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlmodel import Session, select
from pydantic import BaseModel

from database import get_session
from auth import get_current_user_id
from models import Subscription

logger = logging.getLogger("corex.subscriptions")

router = APIRouter(prefix="/api/subscriptions", tags=["subscriptions"])

# ── Config (env vars) ────────────────────────────────────────
LS_API_KEY = os.getenv("LEMONSQUEEZY_API_KEY", "")
LS_WEBHOOK_SECRET = os.getenv("LEMONSQUEEZY_WEBHOOK_SECRET", "")
LS_STORE_ID = os.getenv("LEMONSQUEEZY_STORE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://corex-financial.vercel.app")

# Variant IDs — you create these as Products in your LS dashboard.
# Map plan name → { monthly_variant_id, annual_variant_id }
# TODO: Replace these with your actual LS variant IDs after creating products
PLAN_VARIANTS = {
    "velocity": {
        "monthly": os.getenv("LS_VARIANT_VELOCITY_MONTHLY", ""),
        "annual": os.getenv("LS_VARIANT_VELOCITY_ANNUAL", ""),
    },
    "accelerator": {
        "monthly": os.getenv("LS_VARIANT_ACCELERATOR_MONTHLY", ""),
        "annual": os.getenv("LS_VARIANT_ACCELERATOR_ANNUAL", ""),
    },
    "freedom": {
        "monthly": os.getenv("LS_VARIANT_FREEDOM_MONTHLY", ""),
        "annual": os.getenv("LS_VARIANT_FREEDOM_ANNUAL", ""),
    },
}

LS_API_BASE = "https://api.lemonsqueezy.com/v1"


def _ls_headers() -> dict:
    """Standard headers for Lemon Squeezy API calls."""
    return {
        "Authorization": f"Bearer {LS_API_KEY}",
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
    }


# ── Schemas ──────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    plan: str          # velocity | accelerator | freedom
    billing_cycle: str  # monthly | annual
    email: Optional[str] = None
    name: Optional[str] = None


class CheckoutResponse(BaseModel):
    checkout_url: str


# ── POST /checkout — Create Lemon Squeezy checkout ──────────
@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
):
    if not LS_API_KEY or not LS_STORE_ID:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Contact support.",
        )

    # Validate plan + billing cycle
    plan_variants = PLAN_VARIANTS.get(body.plan)
    if not plan_variants:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    variant_id = plan_variants.get(body.billing_cycle)
    if not variant_id:
        raise HTTPException(
            status_code=400,
            detail=f"No variant configured for {body.plan}/{body.billing_cycle}",
        )

    # Build JSON:API checkout payload
    checkout_data: dict = {
        "custom": {"user_id": user_id},
    }
    if body.email:
        checkout_data["email"] = body.email
    if body.name:
        checkout_data["name"] = body.name

    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": checkout_data,
                "product_options": {
                    "redirect_url": f"{FRONTEND_URL}/settings?tab=subscription&checkout=success",
                },
                "checkout_options": {
                    "embed": False,
                },
            },
            "relationships": {
                "store": {
                    "data": {"type": "stores", "id": LS_STORE_ID}
                },
                "variant": {
                    "data": {"type": "variants", "id": variant_id}
                },
            },
        }
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{LS_API_BASE}/checkouts",
                json=payload,
                headers=_ls_headers(),
                timeout=15.0,
            )

        if resp.status_code not in (200, 201):
            logger.error(f"LS checkout failed: {resp.status_code} — {resp.text}")
            raise HTTPException(
                status_code=502,
                detail="Failed to create checkout session. Please try again.",
            )

        data = resp.json()
        checkout_url = data["data"]["attributes"]["url"]
        logger.info(f"Checkout created for user={user_id} plan={body.plan}/{body.billing_cycle}")
        return CheckoutResponse(checkout_url=checkout_url)

    except httpx.HTTPError as e:
        logger.error(f"LS API connection error: {e}")
        raise HTTPException(status_code=502, detail="Payment service unreachable.")


# ── POST /webhook — Lemon Squeezy webhook receiver ──────────
@router.post("/webhook")
async def handle_webhook(request: Request, session: Session = Depends(get_session)):
    """
    Receives webhook events from Lemon Squeezy.
    No auth required — validated via HMAC signature.
    """
    raw_body = await request.body()

    # ── Verify signature ─────────────────────────────────────
    if LS_WEBHOOK_SECRET:
        signature = request.headers.get("X-Signature", "")
        expected = hmac.new(
            LS_WEBHOOK_SECRET.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected, signature):
            logger.warning("Webhook signature mismatch — rejecting request")
            return JSONResponse(status_code=403, content={"error": "Invalid signature"})

    # ── Parse event ──────────────────────────────────────────
    import json
    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    event_name = payload.get("meta", {}).get("event_name", "")
    custom_data = payload.get("meta", {}).get("custom_data", {})
    user_id = custom_data.get("user_id")
    data_attrs = payload.get("data", {}).get("attributes", {})
    ls_subscription_id = str(payload.get("data", {}).get("id", ""))

    logger.info(f"Webhook received: event={event_name} user_id={user_id} ls_sub={ls_subscription_id}")

    if not user_id:
        logger.warning(f"Webhook missing user_id in custom_data: {event_name}")
        return JSONResponse(status_code=200, content={"ok": True, "warning": "no user_id"})

    # ── Map LS variant to plan name ──────────────────────────
    variant_id = str(data_attrs.get("variant_id", ""))
    plan_name = _variant_to_plan(variant_id)

    # ── Handle event ─────────────────────────────────────────
    if event_name in ("subscription_created", "subscription_updated", "subscription_resumed", "subscription_unpaused"):
        _upsert_subscription(
            session=session,
            user_id=user_id,
            plan=plan_name,
            status=data_attrs.get("status", "active"),
            ls_subscription_id=ls_subscription_id,
            ls_customer_id=str(data_attrs.get("customer_id", "")),
            current_period_end=data_attrs.get("renews_at"),
            update_payment_method_url=data_attrs.get("urls", {}).get("update_payment_method"),
            customer_portal_url=data_attrs.get("urls", {}).get("customer_portal"),
        )
        logger.info(f"Subscription upserted: user={user_id} plan={plan_name} status={data_attrs.get('status')}")

    elif event_name in ("subscription_cancelled", "subscription_expired"):
        _upsert_subscription(
            session=session,
            user_id=user_id,
            plan=plan_name,
            status=data_attrs.get("status", "cancelled"),
            ls_subscription_id=ls_subscription_id,
            ls_customer_id=str(data_attrs.get("customer_id", "")),
            current_period_end=data_attrs.get("ends_at"),
        )
        logger.info(f"Subscription cancelled/expired: user={user_id}")

    elif event_name == "subscription_payment_failed":
        _upsert_subscription(
            session=session,
            user_id=user_id,
            plan=plan_name,
            status="past_due",
            ls_subscription_id=ls_subscription_id,
            ls_customer_id=str(data_attrs.get("customer_id", "")),
        )
        logger.warning(f"Payment failed: user={user_id}")

    elif event_name in ("subscription_payment_success", "subscription_payment_recovered"):
        # Re-activate on successful payment
        existing = session.exec(
            select(Subscription).where(Subscription.user_id == user_id)
        ).first()
        if existing and existing.status == "past_due":
            existing.status = "active"
            session.add(existing)
            session.commit()
            logger.info(f"Payment recovered, subscription reactivated: user={user_id}")

    elif event_name == "order_created":
        # One-time orders (if you ever sell non-subscription products)
        logger.info(f"Order created for user={user_id}")

    else:
        logger.info(f"Unhandled webhook event: {event_name}")

    return JSONResponse(status_code=200, content={"ok": True})


# ── GET /status — Current subscription status ───────────────
@router.get("/status")
async def get_subscription_status(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    sub = session.exec(
        select(Subscription).where(Subscription.user_id == user_id)
    ).first()

    if not sub:
        return {
            "plan": "starter",
            "status": "active",
            "accounts_limit": 2,
            "customer_portal_url": None,
            "current_period_end": None,
        }

    plan_limits = {
        "starter": 2,
        "velocity": 5,
        "accelerator": 15,
        "freedom": 999,  # "Unlimited"
    }

    return {
        "plan": sub.plan,
        "status": sub.status,
        "accounts_limit": plan_limits.get(sub.plan, 2),
        "customer_portal_url": sub.customer_portal_url,
        "current_period_end": sub.current_period_end,
        "ls_subscription_id": sub.ls_subscription_id,
    }


# ── POST /portal — Get customer portal URL ──────────────────
@router.post("/portal")
async def get_customer_portal(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    sub = session.exec(
        select(Subscription).where(Subscription.user_id == user_id)
    ).first()

    if not sub or not sub.customer_portal_url:
        raise HTTPException(status_code=404, detail="No active subscription found")

    return {"portal_url": sub.customer_portal_url}


# ── Helpers ──────────────────────────────────────────────────
def _variant_to_plan(variant_id: str) -> str:
    """Reverse-lookup: variant_id → plan name."""
    for plan_name, variants in PLAN_VARIANTS.items():
        if variant_id in (variants.get("monthly"), variants.get("annual")):
            return plan_name
    return "starter"  # Fallback


def _upsert_subscription(
    session: Session,
    user_id: str,
    plan: str,
    status: str,
    ls_subscription_id: str,
    ls_customer_id: str = "",
    current_period_end: Optional[str] = None,
    update_payment_method_url: Optional[str] = None,
    customer_portal_url: Optional[str] = None,
):
    """Create or update subscription record for a user."""
    existing = session.exec(
        select(Subscription).where(Subscription.user_id == user_id)
    ).first()

    now = datetime.utcnow().isoformat()

    if existing:
        existing.plan = plan
        existing.status = status
        existing.ls_subscription_id = ls_subscription_id
        existing.ls_customer_id = ls_customer_id or existing.ls_customer_id
        existing.current_period_end = current_period_end or existing.current_period_end
        existing.updated_at = now
        if update_payment_method_url:
            existing.update_payment_method_url = update_payment_method_url
        if customer_portal_url:
            existing.customer_portal_url = customer_portal_url
        session.add(existing)
    else:
        sub = Subscription(
            user_id=user_id,
            plan=plan,
            status=status,
            ls_subscription_id=ls_subscription_id,
            ls_customer_id=ls_customer_id,
            current_period_end=current_period_end,
            update_payment_method_url=update_payment_method_url,
            customer_portal_url=customer_portal_url,
            created_at=now,
            updated_at=now,
        )
        session.add(sub)

    session.commit()
