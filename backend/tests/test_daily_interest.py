"""Interés diario: one engine helper (Decimal), one plan-limited set, and the
dashboard, command center, logros and savings estimate all agree."""
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, Subscription
from velocity_engine import daily_interest, debt_daily_interest, interest_periods

A = "d1d1d1d1-d1d1-4d1d-a1d1-d1d1d1d1d1d1"
H = {"Authorization": "Bearer x"}


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == A)).all():
                s.delete(row)
        s.commit()


def as_user(plan="accelerator"):
    app.dependency_overrides[get_current_user_id] = lambda: A
    if plan:
        with Session(database.engine) as s:
            s.add(Subscription(user_id=A, plan=plan, status="active"))
            s.commit()


def debt(name, balance, apr):
    with Session(database.engine) as s:
        s.add(Account(user_id=A, name=name, type="debt", balance=Decimal(str(balance)), interest_rate=Decimal(str(apr)),
                      min_payment=Decimal("50"), debt_subtype="credit_card"))
        s.commit()


def test_helper_is_decimal_and_matches_the_formula():
    assert debt_daily_interest(Decimal("7200"), Decimal("26.99")) == Decimal("7200") * Decimal("26.99") / Decimal("36500")
    assert debt_daily_interest(0, 20) == 0 and debt_daily_interest(-50, 20) == 0 and debt_daily_interest(1000, 0) == 0
    D = type("D", (), {})
    ds = []
    for b, r in ((7200, "26.99"), (5400, "24.99"), (3500, "22.99"), (2300, "29.99")):  # María
        d = D(); d.balance, d.interest_rate = Decimal(b), Decimal(r); ds.append(d)
    out = daily_interest(ds)
    assert isinstance(out["total"], Decimal) and out["total"] == sum(out["por_deuda"])
    assert out["total"].quantize(Decimal("0.01")) == Decimal("13.12")


def test_periods_derive_from_the_daily():
    p = interest_periods(Decimal("10"))
    assert p["dia"] == 10 and p["semana"] == 70 and p["anio"] == 3650 and p["mes"] == Decimal("3650") / 12


def test_routers_agree_on_the_plan_limited_set(client):
    as_user(plan=None)  # starter: 2 highest-APR debts count
    debt("A", 3000, 29.99)
    debt("B", 2000, 24.99)
    debt("C", 9000, 10)  # plan-locked: must not count anywhere
    expected = float((debt_daily_interest(3000, Decimal("29.99")) + debt_daily_interest(2000, Decimal("24.99"))).quantize(Decimal("0.01")))
    dash = client.get("/api/dashboard", headers=H).json()
    assert dash["total_daily_interest"] == expected
    assert dash["interes_diario"]["periodos"]["dia"] == expected
    assert dash["interes_diario"]["periodos"]["semana"] == round(expected * 7, 2)  # what you see: day × 7
    logros = client.get("/api/logros", headers=H).json()
    assert logros["interes_diario"]["valor"] == expected
    assert client.get("/api/subscriptions/savings-estimate", headers=H).json()["daily_interest_all"] == expected
    cc = client.get("/api/strategy/command-center", headers=H).json()
    costs = {d["name"]: d["daily_cost"] for d in cc["confidence_meter"]["debts_ranked"]}
    assert set(costs) == {"A", "B"}
    assert costs["A"] == float(debt_daily_interest(3000, Decimal("29.99")).quantize(Decimal("0.01")))
