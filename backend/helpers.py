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
        min_payment=acc.min_payment or Decimal("50"), due_day=acc.due_day or 15,
        closing_day=acc.closing_day or 0, debt_subtype=acc.debt_subtype or "",
        credit_limit=acc.credit_limit or Decimal("0"),
    )

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


def get_shield_target(session, user_id: str) -> Decimal:
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_PEACE_SHIELD
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    return Decimal(str(settings.shield_target)) if settings and settings.shield_target is not None else DEFAULT_PEACE_SHIELD


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
