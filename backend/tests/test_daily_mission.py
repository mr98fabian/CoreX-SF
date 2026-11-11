"""Plan-Obligaciones: one daily mission (velocity_engine.get_daily_mission) for
Inicio and the Plan. Obligations first (loan payment, statement, corte en cero),
then the avalanche attack with what is left. No invented salary, no phantom
due day, no double-counted minimums, never a silent $0 attack."""
from datetime import date, timedelta
from decimal import Decimal
import json

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import build_daily_mission
from main import app
from models import Account, CashflowItem, CutHistory, Subscription, Transaction
from velocity_engine import MissionAccount, get_daily_mission, mission_obligations

TODAY = date(2026, 11, 10)
D = Decimal
INCOME = [{"name": "Nómina", "amount": D("3000"), "dates": {date(2026, 11, 28)}}]


def card(name="Chase", bal="1000", rate="24", mn="200", closing=None, due=None, **kw):
    return MissionAccount(name=name, balance=D(bal), interest_rate=D(rate), min_payment=D(mn),
                          debt_subtype="credit_card", closing_day=closing, due_day=due, **kw)


def loan(name="Auto", bal="20000", mn="641.12", due=11):
    return MissionAccount(name=name, balance=D(bal), interest_rate=D("5"), min_payment=D(mn),
                          debt_subtype="auto_loan", due_day=due)


# ── Card states are exclusive ────────────────────────────────

def test_before_the_cut_pay_the_full_balance_by_cut_minus_2():
    # statement of Oct 21 was due Nov 5 (past): next is the Nov 21 cut
    [o] = mission_obligations([card(closing=21, due=5)], TODAY)
    assert (o["tipo"], o["monto"], o["fecha_accion"], o["fecha_evento"]) == ("corte", D("1000"), date(2026, 11, 19), date(2026, 11, 21))
    assert o["copy"] == "Deja la Chase en $0 — paga a más tardar el 19 de noviembre para que reporte $0 el 21 de noviembre"


def test_after_the_cut_the_statement_is_reported_minus_payments_since_and_never_both():
    acc = card(name="Amex", bal="2500", closing=5, due=28, last_cut_date=date(2026, 11, 5),
               last_cut_reported=D("1679.27"), paid_since_cut=D("300"))
    obs = mission_obligations([acc], TODAY)
    assert [o["tipo"] for o in obs] == ["estado"]  # the Dec 5 cut is inside the window, but states are exclusive
    assert obs[0]["monto"] == D("1379.27") and obs[0]["fecha_evento"] == date(2026, 11, 28)
    assert obs[0]["copy"] == "Paga el estado de la Amex ($1,379.27) antes del 28 de noviembre"


def test_after_the_cut_without_cut_history_the_statement_is_the_full_balance():
    [o] = mission_obligations([card(name="Amex", bal="1679.27", closing=5, due=28)], TODAY)
    assert (o["tipo"], o["monto"]) == ("estado", D("1679.27"))


def test_a_zero_cut_covers_the_statement_and_the_card_goes_back_to_corte():
    acc = card(closing=5, due=28, last_cut_date=date(2026, 11, 5), last_cut_reported=D("0"))
    [o] = mission_obligations([acc], TODAY)
    assert (o["tipo"], o["fecha_evento"]) == ("corte", date(2026, 12, 5))


def test_loan_payment_on_its_real_due_day():
    [o] = mission_obligations([loan()], TODAY)
    assert (o["tipo"], o["monto"], o["fecha_evento"]) == ("prestamo", D("641.12"), date(2026, 11, 11))
    assert o["copy"] == "Reserva el pago de la Auto ($641.12) para el 11 de noviembre"


# ── Reserve, attack, mission ─────────────────────────────────

def test_obligation_in_the_window_is_not_counted_twice_in_safe_equity():
    big = card(name="Visa", bal="10000", rate="12", mn="200")  # no dates: no obligation, no bill
    r = get_daily_mission([loan(), big], D("5000"), D("1000"), INCOME, [], today=TODAY)
    assert r["reserva"] == D("641.12")
    # liquid − reserve − shield, exactly: the loan's minimum is not billed again in the simulation
    assert r["ataque"] == D("3358.88")
    assert r["mision"]["tipo"] == "prestamo"  # the obligation is the mission; the attack is what is left


def test_without_income_there_is_no_attack_and_only_obligations_show():
    r = get_daily_mission([loan(), card(name="Visa", bal="10000", rate="12")], D("5000"), D("1000"), [], [], today=TODAY)
    assert r["ataque"] == D("0") and r["mision"]["tipo"] == "prestamo"
    r = get_daily_mission([card(name="Visa", bal="10000", rate="12")], D("5000"), D("1000"), [], [], today=TODAY)
    assert r["mision"] is None and r["ataque"] == D("0")


def test_reserve_above_liquid_is_a_faltante_with_the_exact_amount():
    amex = card(name="Amex", bal="1679.27", closing=5, due=28)
    r = get_daily_mission([loan(), amex], D("1000"), D("1000"), INCOME, [], today=TODAY)
    m = r["mision"]
    # 641.12 (Nov 11) fits; 641.12 + 1679.27 = 2320.39 → 1320.39 missing for the Amex statement
    assert (m["tipo"], m["cuenta"], m["monto"], m["obligacion"]) == ("faltante", "Amex", D("1320.39"), "estado")
    assert m["copy"] == "Te faltan $1,320.39 para cubrir el estado de la Amex del 28 de noviembre"
    assert r["ataque"] == D("0")


