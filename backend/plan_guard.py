"""
Server-side plan limits. The browser used to send ?plan_limit=X itself, so
omitting it removed the paywall. Endpoints now get the limit from the
user's subscription row; any client-supplied value is ignored.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends
from sqlmodel import Session, select

import database
from database import request_session
from fastapi import Request
from auth import get_current_user_id, DEMO_USER_ID
from models import Subscription

# Debt accounts included in the calculations per plan (None = unlimited).
# Keep in sync with frontend lib/planLimits.ts and the landing copy.
PLAN_LIMITS: dict[str, Optional[int]] = {
    "starter": 2, "velocity": 15, "accelerator": None, "freedom": None, "freedom-dev": None, "founder": None,
}
HIDDEN_PLANS = {"freedom-dev", "founder"}  # internal: never listed in /public/plans, never sold
PLAN_RANK = {"starter": 0, "velocity": 1, "accelerator": 2, "freedom": 3, "freedom-dev": 3, "founder": 4}
DEMO_PLAN = "freedom-dev"  # the shared demo sandbox shows the full product
PAID_ACCESS_STATUSES = {"active", "on_trial", "past_due", "cancelled"}  # cancelled = paid until period end


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def subscription_plan(sub: Optional[Subscription], now: Optional[datetime] = None) -> str:
    """What the Lemon Squeezy row entitles to right now (not just what the row says)."""
    if not sub or sub.status not in PAID_ACCESS_STATUSES:
        return "starter"
    if sub.status == "cancelled":
        end = _parse_ts(sub.current_period_end)
        if not end or (now or datetime.now(timezone.utc)) >= end:
            return "starter"
    return sub.plan if sub.plan in PLAN_LIMITS else "starter"


def entitlement(session: Session, user_id: str, now: Optional[datetime] = None) -> dict:
    """THE single resolver: the highest right among the demo sandbox, a current access
    grant (codes) and the Lemon subscription. On a tie the grant wins.
    Returns {plan, source: demo|grant|subscription|none, grant_plan, grant_ends_at}."""
    if user_id == DEMO_USER_ID:
        return {"plan": DEMO_PLAN, "source": "demo", "grant_plan": None, "grant_ends_at": None}
    from access_codes import active_grants  # local import: access_codes → models only
    naive_now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(tzinfo=None)
    grants = active_grants(session, user_id, naive_now)
    best = max(grants, key=lambda g: (PLAN_RANK.get(g.plan, 0), g.ends_at is None, g.ends_at or naive_now), default=None)
    sub = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    paid = subscription_plan(sub, now)
    grant_plan = best.plan if best and best.plan in PLAN_LIMITS else None
    if grant_plan and PLAN_RANK[grant_plan] >= PLAN_RANK.get(paid, 0):
        return {"plan": grant_plan, "source": "grant", "grant_plan": grant_plan, "grant_ends_at": best.ends_at}
    return {"plan": paid, "source": "subscription" if paid != "starter" else "none",
            "grant_plan": grant_plan, "grant_ends_at": best.ends_at if best else None}


def effective_plan(session: Session, user_id: str, now: Optional[datetime] = None) -> str:
    return entitlement(session, user_id, now)["plan"]


def ai_access_for(session: Session, user_id: str) -> tuple[bool, str]:
    """AI connection (API tokens / MCP) is a paid feature: any plan above Starter the
    user is entitled to *right now* (see entitlement) opens it."""
    ent = entitlement(session, user_id)
    if ent["source"] == "demo":  # the shared sandbox shows every screen, but never connects an AI
        return False, ent["plan"]
    return ent["plan"] != "starter", ent["plan"]


def plan_limit_for(session: Session, user_id: str) -> Optional[int]:
    return PLAN_LIMITS[effective_plan(session, user_id)]


def effective_plan_limit(user_id: str = Depends(get_current_user_id)) -> Optional[int]:
    with request_session() as session:
        return plan_limit_for(session, user_id)


def scoped_plan_limit(request: Request) -> Optional[int]:
    """Same as effective_plan_limit for endpoints authenticated with
    api_tokens.require_scope (declared before this param, so it already set
    request.state.auth_user_id for either a token or a normal session)."""
    with request_session() as session:
        return plan_limit_for(session, request.state.auth_user_id)
