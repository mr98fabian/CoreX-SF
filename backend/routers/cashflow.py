"""
Cashflow Router — CRUD, projection, and recurring confirmation system.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import date, timedelta, datetime as dt
from decimal import Decimal
import logging, calendar

from database import engine
from database import request_session
from models import Account, CashflowItem, Transaction
from helpers import bypass_fk, update_account_balance
from auth import get_current_user_id
from api_tokens import require_scope, audit_summary
from plan_guard import scoped_plan_limit
import audit_text
from schemas import CashflowUpdate

logger = logging.getLogger("korex.cashflow")
router = APIRouter(prefix="/api", tags=["cashflow"])


# ── Monthly summary (Reloj de dinero, Cuentas) ───────────────

@router.get("/cashflow/summary")
async def get_cashflow_summary(
    user_id: str = Depends(require_scope("read:dashboard")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    """Monthly income / expenses / debt payments / surplus, computed only by the engine."""
    from helpers import accounts_to_active_debt_objects
    from velocity_engine import cashflow_summary
    with request_session() as session:
        items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        s = cashflow_summary([(i.amount, i.frequency, bool(i.is_income or i.category == "income")) for i in items], debts)
        return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in s.items()}


# ── Cashflow Item CRUD ───────────────────────────────────────

@router.get("/cashflow")
async def get_cashflow(user_id: str = Depends(require_scope("read:dashboard"))):
    with request_session() as session:
        result = [item.model_dump() for item in
                  session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()]
        for acc in session.exec(
            select(Account).where(Account.user_id == user_id, Account.type == "debt", Account.balance > 0)
        ).all():
            result.append({
                "id": -acc.id, "user_id": user_id, "name": f"Deuda: {acc.name}",
                "amount": float(acc.min_payment) if acc.min_payment and acc.min_payment > 0 else 50.0,
                "category": "expense", "frequency": "monthly",
                "day_of_month": acc.due_day or 15, "day_of_week": None,
                "date_specific_1": None, "date_specific_2": None, "month_of_year": None,
                "is_variable": False, "is_debt_virtual": True,
                "source_account_id": acc.id,
                "debt_balance": float(acc.balance), "interest_rate": float(acc.interest_rate),
            })
        return result


def _check_own_account(session, account_id, user_id):
    """A cashflow item may only point at one of the caller's own accounts."""
    if account_id is not None and not session.exec(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    ).first():
        raise HTTPException(status_code=404, detail="Account not found")


