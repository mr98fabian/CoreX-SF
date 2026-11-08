"""Panel de crédito: totals only over credit cards with a limit (>0), scale
edges, over-limit, negative balance, HELOC and plan-locked cards excluded,
no block without limited cards, isolation."""
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, Subscription
from velocity_engine import card_utilization, credit_panel, utilization_band

A = "c1c1c1c1-c1c1-4c1c-a1c1-c1c1c1c1c1c1"
B = "c2c2c2c2-c2c2-4c2c-a2c2-c2c2c2c2c2c2"
H = {"Authorization": "Bearer x"}


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (Account, Subscription):
            for row in s.exec(select(model).where(model.user_id.in_([A, B]))).all():
                s.delete(row)
        s.commit()


def as_user(uid, plan="accelerator"):
    app.dependency_overrides[get_current_user_id] = lambda: uid
    if plan:
        with Session(database.engine) as s:
            s.add(Subscription(user_id=uid, plan=plan, status="active"))
            s.commit()


def card(uid, name, balance, limit, apr=20, subtype="credit_card"):
    with Session(database.engine) as s:
        a = Account(user_id=uid, name=name, type="debt", balance=Decimal(str(balance)), interest_rate=Decimal(str(apr)),
                    min_payment=Decimal("50"), debt_subtype=subtype,
                    credit_limit=None if limit is None else Decimal(str(limit)))
        s.add(a)
        s.commit()
        s.refresh(a)
        return a.id


def demo_cards(uid):
    """Same shape as the demo: 4 cards with a limit, one null, one at 0."""
    ids = [card(uid, "Chase", 6800, 8000), card(uid, "Citi", 3400, 5000),
           card(uid, "Discover", 1150, 1500), card(uid, "Capital One", 0, 1500)]
    ids += [card(uid, "Amex Gold", 900, None), card(uid, "Store", 1000, 0)]
    return ids


def test_totals_exclude_cards_without_a_limit(client):
    as_user(A)
    ids = demo_cards(A)
    p = client.get("/api/accounts/credit-panel", headers=H).json()
    assert p["active"] is True
    assert p["limite_total"] == 16000.0 and p["usado"] == 11350.0 and p["disponible"] == 4650.0
    assert p["utilizacion_global"] == 70.9 and p["banda_global"] == "high"
    assert sorted(p["sin_limite"]) == sorted(ids[4:])
    assert set(p["por_tarjeta"]) == {str(i) for i in ids[:4]}
    assert p["por_tarjeta"][str(ids[3])] == {"pct": 0.0, "banda": "low"}
    assert p["etiqueta"] == "estimado" and p["nota"].startswith("Utilización actual estimada")


@pytest.mark.parametrize("pct,band", [("0", "low"), ("10", "low"), ("10.01", "mid"), ("30", "mid"), ("30.01", "high")])
def test_scale_edges(pct, band):
    assert utilization_band(Decimal(pct)) == band
    assert utilization_band(card_utilization(Decimal(pct) * 100, Decimal("10000"))) == band


def test_over_limit_goes_past_100_and_negative_balance_floors_at_zero():
    assert card_utilization(Decimal("1800"), Decimal("1500")) == Decimal("120")
    assert utilization_band(Decimal("120")) == "high"
    assert card_utilization(Decimal("-200"), Decimal("1000")) == 0
    p = credit_panel([(1, Decimal("-200"), Decimal("1000")), (2, Decimal("500"), Decimal("1000"))])
    assert p["usado"] == Decimal("500") and p["utilizacion_global"] == Decimal("25")


def test_no_limit_rule_is_null_or_not_positive():
    assert card_utilization(Decimal("10"), None) is None
    assert card_utilization(Decimal("10"), Decimal("0")) is None
    assert card_utilization(Decimal("10"), Decimal("-5")) is None


def test_heloc_with_a_limit_is_out(client):
    as_user(A)
    card(A, "HELOC", 20000, 50000, subtype="heloc")
    c = card(A, "Chase", 1000, 10000)
    p = client.get("/api/accounts/credit-panel", headers=H).json()
    assert p["limite_total"] == 10000.0 and list(p["por_tarjeta"]) == [str(c)]


def test_plan_locked_card_is_out(client):
    as_user(A, plan=None)  # starter: the engine keeps the 2 highest-APR debts with balance
    hi = card(A, "Hi", 1000, 2000, apr=29)
    mid = card(A, "Mid", 1000, 2000, apr=25)
    locked = card(A, "Low", 1000, 2000, apr=10)
    zero = card(A, "Paid", 0, 3000, apr=5)  # no balance: not locked, its limit counts
    p = client.get("/api/accounts/credit-panel", headers=H).json()
    assert set(p["por_tarjeta"]) == {str(hi), str(mid), str(zero)}
    assert str(locked) not in p["por_tarjeta"] and p["limite_total"] == 7000.0


def test_no_limited_cards_means_no_block(client):
    as_user(A)
    card(A, "Amex Gold", 900, None)
    card(A, "Auto", 15000, None, subtype="auto_loan")
    p = client.get("/api/accounts/credit-panel", headers=H).json()
    assert p["active"] is False and p["utilizacion_global"] is None


def test_isolated_between_users(client):
    as_user(A)
    demo_cards(A)
    as_user(B)
    assert client.get("/api/accounts/credit-panel", headers=H).json()["active"] is False
