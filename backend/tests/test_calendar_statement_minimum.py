"""Calendar = mission for the statement minimum (audit of Fase B). With a statement minimum
still owed, the Calendar's bill shows the SAME number the daily mission reserves
(velocity_engine.statement_cycle_minimum, built by helpers.mission_accounts_for), on the
statement's due date. Without one, the Calendar stays exactly as before."""
from datetime import date
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from helpers import account_plan_minimum, build_daily_mission, calendar_month
from models import Account, CutHistory, Transaction

U = "d4d4d4d4-d4d4-4d4d-a4d4-d4d4d4d4d4d4"
TODAY = date(2026, 12, 1)


@pytest.fixture
def db():
    yield
    with Session(database.engine) as s:
        for model in (Transaction, CutHistory, Account):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def seed(balance=1000, smin=None, sdue=None, paid=None):
    with Session(database.engine) as s:
        a = Account(user_id=U, name="Visa", type="debt", balance=balance, interest_rate=24, min_payment=40,
                    debt_subtype="credit_card", due_day=20)
        s.add(a)
        s.commit()
        s.refresh(a)
        engine = account_plan_minimum(a)  # what the Calendar charged before this fix
        if smin is not None:
            s.add(CutHistory(user_id=U, account_id=a.id, cut_date=date(2026, 11, 25), reported_balance=balance,
                             statement_minimum=smin, statement_due_date=sdue))
        if paid:
            s.add(Transaction(user_id=U, account_id=a.id, amount=paid, date="2026-11-28", description="Pago", category="payment"))
        s.commit()
        return engine


def calendar_bills(month=12):
    with Session(database.engine) as s:
        cal = calendar_month(s, U, 2026, month, today=TODAY)
    return [(d["dia"], c["monto"], c.get("fuente")) for d in cal["dias"] for c in d["cobros"] if c["tipo"] == "minimo"]


def mission_minimum():
    with Session(database.engine) as s:
        accounts = s.exec(select(Account).where(Account.user_id == U)).all()
        r = build_daily_mission(s, U, accounts, today=TODAY)
    return [(o["fecha_evento"].day, o["monto"]) for o in r["obligaciones"] if o["tipo"] == "minimo"]


@pytest.mark.parametrize("balance,smin,paid,expected", [
    (1000, 120, None, D("120")),     # statement above the engine minimum (interest + 1% = $30, floor $35)
    (1000, 120, 50, D("70")),        # partial payment since the cut
    (6000, 90, None, D("180.00")),   # engine minimum (interest + 1% = $180) above the statement's
    (60, 120, None, D("60")),        # capped at the balance
])
def test_with_a_statement_calendar_and_mission_agree_to_the_cent(db, balance, smin, paid, expected):
    seed(balance=balance, smin=smin, sdue=date(2026, 12, 18), paid=paid)
    [(mday, mamount)] = mission_minimum()
    bills = calendar_bills()
    assert bills == [(18, mamount, "estado")]  # on the statement's date, never also on due_day 20
    assert (mday, mamount) == (18, expected)


def test_without_a_statement_the_calendar_is_unchanged(db):
    engine = seed()
    assert calendar_bills() == [(20, engine, None)]
    assert mission_minimum() == []


def test_statement_paid_off_back_to_the_engine_minimum(db):
    engine = seed(smin=120, sdue=date(2026, 12, 18), paid=120)
    assert calendar_bills() == [(20, engine, None)]
    assert mission_minimum() == []


def test_other_months_keep_the_engine_minimum_on_due_day(db):
    engine = seed(smin=120, sdue=date(2026, 12, 18))
    assert calendar_bills(month=1) == [(20, engine, None)]