@router.post("/cashflow", response_model=CashflowItem)
async def create_cashflow(item: CashflowItem, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        item.user_id = user_id
        item.id = None  # never let the client pick (or collide with) a primary key
        _check_own_account(session, item.account_id, user_id)
        with bypass_fk(session):
            session.add(item); session.commit()
        session.refresh(item)
        audit_summary(audit_text.cashflow_created(item))
        return item


@router.put("/cashflow/{id}", response_model=CashflowItem)
async def update_cashflow(id: int, data: CashflowUpdate, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == id, CashflowItem.user_id == user_id)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")
        before = audit_text.snapshot(item, audit_text.CASHFLOW_FIELDS)
        changes = data.model_dump(exclude_unset=True)
        if "account_id" in changes:
            _check_own_account(session, changes["account_id"], user_id)
        for field, value in changes.items():
            if field == "amount" and value is not None:
                value = Decimal(str(value))
            setattr(item, field, value)
        with bypass_fk(session):
            session.add(item); session.commit()
        session.refresh(item)
        audit_summary(audit_text.cashflow_updated(before, item))
        return item


@router.delete("/cashflow/{id}")
async def delete_cashflow(id: int, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == id, CashflowItem.user_id == user_id)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")
        name = item.name
        session.delete(item); session.commit()
        audit_summary(audit_text.cashflow_deleted(name))
        return {"ok": True, "deleted_cashflow_id": id}


# ── Unified Trigger Logic ────────────────────────────────────

def _item_triggers(item: CashflowItem, d: date, epoch: date = date(2024, 1, 1)) -> bool:
    """Check if a CashflowItem triggers on date d."""
    freq, last_day = item.frequency, calendar.monthrange(d.year, d.month)[1]
    if freq == "monthly":
        return d.day == min(int(item.day_of_month or 1), last_day)
    if freq == "semi_monthly":
        return d.day in (min(int(item.date_specific_1 or 15), last_day),
                         min(int(item.date_specific_2 or 30), last_day))
    if freq == "weekly":
        return d.weekday() == int(item.day_of_week or 0)
    if freq == "biweekly":
        return d.weekday() == int(item.day_of_week or 0) and ((d - epoch).days // 7) % 2 == 0
    if freq == "annually":
        return d.month == int(item.month_of_year or 1) and d.day == int(item.day_of_month or 1)
    return False


# ── Projection ───────────────────────────────────────────────

@router.get("/cashflow/projection")
async def get_cashflow_projection(months: int = 3, user_id: str = Depends(get_current_user_id)):
    months = max(1, min(months, 12))
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()

        liquid_cash = float(sum(acc.balance for acc in accounts if acc.type != "debt"))
        today = date.today()
        start = date(today.year, today.month, 1)
        end = date(start.year + (start.month + months - 1) // 12, ((start.month + months - 1) % 12) + 1, 1)
        total_days = (end - start).days
        today_offset = (today - start).days

        events: dict[str, list] = {}
        for offset in range(total_days):
            d = start + timedelta(days=offset)
            d_str = d.isoformat()
            events[d_str] = []
            for item in items:
                if _item_triggers(item, d):
                    amt = float(item.amount)
                    events[d_str].append({"name": item.name, "amount": amt if item.category == "income" else -amt, "category": item.category})
            last_day = calendar.monthrange(d.year, d.month)[1]
            for acc in accounts:
                if acc.type == "debt" and acc.balance > 0 and d.day == min(acc.due_day or 15, last_day):
                    events[d_str].append({"name": f"Deuda: {acc.name}", "amount": -float(acc.min_payment or 50), "category": "debt_payment"})

        balances: dict[str, float] = {today.isoformat(): liquid_cash}
        bal = liquid_cash
        for offset in range(today_offset + 1, total_days):
            d_str = (start + timedelta(days=offset)).isoformat()
            bal += sum(ev["amount"] for ev in events.get(d_str, []))
            balances[d_str] = round(bal, 2)
        bal = liquid_cash
        for offset in range(today_offset - 1, -1, -1):
            d_str = (start + timedelta(days=offset)).isoformat()
            bal -= sum(ev["amount"] for ev in events.get((start + timedelta(days=offset + 1)).isoformat(), []))
            balances[d_str] = round(bal, 2)

        return {
            "start_balance": round(liquid_cash, 2), "today": today.isoformat(), "total_days": total_days,
            "days": [
                {"date": (start + timedelta(days=o)).isoformat(),
                 "balance": balances.get((start + timedelta(days=o)).isoformat(), liquid_cash),
                 "events": events.get((start + timedelta(days=o)).isoformat(), []),
                 "is_today": o == today_offset,
                 "zone": "past" if o < today_offset else ("today" if o == today_offset else "future"),
                 "day_label": (start + timedelta(days=o)).strftime("%a"),
                 "day_num": (start + timedelta(days=o)).day}
                for o in range(total_days)
            ],
        }


@router.post("/cashflow/auto-execute")
async def auto_execute_recurring(user_id: str = Depends(get_current_user_id)):
    return {"executed": [], "count": 0, "date": date.today().isoformat()}


# ── Recurring Confirmation System ────────────────────────────

@router.get("/cashflow/due-today")
async def get_due_today(user_id: str = Depends(get_current_user_id)):
    today, today_str, now = date.today(), date.today().isoformat(), dt.now()
    with request_session() as session:
        due_items = []
        for item in session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all():
            if item.last_executed_date == today_str:
                continue
            if item.snooze_until:
                try:
                    if now < dt.fromisoformat(item.snooze_until): continue
                except (ValueError, TypeError): pass
            if not _item_triggers(item, today):
                continue
            account_name = None
            if item.account_id:
                acc = session.get(Account, item.account_id)
                if acc: account_name = acc.name
            due_items.append({
                "id": item.id, "name": item.name, "expected_amount": float(item.amount),
                "category": item.category, "is_income": item.category == "income" or item.is_income,
                "frequency": item.frequency, "account_id": item.account_id,
                "account_name": account_name, "is_variable": item.is_variable,
            })
        return {"date": today_str, "due_count": len(due_items), "items": due_items}


@router.post("/cashflow/{item_id}/confirm")
async def confirm_recurring(item_id: int, body: dict, user_id: str = Depends(get_current_user_id)):
    actual = body.get("actual_amount")
    if actual is None:
        raise HTTPException(status_code=400, detail="actual_amount is required")
    actual = Decimal(str(actual))
    override_id = body.get("account_id")
    today_str = date.today().isoformat()

    with request_session() as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == item_id, CashflowItem.user_id == user_id)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")
        if item.last_executed_date == today_str:
            return {"ok": True, "already_confirmed": True, "message": "Already confirmed today"}

        effective_id = item.account_id
        if override_id is not None:
            override_acc = session.exec(select(Account).where(Account.id == override_id, Account.user_id == user_id)).first()
            if override_acc:
                effective_id = override_id
                item.account_id = override_id

        is_income = item.category == "income" or item.is_income
        tx = Transaction(user_id=user_id, account_id=effective_id, amount=actual,
                         description=f"[Confirmed] {item.name}", date=today_str,
                         category=item.category or ("income" if is_income else "expense"))
        with bypass_fk(session):
            session.add(tx)
            if effective_id:
                account = session.get(Account, effective_id)
                if account:
                    update_account_balance(account, actual if is_income else -actual)
                    session.add(account)
            item.last_executed_date = today_str
            item.snooze_until = None
            session.add(item)
            session.commit()

        account_name = (session.get(Account, effective_id).name if effective_id else None) or None
        variance = float(actual - item.amount)
        logger.info(f"Confirmed recurring '{item.name}' for user={user_id}, amount={actual}, variance={variance:.2f}")
        return {
            "ok": True, "already_confirmed": False, "transaction_id": tx.id,
            "item_name": item.name, "expected_amount": float(item.amount),
            "actual_amount": float(actual), "variance": round(variance, 2),
            "variance_pct": round(float((actual - item.amount) / item.amount * 100) if item.amount > 0 else 0, 1),
            "is_income": is_income, "account_name": account_name,
        }


@router.post("/cashflow/{item_id}/snooze")
async def snooze_recurring(item_id: int, body: dict, user_id: str = Depends(get_current_user_id)):
    mode = body.get("mode", "2h")
    now = dt.now()
    if mode == "2h":
        snooze_until = (now + timedelta(hours=2)).isoformat()
    elif mode == "tomorrow":
        snooze_until = (now.replace(hour=8, minute=0, second=0) + timedelta(days=1)).isoformat()
    elif mode == "skip_month":
        nxt = dt(now.year + 1, 1, 1) if now.month == 12 else dt(now.year, now.month + 1, 1)
        snooze_until = nxt.isoformat()
    else:
        raise HTTPException(status_code=400, detail="Invalid snooze mode")

    with request_session() as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == item_id, CashflowItem.user_id == user_id)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Cashflow item not found")
        item.snooze_until = snooze_until
        session.add(item); session.commit()
        logger.info(f"Snoozed '{item.name}' until {snooze_until} for user={user_id}")
        return {"ok": True, "item_name": item.name, "snooze_until": snooze_until, "mode": mode}
