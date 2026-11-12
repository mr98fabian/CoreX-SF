"""Suscripciones dentro del motor (2026-11-12).

Two paths, both fixed:
- monthly (surplus, summary, projections): active subscriptions are expenses;
  a recurring item named like an active subscription counts once (as the
  subscription). Cancelled subscriptions never count. Nothing is deleted.
- dated (attack, daily mission): charges of active subscriptions with a
  next_charge_date enter the safe-equity simulation; without a date they are
  ignored there (no invented charge day) but still count monthly.

Measurement gate: the surplus drops by Σ active subscriptions − Σ deducted
recurring items (recurring-side amounts), ±1¢; the projection's total interest
moves even when the debt-free date doesn't."""
from datetime import date, timedelta
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import accounts_to_active_debt_objects, get_cashflow_surplus, load_cashflow_inputs
from main import app
from models import Account, CashflowItem, RecurringSubscription, Subscription
from velocity_engine import monthly_amount, monthly_surplus, simulate_freedom_path

U = "5b5b5b5b-5b5b-4b5b-a5b5-5b5b5b5b5b5b"
H = {"Authorization": "Bearer x"}

RECURRING = [("Nómina", "4500", "semi_monthly", True), ("Renta", "1800", "monthly", False),
             ("AT&T", "1036", "monthly", False), ("Planet Fitness", "27.28", "monthly", False),
             ("Hello Fitness (en cancelación)", "45", "monthly", False), ("Súper", "125", "weekly", False)]
SUBS = [("AT&T", "1035.99", "monthly", "active"), ("planet-fitness", "27.11", "monthly", "active"),
        ("Hello Fitness", "45", "monthly", "active"), ("Netflix", "15.49", "monthly", "active"),
        ("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active"),
        ("Disney", "13.99", "monthly", "cancelled")]


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


def seed(recurring=RECURRING, subs=SUBS, liquid="6000"):
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Cheques", type="checking", balance=D(liquid)))
        s.add(Account(user_id=U, name="Upstart", type="debt", balance=D("9463.94"), interest_rate=D("32.30"),
                      min_payment=D("380"), debt_subtype="personal_loan_revolving"))
        s.add(Account(user_id=U, name="Toyota", type="debt", balance=D("15325"), interest_rate=D("20.29"),
                      min_payment=D("641.12"), debt_subtype="auto_loan", interest_type="fixed", due_day=11))
        for name, amount, freq, inc in recurring:
            s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency=freq, is_income=inc,
                               category="income" if inc else "expense", day_of_month=5))
        for sub in subs:
            name, amount, freq, status = sub[:4]
            nxt = sub[4] if len(sub) > 4 else None
            s.add(RecurringSubscription(user_id=U, name=name, amount=D(amount), frequency=freq, status=status,
                                        next_charge_date=nxt))
        s.commit()


def debts_and_rows():
    with Session(database.engine) as s:
        accounts = s.exec(select(Account).where(Account.user_id == U)).all()
        debts = accounts_to_active_debt_objects(accounts)
        items = s.exec(select(CashflowItem).where(CashflowItem.user_id == U)).all()
        old_tuples = [(i.amount, i.frequency, bool(i.is_income or i.category == "income")) for i in items]
        new = get_cashflow_surplus(s, U, debts)
        data = load_cashflow_inputs(s, U)
    return debts, old_tuples, new, data


def get(client, url):
    r = client.get(url, headers=H)
    assert r.status_code == 200, (url, r.text)
    return r.json()


# ── Measurement gate ─────────────────────────────────────────

def test_surplus_drops_by_subscriptions_minus_deducted_recurring_and_interest_moves():
    seed()
    debts, old_tuples, new, data = debts_and_rows()
    old = monthly_surplus(old_tuples, debts)  # the engine before this change: recurring items only
    subs_total = sum((monthly_amount(D(a), f) for _, a, f, st in SUBS if st == "active"), D("0"))
    deducted = monthly_amount(D("1036"), "monthly") + monthly_amount(D("27.28"), "monthly")  # AT&T, Planet Fitness
    assert sorted(i.name for i in data["dupes"]) == ["AT&T", "Planet Fitness"]
    assert abs((old - new) - (subs_total - deducted)) <= D("0.01")
    before, after = simulate_freedom_path(debts, old), simulate_freedom_path(debts, new)
    print("MEASURE", {"old": str(old), "new": str(new), "drop": str(old - new), "subs": str(subs_total.quantize(D("0.01"))),
                       "deducted": str(deducted), "freedom": (before["freedom_date"], after["freedom_date"]),
                       "interest": (before["total_interest_paid"], after["total_interest_paid"])})
    assert D(str(after["total_interest_paid"])) > D(str(before["total_interest_paid"]))
    assert after["freedom_date"] >= before["freedom_date"]


def test_hello_fitness_en_cancelacion_is_NOT_matched_documented_gap():
    # "Hello Fitness (en cancelación)" normalises differently from "Hello Fitness": both count.
    seed()
    _, _, _, data = debts_and_rows()
    assert "Hello Fitness (en cancelación)" not in [i.name for i in data["dupes"]]


