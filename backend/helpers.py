"""
Shared helpers used across multiple routers.
- FK bypass context manager (needed for demo/test seeding with Supabase FK constraints)
- Common Account → DebtAccount conversion
"""
from contextlib import contextmanager
from decimal import Decimal

from sqlalchemy import text
from velocity_engine import DebtAccount


DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"


@contextmanager
def bypass_fk(session):
    """Temporarily disable FK constraint checks.
    Needed because cashflow_items, accounts, etc. have FK to auth.users,
    but demo/test users don't exist in that Supabase-managed table.

    Handles both Postgres (production) and SQLite (tests)."""
    dialect = session.bind.dialect.name if session.bind else "unknown"

    if dialect == "sqlite":
        session.execute(text("PRAGMA foreign_keys = OFF"))
    else:
        session.execute(text("SET session_replication_role = 'replica'"))
    try:
        yield
    finally:
        if dialect == "sqlite":
            session.execute(text("PRAGMA foreign_keys = ON"))
        else:
            session.execute(text("SET session_replication_role = 'origin'"))


def accounts_to_debt_objects(accounts) -> list[DebtAccount]:
    """Convert Account ORM list → DebtAccount dataclass list (active debts only)."""
    return [
        DebtAccount(
            name=acc.name,
            balance=acc.balance,
            interest_rate=acc.interest_rate,
            min_payment=acc.min_payment if acc.min_payment else Decimal("50"),
            due_day=acc.due_day if acc.due_day else 15,
            closing_day=acc.closing_day if acc.closing_day else 0,
            debt_subtype=acc.debt_subtype if acc.debt_subtype else "",
            credit_limit=acc.credit_limit if acc.credit_limit else Decimal("0"),
        )
        for acc in accounts
        if acc.type == "debt" and acc.balance > 0
    ]


def filter_active_debt_accounts(accounts, plan_limit: int | None = None):
    """Return only the ACTIVE (unlocked) debt Account ORM objects.

    Sorts debts by interest_rate DESC so highest-APR accounts stay active.
    If plan_limit is None or <= 0, returns ALL debts (unlimited plan).
    """
    debts = [acc for acc in accounts if acc.type == "debt" and acc.balance > 0]
    debts.sort(key=lambda a: a.interest_rate, reverse=True)
    if plan_limit and plan_limit > 0:
        return debts[:plan_limit]
    return debts


def accounts_to_active_debt_objects(accounts, plan_limit: int | None = None) -> list[DebtAccount]:
    """Convert Account ORM list → DebtAccount list, respecting plan lock priority.

    Only returns the top `plan_limit` debts sorted by APR descending.
    """
    active = filter_active_debt_accounts(accounts, plan_limit)
    return [
        DebtAccount(
            name=acc.name,
            balance=acc.balance,
            interest_rate=acc.interest_rate,
            min_payment=acc.min_payment if acc.min_payment else Decimal("50"),
            due_day=acc.due_day if acc.due_day else 15,
            closing_day=acc.closing_day if acc.closing_day else 0,
            debt_subtype=acc.debt_subtype if acc.debt_subtype else "",
            credit_limit=acc.credit_limit if acc.credit_limit else Decimal("0"),
        )
        for acc in active
    ]


def get_liquid_cash(accounts) -> Decimal:
    """Sum of non-debt account balances."""
    return sum(acc.balance for acc in accounts if acc.type != "debt")
