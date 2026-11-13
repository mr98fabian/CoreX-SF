"""U-11: a debt without due_day is never billed on a made-up day (it used to "charge"
on the 15th in every DebtAccount projection). It still counts in the totals; dated
surfaces skip it and say "sin fecha de pago cargada". Same truth as the daily mission."""
from datetime import date
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import _debt_account, accounts_to_debt_objects, calendar_month
from main import app
from models import Account
from velocity_engine import DebtAccount, compare_paths, generate_projected_calendar, get_closing_day_intelligence

U = "a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1"
START = date(2026, 12, 1)


def acc(name, due=None, closing=None, bal=1000):
    return Account(user_id=U, name=name, type="debt", balance=bal, interest_rate=24, min_payment=40,
                   debt_subtype="credit_card", due_day=due, closing_day=closing)


def bills(debts, days=62):
    cal = generate_projected_calendar(START, days, D("5000"), D("0"), debts)["calendar"]
    return [(c.date_obj.day, e["name"]) for c in cal for e in c.events if e["type"] == "bill"]


def test_debt_account_passes_no_date_through():
    assert _debt_account(acc("Sin fecha")).due_day is None
    assert _debt_account(acc("Con fecha", due=7)).due_day == 7
    assert DebtAccount(name="x", balance=D("1"), interest_rate=D("1"), min_payment=D("1")).due_day is None


def test_without_due_day_no_dated_charge_ever():
    assert bills([_debt_account(acc("Sin fecha"))]) == []


def test_with_due_day_its_exact_day():
    assert bills([_debt_account(acc("Con fecha", due=7))]) == [(7, "Con fecha"), (7, "Con fecha")]


def test_totals_do_not_change():
    rows = [acc("Sin fecha", bal=1200), acc("Con fecha", due=7, bal=800)]
    debts = accounts_to_debt_objects(rows)
    assert sum(d.balance for d in debts) == D("2000")
    dated = [_debt_account(acc("Sin fecha", due=15, bal=1200)), _debt_account(acc("Con fecha", due=7, bal=800))]
    a, b = compare_paths(debts, D("300"), start=START), compare_paths(dated, D("300"), start=START)
    assert (a["deuda_hoy"], a["plan"]["interes_total"], a["plan"]["meses"]) == (b["deuda_hoy"], b["plan"]["interes_total"], b["plan"]["meses"])


def test_closing_intelligence_labels_the_derived_grace_as_estimate():
    [i] = get_closing_day_intelligence([_debt_account(acc("Sin fecha", closing=20))])
    assert i["due_day"] is None and i["days_until_due"] is None
    assert i["grace_period_estimado"] is True
    [j] = get_closing_day_intelligence([_debt_account(acc("Con fecha", due=10, closing=20))])
    assert j["grace_period_estimado"] is False


@pytest.fixture
def db():
    app.dependency_overrides[get_current_user_id] = lambda: U
    with Session(database.engine) as s:
        s.add(acc("Sin fecha", bal=1200))
        s.add(acc("Con fecha", due=7, bal=800))
        s.commit()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for row in s.exec(select(Account).where(Account.user_id == U)).all():
            s.delete(row)
        s.commit()


def test_calendar_paints_only_the_dated_debt_and_lists_the_other(db):
    with Session(database.engine) as s:
        cal = calendar_month(s, U, 2026, 12, today=START)
    painted = [(d["dia"], c["nombre"]) for d in cal["dias"] for c in d["cobros"] if c["tipo"] == "minimo"]
    assert painted == [(7, "Con fecha")]
    assert cal["deudas_sin_fecha"] == ["Sin fecha"]


def test_cashflow_virtual_debt_has_no_day(client, db):
    rows = [r for r in client.get("/api/cashflow", headers={"Authorization": "Bearer x"}).json() if r.get("is_debt_virtual")]
    by = {r["name"]: r for r in rows}
    assert (by["Deuda: Sin fecha"]["day_of_month"], by["Deuda: Sin fecha"]["sin_fecha"]) == (None, True)
    assert (by["Deuda: Con fecha"]["day_of_month"], by["Deuda: Con fecha"]["sin_fecha"]) == (7, False)