def test_account_without_due_day_has_no_obligation_on_the_15th():
    no_due = loan(due=None)
    r = get_daily_mission([no_due], D("5000"), D("1000"), INCOME, [], today=TODAY)
    assert r["obligaciones"] == []
    # nothing billed on a default day: attack = liquid − shield
    assert r["ataque"] == D("4000.00") and r["mision"]["tipo"] == "avalancha"


def test_no_obligations_means_avalanche_on_the_highest_apr():
    r = get_daily_mission([card(name="Visa", bal="800", rate="29"), card(name="Upstart", bal="5000", rate="20", mn="900")],
                          D("3000"), D("1000"), INCOME, [], today=TODAY)
    assert (r["mision"]["tipo"], r["mision"]["cuenta"], r["mision"]["monto"]) == ("avalancha", "Visa", D("800"))


# ── HTTP: one source for Inicio and Plan ─────────────────────

A = "0b0b0b0b-0b0b-4b0b-a0b0-0b0b0b0b0b0b"
H = {"Authorization": "Bearer x"}


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (Transaction, CutHistory, CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == A)).all():
                s.delete(row)
        s.commit()


def seed(income=None, liquid="5000"):
    app.dependency_overrides[get_current_user_id] = lambda: A
    t = date.today()
    with Session(database.engine) as s:
        s.add(Subscription(user_id=A, plan="accelerator", status="active"))
        s.add(Account(user_id=A, name="Cheques", type="checking", balance=D(liquid)))
        # a loan due in 3 days: always an obligation in the window
        s.add(Account(user_id=A, name="Auto", type="debt", balance=D("20000"), interest_rate=D("5"), min_payment=D("641.12"),
                      debt_subtype="auto_loan", interest_type="fixed", due_day=(t + timedelta(days=3)).day))
        s.add(Account(user_id=A, name="Upstart", type="debt", balance=D("8000"), interest_rate=D("22"), min_payment=D("300"),
                      debt_subtype="personal_loan_revolving"))
        if income:
            s.add(income)
        s.commit()


def get(client, url):
    return client.get(url, headers=H).json()


def test_inicio_and_plan_expose_the_same_mission(client):
    seed(CashflowItem(user_id=A, name="Nómina", amount=D("2400"), category="Ingreso", is_income=True,
                      frequency="biweekly", day_of_week=4))
    dash, plan = get(client, "/api/dashboard"), get(client, "/api/strategy/command-center")
    assert dash["mision"] == plan["mision"]
    assert dash["mision"]["mision"]["tipo"] == "prestamo"
    assert dash["attack_equity"] == plan["mision"]["ataque"]


def test_biweekly_income_flagged_is_income_counts_in_inicio(client):
    seed(CashflowItem(user_id=A, name="Nómina", amount=D("2400"), category="Ingreso", is_income=True,
                      frequency="biweekly", day_of_week=4))
    dash = get(client, "/api/dashboard")
    events = [e["name"] for day in dash["calendar"] for e in day["events"]]
    assert "Nómina" in events
    assert dash["attack_equity"] > 0  # the income is real, so there is an attack after the reserve


def test_user_without_income_gets_no_attack_and_never_an_invented_salary(client):
    seed()
    dash, plan = get(client, "/api/dashboard"), get(client, "/api/strategy/command-center")
    assert dash["attack_equity"] == 0 and plan["morning_briefing"] is None
    assert plan["mision"]["mision"]["tipo"] == "prestamo"
    for body in (dash, plan):
        text = json.dumps(body)
        assert "Salary" not in text


def test_statement_uses_cut_history_minus_payments_recorded_after_it(client):
    seed()
    t = date.today()
    with Session(database.engine) as s:
        closing = (t - timedelta(days=2)).day
        due = (t + timedelta(days=20)).day
        amex = Account(user_id=A, name="Amex", type="debt", balance=D("2500"), interest_rate=D("27"), min_payment=D("80"),
                       debt_subtype="credit_card", closing_day=closing, due_day=due)
        s.add(amex); s.commit(); s.refresh(amex)
        cut = t - timedelta(days=2)
        s.add(CutHistory(user_id=A, account_id=amex.id, cut_date=cut, reported_balance=D("1679.27")))
        s.add(Transaction(user_id=A, account_id=amex.id, date=(cut + timedelta(days=1)).isoformat(), amount=D("179.27"),
                          description="Pago", category="payment"))
        s.add(Transaction(user_id=A, account_id=amex.id, date=(cut - timedelta(days=1)).isoformat(), amount=D("999"),
                          description="Pago anterior al corte", category="payment"))
        s.commit()
        accounts = s.exec(select(Account).where(Account.user_id == A)).all()
        r = build_daily_mission(s, A, accounts)
    [estado] = [o for o in r["obligaciones"] if o["cuenta"] == "Amex"]
    assert (estado["tipo"], estado["monto"]) == ("estado", D("1500.00"))
