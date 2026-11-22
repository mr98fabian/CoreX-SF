"""
Performance guards (misión 2026-11-22-limpieza-optimizacion). In production every SQL
statement is one network round trip to Supabase (~55 ms measured), so:
  - the payments-since-cut of the daily mission are ONE query, not one per debt (N+1);
  - the paid amounts it reads are exactly the ones the per-debt query used to read;
  - endpoints that do sync DB work are plain `def` (threadpool), never `async def`
    without awaits, which would block the event loop and serialize the whole panel.
"""
import ast
import pathlib
from datetime import date
from decimal import Decimal as D

import pytest
from sqlalchemy import event
from sqlmodel import Session, select

import database
from helpers import mission_accounts_for
from models import Account, CutHistory, Transaction

U = "e5e5e5e5-e5e5-4e5e-a5e5-e5e5e5e5e5e5"


@pytest.fixture
def db():
    yield
    with Session(database.engine) as s:
        for model in (Transaction, CutHistory, Account):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def _seed(n):
    """n debts, each with a cut on a different day and payments before AND after it."""
    with Session(database.engine) as s:
        for i in range(n):
            a = Account(user_id=U, name=f"Card {i}", type="debt", balance=1000 + i, interest_rate=20 + i,
                        min_payment=40, debt_subtype="credit_card", due_day=20)
            s.add(a)
            s.commit()
            s.refresh(a)
            s.add(CutHistory(user_id=U, account_id=a.id, cut_date=date(2026, 11, 10 + i), reported_balance=1000))
            s.add(Transaction(user_id=U, account_id=a.id, amount=-50, date=f"2026-11-{10 + i:02d}",
                              description="before or on cut", category="payment"))   # not counted (date == cut)
            s.add(Transaction(user_id=U, account_id=a.id, amount=-(10 + i), date="2026-11-20",
                              description="after cut", category="payment"))          # counted
            s.add(Transaction(user_id=U, account_id=a.id, amount=-7, date="2026-11-21",
                              description="purchase", category="shopping"))         # not a payment
        s.commit()


def _run():
    with Session(database.engine) as s:
        debts = s.exec(select(Account).where(Account.user_id == U)).all()
        count = {"n": 0}

        def _c(*_a):
            count["n"] += 1
        event.listen(database.engine, "before_cursor_execute", _c)
        try:
            out = mission_accounts_for(s, U, debts, date(2026, 11, 22))
        finally:
            event.remove(database.engine, "before_cursor_execute", _c)
        return out, count["n"]


def test_mission_accounts_query_count_does_not_grow_with_debts(db):
    _seed(1)
    _, one = _run()
    _seed(4)  # 5 debts now
    _, five = _run()
    assert five == one <= 2, (one, five)


def test_mission_accounts_paid_since_cut_is_per_account(db):
    _seed(3)
    out, _ = _run()
    paid = sorted(m.paid_since_cut for m in out)
    assert paid == [D("10"), D("11"), D("12")]


def test_no_async_route_without_await():
    """An `async def` route that never awaits runs its sync DB calls ON the event loop."""
    root = pathlib.Path(__file__).resolve().parent.parent
    bad = []
    for f in list(root.glob("routers/*.py")) + [root / "main.py"]:
        for node in ast.walk(ast.parse(f.read_text(encoding="utf-8"))):
            if not isinstance(node, ast.AsyncFunctionDef):
                continue
            is_route = any(isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute)
                           and d.func.attr in ("get", "post", "put", "patch", "delete") for d in node.decorator_list)
            awaits = any(isinstance(n, (ast.Await, ast.AsyncFor, ast.AsyncWith)) for n in ast.walk(node))
            if is_route and not awaits:
                bad.append(f"{f.name}:{node.name}")
    assert not bad, bad
