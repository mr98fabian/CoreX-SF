"""
Cashflow Router — CRUD and projection for recurring income/expenses.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import date, timedelta
from decimal import Decimal
import logging
import calendar

from database import engine
from models import Account, CashflowItem, Transaction
from helpers import bypass_fk
from auth import get_current_user_id

logger = logging.getLogger("corex.cashflow")

router = APIRouter(prefix="/api", tags=["cashflow"])


@router.get("/cashflow")
async def get_cashflow(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        real_items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        result = [item.model_dump() for item in real_items]

        debt_accounts = session.exec(
            select(Account).where(Account.user_id == user_id, Account.type == "debt", Account.balance > 0)
        ).all()

        for acc in debt_accounts:
            min_pay = float(acc.min_payment) if acc.min_payment and acc.min_payment > 0 else 50.0
            result.append({
                "id": -acc.id,
                "user_id": user_id,
                "name": f"Deuda: {acc.name}",
                "amount": min_pay,
                "category": "expense",
                "frequency": "monthly",
                "day_of_month": acc.due_day or 15,
                "day_of_week": None,
                "date_specific_1": None,
                "date_specific_2": None,
                "month_of_year": None,
                "is_variable": False,
                "is_debt_virtual": True,
                "source_account_id": acc.id,
                "debt_balance": float(acc.balance),
                "interest_rate": float(acc.interest_rate),
            })

        return result


@router.post("/cashflow", response_model=CashflowItem)
async def create_cashflow(item: CashflowItem, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item.user_id = user_id
        with bypass_fk(session):
            session.add(item)
            session.commit()
        session.refresh(item)
        return item


@router.delete("/cashflow/{id}")
async def delete_cashflow(id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == id, CashflowItem.user_id == user_id)).first()
        if item:
            session.delete(item)
            session.commit()
        return {"ok": True}


@router.get("/cashflow/projection")
async def get_cashflow_projection(months: int = 3, user_id: str = Depends(get_current_user_id)):
    """
    Projects daily running balance using recurring CashflowItems.
    Walks day-by-day from start of current month for N months.
    """
    import calendar

    if months < 1:
        months = 1
    if months > 12:
        months = 12

    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()

        liquid_cash = float(sum(acc.balance for acc in accounts if acc.type != "debt"))
        today = date.today()
        start_date = date(today.year, today.month, 1)

        end_month = today.month + months
        end_year = today.year + (end_month - 1) // 12
        end_month = ((end_month - 1) % 12) + 1
        end_date = date(end_year, end_month, 1)
        total_days = (end_date - start_date).days

        def item_triggers_on(item: CashflowItem, d: date) -> bool:
            freq = item.frequency

            if freq == "monthly":
                dom = int(item.day_of_month) if item.day_of_month else 1
                last_day = calendar.monthrange(d.year, d.month)[1]
                return d.day == min(dom, last_day)

            elif freq == "semi_monthly":
                d1 = int(item.date_specific_1) if item.date_specific_1 else 15
                d2 = int(item.date_specific_2) if item.date_specific_2 else 30
                last_day = calendar.monthrange(d.year, d.month)[1]
                return d.day == min(d1, last_day) or d.day == min(d2, last_day)

            elif freq == "weekly":
                dow = int(item.day_of_week) if item.day_of_week is not None else 0
                return d.weekday() == dow

            elif freq == "biweekly":
                dow = int(item.day_of_week) if item.day_of_week is not None else 0
                if d.weekday() != dow:
                    return False
                week_num = (d - start_date).days // 7
                return week_num % 2 == 0

            elif freq == "annually":
                target_month = int(item.month_of_year) if item.month_of_year else 1
                dom = int(item.day_of_month) if item.day_of_month else 1
                return d.month == target_month and d.day == dom

            return False

        # Walk day-by-day
        daily_events: dict[str, list] = {}
        for day_offset in range(total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            daily_events[d_str] = []
            for item in items:
                if item_triggers_on(item, d):
                    amt = float(item.amount)
                    signed_amt = amt if item.category == "income" else -amt
                    daily_events[d_str].append({
                        "name": item.name,
                        "amount": signed_amt,
                        "category": item.category,
                    })

            # Inject debt min_payments
            last_day_of_month = calendar.monthrange(d.year, d.month)[1]
            for acc in accounts:
                if acc.type == "debt" and acc.balance > 0:
                    due = acc.due_day or 15
                    clamped_due = min(due, last_day_of_month)
                    if d.day == clamped_due:
                        min_pay = float(acc.min_payment) if acc.min_payment and acc.min_payment > 0 else 50.0
                        daily_events[d_str].append({
                            "name": f"Deuda: {acc.name}",
                            "amount": -min_pay,
                            "category": "debt_payment",
                        })

        # Build running balance
        today_str = today.isoformat()
        today_offset = (today - start_date).days

        balances: dict[str, float] = {}
        bal = liquid_cash
        balances[today_str] = round(bal, 2)

        # Forward pass
        for day_offset in range(today_offset + 1, total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            day_delta = sum(ev["amount"] for ev in daily_events.get(d_str, []))
            bal += day_delta
            balances[d_str] = round(bal, 2)

        # Backward pass
        bal = liquid_cash
        for day_offset in range(today_offset - 1, -1, -1):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            next_d = start_date + timedelta(days=day_offset + 1)
            next_str = next_d.isoformat()
            next_delta = sum(ev["amount"] for ev in daily_events.get(next_str, []))
            bal -= next_delta
            balances[d_str] = round(bal, 2)

        # Assemble response
        days_list = []
        for day_offset in range(total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()

            if d < today:
                zone = "past"
            elif d == today:
                zone = "today"
            else:
                zone = "future"

            days_list.append({
                "date": d_str,
                "balance": balances.get(d_str, liquid_cash),
                "events": daily_events.get(d_str, []),
                "is_today": d == today,
                "zone": zone,
                "day_label": d.strftime("%a"),
                "day_num": d.day,
            })

        return {
            "start_balance": round(liquid_cash, 2),
            "today": today_str,
            "total_days": total_days,
            "days": days_list,
        }


@router.post("/cashflow/auto-execute")
async def auto_execute_recurring(user_id: str = Depends(get_current_user_id)):
    """
    LEGACY — Kept for backwards compatibility but now returns empty.
    Replaced by /cashflow/due-today + /cashflow/{id}/confirm flow.
    """
    return {"executed": [], "count": 0, "date": date.today().isoformat()}


# ═══════════════════════════════════════════════════════════
# RECURRING CONFIRMATION SYSTEM
# Replaces silent auto-execute with user-controlled validation.
# ═══════════════════════════════════════════════════════════


def _item_triggers_today(item: CashflowItem, today: date) -> bool:
    """Check if a CashflowItem is due today based on its frequency."""
    freq = item.frequency
    last_day = calendar.monthrange(today.year, today.month)[1]

    if freq == "monthly":
        dom = int(item.day_of_month) if item.day_of_month else 1
        return today.day == min(dom, last_day)

    elif freq == "semi_monthly":
        d1 = int(item.date_specific_1) if item.date_specific_1 else 15
        d2 = int(item.date_specific_2) if item.date_specific_2 else 30
        return today.day == min(d1, last_day) or today.day == min(d2, last_day)

    elif freq == "weekly":
        dow = int(item.day_of_week) if item.day_of_week is not None else 0
        return today.weekday() == dow

    elif freq == "biweekly":
        dow = int(item.day_of_week) if item.day_of_week is not None else 0
        if today.weekday() != dow:
            return False
        epoch = date(2024, 1, 1)  # Stable biweekly reference point
        week_num = (today - epoch).days // 7
        return week_num % 2 == 0

    elif freq == "annually":
        target_month = int(item.month_of_year) if item.month_of_year else 1
        dom = int(item.day_of_month) if item.day_of_month else 1
        return today.month == target_month and today.day == dom

    return False


@router.get("/cashflow/due-today")
async def get_due_today(user_id: str = Depends(get_current_user_id)):
    """
    Returns recurring items due TODAY that haven't been confirmed yet.
    Filters out:
      - Items already confirmed (last_executed_date == today)
      - Items currently snoozed (snooze_until > now)
    """
    from datetime import datetime as dt

    today = date.today()
    today_str = today.isoformat()
    now = dt.now()

    with Session(engine) as session:
        items = session.exec(
            select(CashflowItem).where(CashflowItem.user_id == user_id)
        ).all()

        due_items = []
        for item in items:
            # Skip if already confirmed today
            if item.last_executed_date == today_str:
                continue

            # Skip if snoozed and snooze hasn't expired
            if item.snooze_until:
                try:
                    snooze_dt = dt.fromisoformat(item.snooze_until)
                    if now < snooze_dt:
                        continue
                except (ValueError, TypeError):
                    pass  # Invalid snooze format — treat as expired

            # Check if this item triggers today
            if not _item_triggers_today(item, today):
                continue

            # Fetch linked account name for UI display
            account_name = None
            if item.account_id:
                account = session.get(Account, item.account_id)
                if account:
                    account_name = account.name

            due_items.append({
                "id": item.id,
                "name": item.name,
                "expected_amount": float(item.amount),
                "category": item.category,
                "is_income": item.category == "income" or item.is_income,
                "frequency": item.frequency,
                "account_id": item.account_id,
                "account_name": account_name,
                "is_variable": item.is_variable,
            })

        return {
            "date": today_str,
            "due_count": len(due_items),
            "items": due_items,
        }


@router.post("/cashflow/{item_id}/confirm")
async def confirm_recurring(
    item_id: int,
    body: dict,
    user_id: str = Depends(get_current_user_id),
):
    """
    Confirms a recurring cashflow item with the actual amount.
    Creates a Transaction record and updates the linked account balance.

    Body:
        actual_amount: float — the real amount (may differ from expected)
    """
    actual_amount = body.get("actual_amount")
    if actual_amount is None:
        raise HTTPException(status_code=400, detail="actual_amount is required")

    actual_amount = Decimal(str(actual_amount))
    today_str = date.today().isoformat()

    with Session(engine) as session:
        item = session.exec(
            select(CashflowItem).where(
                CashflowItem.id == item_id,
                CashflowItem.user_id == user_id,
            )
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")

        # Prevent double confirmation
        if item.last_executed_date == today_str:
            return {
                "ok": True,
                "already_confirmed": True,
                "message": "Already confirmed today",
            }

        # Determine variance from expected amount
        expected = item.amount
        variance = float(actual_amount - expected)
        variance_pct = float(
            ((actual_amount - expected) / expected * 100) if expected > 0 else 0
        )

        # Create the transaction record
        is_income = item.category == "income" or item.is_income
        tx = Transaction(
            user_id=user_id,
            account_id=item.account_id,
            amount=actual_amount,
            type="income" if is_income else "expense",
            description=f"[Confirmed] {item.name}",
            date=today_str,
            category=item.category or ("income" if is_income else "expense"),
        )
        with bypass_fk(session):
            session.add(tx)

        # Update account balance if linked
        if item.account_id:
            account = session.get(Account, item.account_id)
            if account:
                if is_income:
                    account.balance += actual_amount
                else:
                    account.balance -= actual_amount
                session.add(account)

        # Mark as confirmed today and clear any snooze
        item.last_executed_date = today_str
        item.snooze_until = None
        session.add(item)

        session.commit()

        logger.info(
            f"Confirmed recurring '{item.name}' for user={user_id}, "
            f"amount={actual_amount}, variance={variance:.2f}"
        )

        return {
            "ok": True,
            "already_confirmed": False,
            "transaction_id": tx.id,
            "item_name": item.name,
            "expected_amount": float(expected),
            "actual_amount": float(actual_amount),
            "variance": round(variance, 2),
            "variance_pct": round(variance_pct, 1),
            "is_income": is_income,
        }


@router.post("/cashflow/{item_id}/snooze")
async def snooze_recurring(
    item_id: int,
    body: dict,
    user_id: str = Depends(get_current_user_id),
):
    """
    Postpones a recurring confirmation.

    Body:
        mode: "2h" | "tomorrow" | "skip_month"
    """
    from datetime import datetime as dt

    mode = body.get("mode", "2h")
    now = dt.now()

    if mode == "2h":
        snooze_until = (now + timedelta(hours=2)).isoformat()
    elif mode == "tomorrow":
        tomorrow = now.replace(hour=8, minute=0, second=0) + timedelta(days=1)
        snooze_until = tomorrow.isoformat()
    elif mode == "skip_month":
        # Snooze until next month's 1st at midnight
        if now.month == 12:
            next_month = dt(now.year + 1, 1, 1)
        else:
            next_month = dt(now.year, now.month + 1, 1)
        snooze_until = next_month.isoformat()
    else:
        raise HTTPException(status_code=400, detail="Invalid snooze mode")

    with Session(engine) as session:
        item = session.exec(
            select(CashflowItem).where(
                CashflowItem.id == item_id,
                CashflowItem.user_id == user_id,
            )
        ).first()

        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")

        item.snooze_until = snooze_until
        session.add(item)
        session.commit()

        logger.info(f"Snoozed '{item.name}' until {snooze_until} for user={user_id}")

        return {
            "ok": True,
            "item_name": item.name,
            "snooze_until": snooze_until,
            "mode": mode,
        }

