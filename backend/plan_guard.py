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
from auth import get_current_user_id, DEMO_USER_ID
from models import Subscription

# Debt accounts included in the calculations per plan (None = unlimited).
# Keep in sync with frontend lib/planLimits.ts and the landing copy.
PLAN_LIMITS: dict[str, Optional[int]] = {
    "starter": 2, "velocity": 6, "accelerator": 12, "freedom": None, "freedom-dev": None,
}
PAID_ACCESS_STATUSES = {"active", "on_trial", "past_due", "cancelled"}  # cancelled = paid until period end


def _parse_ts(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def effective_plan(sub: Optional[Subscription], now: Optional[datetime] = None) -> str:
    """The plan the user is entitled to right now (not just what the row says)."""
    if not sub or sub.status not in PAID_ACCESS_STATUSES:
        return "starter"
    if sub.status == "cancelled":
        end = _parse_ts(sub.current_period_end)
        if not end or (now or datetime.now(timezone.utc)) >= end:
            return "starter"
    return sub.plan if sub.plan in PLAN_LIMITS else "starter"


def plan_limit_for(session: Session, user_id: str) -> Optional[int]:
    if user_id == DEMO_USER_ID:
        return None  # the shared demo sandbox shows the full product
    sub = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    return PLAN_LIMITS[effective_plan(sub)]


def effective_plan_limit(user_id: str = Depends(get_current_user_id)) -> Optional[int]:
    with Session(database.engine) as session:
        return plan_limit_for(session, user_id)
