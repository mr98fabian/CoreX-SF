"""
Shared helpers used across multiple routers.
- FK bypass context manager
- Account → DebtAccount conversion
- Common balance update logic
- Fuzzy account name matching
"""
from contextlib import contextmanager
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import text
from velocity_engine import DebtAccount

DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"

# A payment to a debt, however it was recorded: manual payment ("payment") or a
# confirmed attack ("Debt Payment"). Compared lower-case. One list for logros,
# the daily mission and Análisis.
PAYMENT_CATEGORIES = ("payment", "debt payment")


def is_payment_category(category) -> bool:
    return (category or "").lower() in PAYMENT_CATEGORIES


@contextmanager
def bypass_fk(session):
    """Temporarily disable FK constraint checks for SQLite; noop for Postgres."""
    from database import engine as _engine
    if _engine.dialect.name == "sqlite":
        session.execute(text("PRAGMA foreign_keys = OFF"))
        try:
            yield
        finally:
            session.execute(text("PRAGMA foreign_keys = ON"))
    else:
        yield


def _debt_account(acc) -> DebtAccount:
    """Build a DebtAccount from an Account ORM row."""
    return DebtAccount(
        name=acc.name, balance=acc.balance, interest_rate=acc.interest_rate,
        min_payment=acc.min_payment or Decimal("0"), due_day=acc.due_day or 15,
        closing_day=acc.closing_day or 0, debt_subtype=acc.debt_subtype or "",
        credit_limit=acc.credit_limit or Decimal("0"),
    )

def account_plan_minimum(acc) -> Decimal:
    """The minimum every screen charges for this account: velocity_engine.plan_minimum
    (the single source; the stored value is only an input to it and the bank's
    display), capped at the balance. 0 for non-debt or paid-off accounts."""
    from velocity_engine import plan_minimum
    if acc.type != "debt" or acc.balance <= 0:
        return Decimal("0")
    return min(plan_minimum(_debt_account(acc)), Decimal(str(acc.balance))).quantize(Decimal("0.01"))


def accounts_to_debt_objects(accounts) -> list[DebtAccount]:
    return [_debt_account(acc) for acc in accounts if acc.type == "debt" and acc.balance > 0]


def filter_active_debt_accounts(accounts, plan_limit: int | None = None):
    debts = [acc for acc in accounts if acc.type == "debt" and acc.balance > 0]
    debts.sort(key=lambda a: a.interest_rate, reverse=True)
    return debts[:plan_limit] if plan_limit and plan_limit > 0 else debts


def accounts_to_active_debt_objects(accounts, plan_limit: int | None = None) -> list[DebtAccount]:
    return [_debt_account(acc) for acc in filter_active_debt_accounts(accounts, plan_limit)]


def get_liquid_cash(accounts) -> Decimal:
    return sum(acc.balance for acc in accounts if acc.type != "debt")


def funding_accounts(accounts) -> list:
    """Accounts money can come FROM: any non-debt account with a positive
    balance (checking, savings, cash…), largest first — the same notion of
    liquid as get_liquid_cash. A user whose money lives in a "cash" account
    must not be treated as having nothing."""
    return sorted([acc for acc in accounts if acc.type != "debt" and acc.balance > 0],
                  key=lambda x: x.balance, reverse=True)


def get_shield_target(session, user_id: str) -> Decimal:
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_PEACE_SHIELD
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    return Decimal(str(settings.shield_target)) if settings and settings.shield_target is not None else DEFAULT_PEACE_SHIELD


def get_attack_percentage(session, user_id: str) -> Decimal:
    """% of liquid cash attacked monthly — the single assumption behind every
    velocity banking projection (debt-free date, interest saved). Scoped per
    user, same pattern as get_shield_target."""
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_ATTACK_PERCENTAGE
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    return Decimal(str(settings.attack_percentage)) if settings and settings.attack_percentage is not None else DEFAULT_ATTACK_PERCENTAGE


def get_cashflow_surplus(session, user_id: str, debts):
    """The user's monthly surplus from their cashflow (velocity_engine.monthly_surplus),
    or None when no income is on record (callers then use the declared default)."""
    from sqlmodel import select
    from models import CashflowItem
    from velocity_engine import monthly_surplus
    items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
    return monthly_surplus([(i.amount, i.frequency, bool(i.is_income or i.category == "income")) for i in items], debts)


# ── Balance Update Helpers ───────────────────────────────────

def _insufficient_funds_error(account, amount: Decimal):
    """Standardized insufficient-funds HTTPException."""
    return HTTPException(
        status_code=400,
        detail={
            "code": "INSUFFICIENT_FUNDS",
            "message": f"Fondos insuficientes. {account.name} tiene ${account.balance:.2f}, no se puede deducir ${abs(amount):.2f}.",
            "account_name": account.name,
            "current_balance": float(account.balance),
            "requested_amount": float(abs(amount)),
        },
    )


