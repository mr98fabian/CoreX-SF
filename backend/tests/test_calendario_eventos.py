"""Calendario de eventos: GET /api/calendar/events is built with the SAME
functions as the daily mission, so they can't disagree by a day or a duplicate."""
from datetime import date
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import calendar_month, dated_cashflow
from main import app
from models import Account, CashflowItem, RecurringSubscription, Subscription
from velocity_engine import MissionAccount, corte_action_date, mission_obligations

U = "ca1ca1ca-1ca1-4ca1-aca1-ca1ca1ca1ca1"
H = {"Authorization": "Bearer x"}
TODAY = date(2026, 11, 12)


@pytest.fixture(autouse=True)
def clean():
    app.dependency_overrides[get_current_user_id] = lambda: U
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (RecurringSubscription, CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def seed():
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Cheques", type="checking", balance=D("1915.32")))
        # statement of Oct 17 was due Nov 10 (past) → the Nov 17 cut is a "corte" obligation
        s.add(Account(user_id=U, name="Amex Gold", type="debt", balance=D("1679.27"), interest_rate=D("28.74"),
                      min_payment=D("99.96"), debt_subtype="credit_card", closing_day=17, due_day=10))
        s.add(Account(user_id=U, name="Toyota", type="debt", balance=D("15325"), interest_rate=D("20.29"),
                      min_payment=D("641.12"), debt_subtype="auto_loan", interest_type="fixed", due_day=11))
        s.add(CashflowItem(user_id=U, name="Nómina", amount=D("4500"), frequency="monthly", day_of_month=5,
                           is_income=True, category="income"))
        s.add(CashflowItem(user_id=U, name="Renta", amount=D("1800"), frequency="monthly", day_of_month=1,
                           category="expense"))
        # AT&T typed twice: recurring on the 5th + subscription charged on the 20th → once, on the 20th
        s.add(CashflowItem(user_id=U, name="AT&T", amount=D("1036"), frequency="monthly", day_of_month=5, category="expense"))
        s.add(RecurringSubscription(user_id=U, name="AT&T", amount=D("1035.99"), frequency="monthly", status="active",
                                    next_charge_date="2026-10-20"))
        s.add(RecurringSubscription(user_id=U, name="Netflix", amount=D("15.49"), frequency="monthly", status="active",
                                    next_charge_date="2026-11-15"))
        s.add(RecurringSubscription(user_id=U, name="Spotify", amount=D("10.99"), frequency="monthly", status="active"))
        s.add(RecurringSubscription(user_id=U, name="Disney", amount=D("13.99"), frequency="monthly", status="cancelled",
                                    next_charge_date="2026-11-03"))
        s.commit()


def month():
    with Session(database.engine) as s:
        return calendar_month(s, U, 2026, 11, today=TODAY)


def test_contract_dated_charges_equal_dated_cashflow_day_by_day():
    seed()
    cal = month()
    with Session(database.engine) as s:
        _, expenses = dated_cashflow(s, U, date(2026, 11, 1), 30)
    for day in cal["dias"]:
        d = date.fromisoformat(day["fecha"])
        from_cal = sorted((c["nombre"], c["monto"]) for c in day["cobros"] if c["tipo"] != "minimo")
        from_mission = sorted((e["name"], e["amount"].quantize(D("0.01"))) for e in expenses if d in e["dates"])
        assert from_cal == from_mission, day["fecha"]


def test_cut_action_date_is_the_missions():
    seed()
    cal = month()
    [cut_day] = [d for d in cal["dias"] if d["cortes"]]
    assert cut_day["fecha"] == "2026-11-17"
    with Session(database.engine) as s:
        amex = s.exec(select(Account).where(Account.user_id == U, Account.name == "Amex Gold")).first()
        ma = MissionAccount(name=amex.name, balance=D(str(amex.balance)), interest_rate=D(str(amex.interest_rate)),
                            min_payment=D(str(amex.min_payment)), debt_subtype="credit_card", due_day=10, closing_day=17)
    [ob] = [o for o in mission_obligations([ma], TODAY) if o["tipo"] == "corte"]
    assert cut_day["cortes"][0]["pagar_antes_de"] == ob["fecha_accion"].isoformat() == "2026-11-15"
    assert corte_action_date(date(2026, 11, 17), TODAY) == ob["fecha_accion"]


def test_a_duplicated_service_appears_once_in_the_day_and_in_the_month_total():
    seed()
    cal = month()
    att = [(d["fecha"], c["monto"]) for d in cal["dias"] for c in d["cobros"] if c["nombre"] == "AT&T"]
    assert att == [("2026-11-20", D("1035.99"))]  # the subscription's day, not the recurring one's
    assert cal["total_mes_sale"] == sum((c["monto"] for d in cal["dias"] for c in d["cobros"]), D("0"))
    assert cal["total_mes_sale"] == D("1800") + D("1035.99") + D("15.49") + D("641.12") + _amex_min()  # rent + AT&T once + Netflix + Toyota + Amex minimum


def _amex_min():
    from helpers import account_plan_minimum
    with Session(database.engine) as s:
        return account_plan_minimum(s.exec(select(Account).where(Account.user_id == U, Account.name == "Amex Gold")).first())


def test_undated_subscription_is_counted_not_painted_and_cancelled_never_shows():
    seed()
    cal = month()
    names = {c["nombre"] for d in cal["dias"] for c in d["cobros"]}
    assert "Spotify" not in names and "Disney" not in names
    assert cal["suscripciones_sin_fecha"] == 1


def test_marks_per_day_and_minimums_on_due_day():
    seed()
    days = {d["dia"]: d for d in month()["dias"]}
    assert days[5]["marcas"] == {"payday": True, "cobro": False, "corte": False}  # AT&T moved to the 20th
    assert days[10]["marcas"]["cobro"] and days[10]["cobros"][0]["tipo"] == "minimo"  # Amex minimum
    assert days[11]["cobros"] == [{"nombre": "Toyota", "monto": D("641.12"), "tipo": "minimo"}]
    assert days[17]["marcas"] == {"payday": False, "cobro": False, "corte": True}


def test_empty_month_has_no_marks(client):
    with Session(database.engine) as s:
        s.add(Account(user_id=U, name="Cheques", type="checking", balance=D("100")))
        s.commit()
    r = client.get("/api/calendar/events?month=2026-11", headers=H).json()
    assert r["vacio"] is True and not any(any(d["marcas"].values()) for d in r["dias"])


def test_endpoint_with_kx_token_and_validation(client):
    from tests.test_api_tokens import bearer, make_token
    seed()
    tok = make_token(client, U, scopes=["read:dashboard"])
    r = client.get("/api/calendar/events?month=2026-11", headers=bearer(tok))
    assert r.status_code == 200 and len(r.json()["dias"]) == 30 and r.json()["etiqueta"] == "estimado"
    app.dependency_overrides[get_current_user_id] = lambda: U
    assert client.get("/api/calendar/events?month=2026-13", headers=H).status_code == 422
