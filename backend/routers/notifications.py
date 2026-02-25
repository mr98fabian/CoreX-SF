"""
KoreX — Notifications Router

Provides upcoming payment alerts and summary data
for the in-browser notification system.
"""
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from auth import get_current_user_id
from models import CashflowItem, Account

logger = logging.getLogger("korex.notifications")

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/upcoming")
async def get_upcoming_payments(
    days: int = 7,
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """
    Returns cashflow items with payments due in the next N days.
    Used by the frontend to trigger browser notifications.
    """
    today = date.today()
    current_day = today.day

    # Get all active cashflow items for this user
    items = session.exec(
        select(CashflowItem).where(CashflowItem.user_id == user_id)
    ).all()

    upcoming = []
    for item in items:
        due_day: int = item.day_of_month
        if due_day is None:
            continue

        # Calculate next due date
        if due_day >= current_day:
            # Due this month
            days_until = due_day - current_day
        else:
            # Due next month (approximate)
            days_until = (30 - current_day) + due_day

        if days_until <= days:
            # Fetch associated account name
            account = session.get(Account, item.account_id) if item.account_id else None
            upcoming.append({
                "id": item.id,
                "name": item.name,
                "amount": float(item.amount),
                "due_day": due_day,
                "days_until": days_until,
                "account_name": account.name if account else None,
                "is_income": item.is_income,
                "is_overdue": days_until < 0,
            })

    # Sort by urgency (soonest first)
    upcoming.sort(key=lambda x: x["days_until"])

    return {
        "upcoming": upcoming,
        "count": len(upcoming),
        "checked_at": today.isoformat(),
    }


@router.get("/summary")
async def get_notification_summary(
    user_id: str = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """
    Returns a daily/weekly summary of financial activity.
    Used for daily digest and weekly report notifications.
    """
    accounts = session.exec(
        select(Account).where(Account.user_id == user_id)
    ).all()

    total_debt = sum(float(a.balance) for a in accounts if a.account_type == "liability")
    total_liquid = sum(float(a.balance) for a in accounts if a.account_type == "asset")
    net_worth = total_liquid - abs(total_debt)

    # Count accounts with upcoming payments
    items = session.exec(
        select(CashflowItem).where(CashflowItem.user_id == user_id)
    ).all()
    today = date.today()
    due_soon = sum(
        1 for item in items
        if item.day_of_month and 0 <= (item.day_of_month - today.day) <= 3
    )

    return {
        "total_debt": total_debt,
        "total_liquid": total_liquid,
        "net_worth": net_worth,
        "accounts_count": len(accounts),
        "payments_due_soon": due_soon,
        "date": today.isoformat(),
    }
