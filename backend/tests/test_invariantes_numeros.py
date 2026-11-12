"""Stress of the numbers (2026-11-11): every screen's figures must agree with each
other. One rich owner-like dataset; each invariant is a test, so a future change
that breaks a sum is caught here before Fabián sees it."""
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, CashflowItem, RecurringSubscription, Subscription, Transaction

U = "1e1e1e1e-1e1e-4e1e-a1e1-1e1e1e1e1e1e"
H = {"Authorization": "Bearer x"}
cents = lambda x: round(float(x) * 100)  # noqa: E731


@pytest.fixture
def owner(client):
    app.dependency_overrides[get_current_user_id] = lambda: U
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Chase Checking", type="checking", balance=D("1915.32")))
        for name, bal, apr, mn, sub, due, close in (
                ("Upstart", "9463.94", "32.30", "380", "personal_loan_revolving", 3, None),
                ("Amex Gold", "1679.27", "28.74", "99.96", "credit_card", 7, 12),
                ("Chase 2323", "34.23", "24.99", "10.95", "credit_card", 18, 21),
                ("Fortiva", "93.08", "29.99", "25", "credit_card", 14, 22),
                ("Toyota", "15325.00", "20.29", "641.12", "auto_loan", 11, None)):
            s.add(Account(user_id=U, name=name, type="debt", balance=D(bal), interest_rate=D(apr), min_payment=D(mn),
                          debt_subtype=sub, interest_type="fixed" if sub == "auto_loan" else "revolving",
                          due_day=due, closing_day=close))
        for name, amount, freq, inc in (("Nómina", "4500", "semi_monthly", True), ("Renta", "1800", "monthly", False),
                                        ("AT&T", "1036", "monthly", False), ("Súper", "125", "weekly", False),
                                        ("Gasolina", "60", "biweekly", False), ("Seguro", "642.18", "annually", False)):
            s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency=freq, is_income=inc,
                               category="income" if inc else "expense", day_of_month=1))
        for name, amount, freq, status in (("AT&T", "1035.99", "monthly", "active"), ("Netflix", "15.49", "monthly", "active"),
                                           ("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active"),
                                           ("Disney", "13.99", "monthly", "cancelled")):
            s.add(RecurringSubscription(user_id=U, name=name, amount=D(amount), frequency=freq, status=status))
        s.commit()
    yield client
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (Transaction, RecurringSubscription, CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def get(c, url):
    r = c.get(url, headers=H)
    assert r.status_code == 200, (url, r.status_code)
    return r.json()


# ── Análisis v2 ──

def test_analisis_bars_add_up_to_the_hero_to_the_cent(owner):
    v2 = get(owner, "/api/analytics/v2")
    assert v2["estado"] == "ok"
    assert sum(cents(b["monto"]) for b in v2["en_que_se_va"]) == cents(v2["heroe"]["sale_de_tu_bolsillo"])


def test_analisis_block_arithmetic_and_hero(owner):
    v2 = get(owner, "/api/analytics/v2")
    b = v2["bloque"]
    assert cents(b["entra"]) - cents(b["gastos_de_vida"]) - cents(b["suscripciones"]) - cents(b["pagos_a_deudas"]) == cents(b["te_quedan"])
    assert cents(b["gastos_de_vida"]) + cents(b["suscripciones"]) == cents(v2["heroe"]["sale_de_tu_bolsillo"])


def test_analisis_matches_its_sources(owner):
    v2, summary, subs = get(owner, "/api/analytics/v2"), get(owner, "/api/cashflow/summary"), get(owner, "/api/subscriptions")
    b = v2["bloque"]
    assert b["entra"] == summary["income_monthly"]
    assert b["pagos_a_deudas"] == summary["debt_payments_monthly"]
    assert b["suscripciones"] == float(subs["monthly_total"])
    # living = summary expenses minus the services counted once on the subscription side
    # (works before and after the dedupe branch: without it there is no overlap field)
    overlap = v2.get("duplicados", {}).get("monto_mensual", 0)
    assert cents(b["gastos_de_vida"]) == cents(summary["expenses_monthly"]) - cents(overlap)


# ── Suscripciones ──

def test_subscription_total_is_the_sum_of_active_ones_and_cancelled_never_count(owner):
    subs = get(owner, "/api/subscriptions")
    active = [x for x in subs["items"] if x["status"] == "active"]
    assert sum(cents(x["monthly_equivalent"]) for x in active) == cents(subs["monthly_total"])
    assert "Disney" not in [x["name"] for x in active]
    assert abs(cents(subs["annual_total"]) - cents(subs["monthly_total"]) * 12) <= 12  # annual from the unrounded month


# ── Plan / Inicio / Calendario agree with the summary ──

def test_inicio_and_plan_show_the_same_mission_and_attack(owner):
    dash, cc = get(owner, "/api/dashboard"), get(owner, "/api/strategy/command-center")
    assert dash["mision"] == cc["mision"]
    assert dash["attack_equity"] == cc["mision"]["ataque"]
    if cc["morning_briefing"]:
        assert cc["morning_briefing"]["recommended_action"]["amount"] <= cc["mision"]["ataque"]


def test_attack_never_exceeds_cash_after_the_cycle_reserve(owner):
    m = get(owner, "/api/strategy/command-center")["mision"]
    liquid = get(owner, "/api/dashboard")["liquid_cash"]
    assert cents(m["ataque"]) <= max(0, cents(liquid) - cents(m["reserva"]))


def test_freedom_date_is_the_same_on_plan_and_calendar(owner):
    cc, path = get(owner, "/api/strategy/command-center"), get(owner, "/api/velocity/freedom-path")
    assert cc["freedom_counter"]["current_freedom_date"][:7] == path["freedom_date"][:7]


def test_without_income_there_is_no_attack(client):
    app.dependency_overrides[get_current_user_id] = lambda: U
    try:
        with Session(database.engine) as s:
            s.add(Account(user_id=U, name="Cheques", type="checking", balance=D("5000")))
            s.add(Account(user_id=U, name="Visa", type="debt", balance=D("3000"), interest_rate=D("24"), min_payment=D("90"),
                          debt_subtype="credit_card"))
            s.commit()
        summary = get(client, "/api/cashflow/summary")
        assert summary["has_income"] is False and summary["surplus_monthly"] is None
        assert get(client, "/api/strategy/command-center")["mision"]["ataque"] == 0
        assert get(client, "/api/dashboard")["attack_equity"] == 0
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
        with Session(database.engine) as s:
            for row in s.exec(select(Account).where(Account.user_id == U)).all():
                s.delete(row)
            s.commit()
