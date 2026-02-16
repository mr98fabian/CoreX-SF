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
    Checks all recurring CashflowItems and auto-creates Transaction records
    for items due today that haven't been executed yet.
    Called on Dashboard load (fire-and-forget).
    """
    today = date.today()
    today_str = today.isoformat()

    with Session(engine) as session:
        items = session.exec(
            select(CashflowItem).where(CashflowItem.user_id == user_id)
        ).all()

        executed = []
        for item in items:
            # Skip if already executed today
            if getattr(item, "last_executed_date", None) == today_str:
                continue

            # Check if this item triggers today
            due_day = item.day_of_month
            if due_day is None:
                continue

            last_day = calendar.monthrange(today.year, today.month)[1]
            clamped_due = min(due_day, last_day)

            if today.day != clamped_due:
                continue

            # Skip if no linked account
            if not item.account_id:
                continue

            account = session.get(Account, item.account_id)
            if not account:
                continue

            # Create transaction
            amount = Decimal(str(float(item.amount)))
            tx = Transaction(
                user_id=user_id,
                account_id=item.account_id,
                amount=amount,
                type=item.category or ("income" if item.is_income else "expense"),
                description=f"[Auto] {item.name}",
                date=today_str,
            )
            with bypass_fk(session):
                session.add(tx)

            # Update last_executed_date to prevent duplicate execution
            if hasattr(item, "last_executed_date"):
                item.last_executed_date = today_str
                session.add(item)

            executed.append({
                "name": item.name,
                "amount": float(amount),
                "account": account.name,
            })

        if executed:
            session.commit()
            logger.info(f"Auto-executed {len(executed)} recurring transactions for user={user_id}")

        return {
            "executed": executed,
            "count": len(executed),
            "date": today_str,
        }
