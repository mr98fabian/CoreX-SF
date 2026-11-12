"""Calendario de eventos: what comes in, what goes out and which card closes on
each day of a month. Same functions as the daily mission (helpers.calendar_month),
so the calendar and the mission never disagree. Session or kx_ token (read:dashboard)."""
import re
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query

from api_tokens import require_scope
from database import request_session
from helpers import calendar_month
from plan_guard import scoped_plan_limit

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def _json(v):
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, dict):
        return {k: _json(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_json(x) for x in v]
    return v


@router.get("/events")
async def calendar_events(
    month: str = Query(default=None, description="YYYY-MM (default: current month)"),
    user_id: str = Depends(require_scope("read:dashboard")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    if month is None:
        month = date.today().isoformat()[:7]
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=422, detail="month must be YYYY-MM")
    year, mon = int(month[:4]), int(month[5:])
    with request_session() as session:
        return _json(calendar_month(session, user_id, year, mon, plan_limit))