def test_without_subscriptions_everything_is_identical():
    seed(subs=[])
    debts, old_tuples, new, _ = debts_and_rows()
    assert new == monthly_surplus(old_tuples, debts)


def test_cancelled_subscription_never_subtracts():
    seed(subs=[("Disney", "13.99", "monthly", "cancelled")])
    debts, old_tuples, new, _ = debts_and_rows()
    assert new == monthly_surplus(old_tuples, debts)


def test_annual_and_weekly_are_monthlyised_like_everything_else(client):
    seed(recurring=[("Nómina", "4500", "monthly", True)],
         subs=[("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active")])
    summary = get(client, "/api/cashflow/summary")
    expected = (monthly_amount(D("120"), "annual") + monthly_amount(D("7.99"), "weekly")).quantize(D("0.01"))
    assert D(str(summary["subscriptions_monthly"])) == expected == D("44.62")


# ── One loader: every consumer sees the same surplus ──

def test_strategy_coach_and_summary_share_the_same_surplus_to_the_cent(client):
    seed()
    summary = get(client, "/api/cashflow/summary")
    proj = get(client, "/api/velocity/projections")
    cc = get(client, "/api/strategy/command-center")
    _, _, new, _ = debts_and_rows()
    assert summary["surplus_monthly"] == float(new)
    assert proj["assumptions"]["extra_monthly_payment"] == float(new)
    assert cc["excedente"]["mensual"] == float(new)
    assert proj["assumptions"]["subscriptions_monthly"] == cc["excedente"]["suscripciones_mensuales"] == summary["subscriptions_monthly"]


def test_analisis_te_quedan_equals_summary_balance_and_counts_duplicates_once(client):
    seed()
    v2, summary = get(client, "/api/analytics/v2"), get(client, "/api/cashflow/summary")
    assert v2["bloque"]["te_quedan"] == summary["balance_monthly"]
    assert v2["bloque"]["gastos_de_vida"] == summary["expenses_monthly"]
    assert v2["bloque"]["suscripciones"] == summary["subscriptions_monthly"]
    assert v2["duplicados"]["cantidad"] == 2
    b = v2["bloque"]
    assert round((b["entra"] - b["gastos_de_vida"] - b["suscripciones"] - b["pagos_a_deudas"]) * 100) == round(b["te_quedan"] * 100)


def test_summary_lines_add_up(client):
    seed()
    s = get(client, "/api/cashflow/summary")
    assert round(s["outflow_monthly"] * 100) == round((s["expenses_monthly"] + s["subscriptions_monthly"] + s["debt_payments_monthly"]) * 100)
    assert round(s["balance_monthly"] * 100) == round((s["income_monthly"] - s["outflow_monthly"]) * 100)


# ── Dated path: the attack sees dated charges ──

def test_a_dated_subscription_inside_the_window_lowers_the_attack(client):
    soon = (date.today() + timedelta(days=3)).isoformat()
    seed(recurring=[("Nómina", "4500", "monthly", True), ("Renta", "1800", "monthly", False)],
         subs=[("Gimnasio", "900", "monthly", "active")], liquid="9000")
    no_date = get(client, "/api/strategy/command-center")["mision"]["ataque"]
    with Session(database.engine) as s:
        sub = s.exec(select(RecurringSubscription).where(RecurringSubscription.user_id == U)).first()
        sub.next_charge_date = soon
        s.add(sub); s.commit()
    dated = get(client, "/api/strategy/command-center")["mision"]["ataque"]
    assert dated < no_date
    assert round((no_date - dated) * 100) == 90000  # exactly the charge


def test_a_dated_subscription_replaces_its_duplicate_recurring_item_in_the_dated_path():
    from helpers import dated_cashflow
    soon = (date.today() + timedelta(days=3)).isoformat()
    seed(recurring=[("Nómina", "4500", "monthly", True), ("AT&T", "1036", "monthly", False)],
         subs=[("AT&T", "1035.99", "monthly", "active", soon)])
    with Session(database.engine) as s:
        _, expenses = dated_cashflow(s, U, date.today(), 35)
    names = [e["name"] for e in expenses]
    assert names.count("AT&T") == 1 and [e for e in expenses if e["name"] == "AT&T"][0]["amount"] == D("1035.99")


# ── Subscriptions eat the whole surplus ──

def test_surplus_zero_by_subscriptions_no_attack_and_a_message_never_negative(client):
    seed(recurring=[("Nómina", "2000", "monthly", True), ("Renta", "500", "monthly", False)],
         subs=[("Todo", "1500", "monthly", "active")], liquid="1500")
    s = get(client, "/api/cashflow/summary")
    assert s["surplus_monthly"] == 0 and s["balance_monthly"] < 0  # floored surplus, honest balance
    cc = get(client, "/api/strategy/command-center")
    assert cc["excedente"]["comido_por_suscripciones"] is True
    assert cc["mision"]["ataque"] == 0
    proj = get(client, "/api/velocity/projections")
    assert proj["assumptions"]["subscriptions_eat_surplus"] is True and proj["assumptions"]["extra_monthly_payment"] == 0