def update_account_balance(account, amount: Decimal, category: str = None) -> Decimal:
    """
    Update account balance after a transaction.
    Returns the actual amount applied (capped for debt payments).
    Raises HTTPException(400) if insufficient funds on non-debt accounts.
    """
    abs_amt = abs(amount)

    if account.type == "debt":
        if category == "payment":
            applied = min(abs_amt, account.balance)
            account.balance -= applied
            return applied
        account.balance += abs_amt
        return abs_amt

    # Non-debt: guard against negative balance
    new_balance = account.balance + amount
    if new_balance < 0:
        raise _insufficient_funds_error(account, amount)
    account.balance = new_balance
    return amount


def find_account_by_name(accounts: list, name: str):
    """Fuzzy account name match: exact → case-insensitive → partial."""
    # Exact
    for acc in accounts:
        if acc.name == name:
            return acc
    # Case-insensitive
    name_lower = name.lower().strip()
    for acc in accounts:
        if acc.name.lower().strip() == name_lower:
            return acc
    # Partial
    for acc in accounts:
        if name_lower in acc.name.lower() or acc.name.lower() in name_lower:
            return acc
    return None


# ── Projection Helpers ───────────────────────────────────────

def calc_days_recovered(std_date_str: str, vel_date_str: str, months_saved: int = 0) -> int:
    """Calculate days recovered between standard and velocity freedom dates."""
    from datetime import datetime as _dt
    try:
        return max(0, (_dt.fromisoformat(std_date_str) - _dt.fromisoformat(vel_date_str)).days)
    except (ValueError, TypeError):
        return months_saved * 30


def calc_attack_streak(executed_logs) -> dict:
    """Calculate current attack streak from executed movement logs."""
    from datetime import date
    total = len(executed_logs)
    streak = 0
    if executed_logs:
        months = {log.date_executed[:7] for log in executed_logs if log.date_executed}
        check = date.today().replace(day=1)
        for _ in range(24):
            key = check.strftime("%Y-%m")
            if key in months:
                streak += 1
                check = date(check.year - 1, 12, 1) if check.month == 1 else date(check.year, check.month - 1, 1)
            else:
                break
    return {"current": streak, "total_attacks": total}


# ── Daily mission (one source for Inicio and Plan) ───────────

def cashflow_events(items, start, days: int):
    """Real recurring incomes and expenses as dated events in [start, start+days):
    any frequency (monthly, semi-monthly, weekly, biweekly, annual) expanded with
    the cashflow's own trigger rule. Income = is_income flag (or the legacy
    category "income"). Nothing invented when there is nothing on record."""
    from datetime import timedelta
    from routers.cashflow import _item_triggers
    incomes, expenses = [], []
    for it in items:
        dates = {start + timedelta(days=i) for i in range(days) if _item_triggers(it, start + timedelta(days=i))}
        if not dates:
            continue
        ev = {"name": it.name, "amount": abs(Decimal(str(it.amount))), "dates": dates}
        (incomes if (it.is_income or it.category == "income") else expenses).append(ev)
    return incomes, expenses


def build_daily_mission(session, user_id: str, accounts, plan_limit: int | None = None, today=None):
    """Gathers the user's data and asks the engine (velocity_engine.get_daily_mission).
    Callers (dashboard, command-center) only serialize the result."""
    from datetime import date as _date
    from sqlmodel import select
    from models import CashflowItem, CutHistory, Transaction
    from velocity_engine import MissionAccount, MISSION_WINDOW_DAYS, get_daily_mission
    today = today or _date.today()
    debts = filter_active_debt_accounts(accounts, plan_limit)
    ids = [a.id for a in debts if a.id is not None]
    last_cut = {}
    if ids:
        for c in session.exec(select(CutHistory).where(CutHistory.user_id == user_id, CutHistory.account_id.in_(ids))
                              .order_by(CutHistory.cut_date.desc())).all():
            last_cut.setdefault(c.account_id, c)
    mission_accounts = []
    for a in debts:
        cut = last_cut.get(a.id)
        paid = Decimal("0")
        if cut:
            txs = session.exec(select(Transaction).where(Transaction.user_id == user_id, Transaction.account_id == a.id,
                                                         Transaction.date > cut.cut_date.isoformat())).all()
            # manual payments AND confirmed attacks ("Debt Payment") both reduce the statement
            paid = sum((abs(Decimal(str(t.amount))) for t in txs if is_payment_category(t.category)), Decimal("0"))
        mission_accounts.append(MissionAccount(
            name=a.name, balance=Decimal(str(a.balance)), interest_rate=Decimal(str(a.interest_rate or 0)),
            min_payment=Decimal(str(a.min_payment or 0)), debt_subtype=a.debt_subtype or "",
            due_day=a.due_day or None, closing_day=a.closing_day or None,
            last_cut_date=cut.cut_date if cut else None,
            last_cut_reported=Decimal(str(cut.reported_balance)) if cut else None, paid_since_cut=paid,
        ))
    items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
    incomes, expenses = cashflow_events(items, today, MISSION_WINDOW_DAYS)
    return get_daily_mission(mission_accounts, Decimal(str(get_liquid_cash(accounts))), get_shield_target(session, user_id),
                             incomes, expenses, today=today)
