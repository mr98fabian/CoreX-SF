"""Análisis v2: /api/analytics/v2 only COMPOSES existing sources (cashflow
summary, recurring subscriptions, plan_minimum, daily interest, avalanche
target, recorded payments). Plus the two engine steps it needs: one
monthly_amount table for cashflow AND subscriptions, and one PAYMENT_CATEGORIES."""
import os
from datetime import date, timedelta
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import api_tokens
import database
from auth import get_current_user_id
from main import app
from models import Account, ApiToken, ApiTokenAudit, CashflowItem, CutHistory, RecurringSubscription, Subscription, Transaction

U = "a2a2a2a2-a2a2-4a2a-a2a2-a2a2a2a2a2a2"
H = {"Authorization": "Bearer x"}

# Demo-like (the /api/demo/seed cashflow) and owner-like datasets
DEMO = [("Nómina", "1850", "biweekly", True), ("Renta", "1350", "monthly", False), ("Luz, agua y gas", "210", "monthly", False),
        ("Teléfono e internet", "85", "monthly", False), ("Seguro del auto", "145", "monthly", False),
        ("Supermercado", "120", "weekly", False), ("Gasolina", "60", "weekly", False)]
OWNER = [("Nómina", "2100", "semi_monthly", True), ("Bono", "1200", "annually", True), ("Renta", "1200", "monthly", False),
         ("Luz", "93.37", "monthly", False), ("Súper", "87.45", "weekly", False), ("Gasolina", "41.10", "biweekly", False),
         ("Seguro", "642.18", "annually", False), ("Gym", "29.99", "monthly", False), ("Celular", "65", "monthly", False)]
SUBS = [("Netflix", "15.49", "monthly", "active"), ("Dominio", "120", "annual", "active"), ("Café", "7.99", "weekly", "active"),
        ("iCloud", "2.99", "monthly", "active"), ("Disney", "13.99", "monthly", "cancelled")]


@pytest.fixture(autouse=True)
def clean():
    app.dependency_overrides[get_current_user_id] = lambda: U
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    api_tokens._hits.clear()
    with Session(database.engine) as s:
        for model in (ApiTokenAudit, ApiToken, Transaction, CutHistory, RecurringSubscription, CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def seed(cashflow, subs=SUBS, debts=True):
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Cheques", type="checking", balance=D("1915.32")))
        if debts:
            s.add(Account(user_id=U, name="Fortiva", type="debt", balance=D("800"), interest_rate=D("36"), min_payment=D("25"),
                          debt_subtype="credit_card", due_day=14, closing_day=20))
            s.add(Account(user_id=U, name="Upstart", type="debt", balance=D("8000"), interest_rate=D("22"), min_payment=D("300"),
                          debt_subtype="personal_loan_revolving"))
            s.add(Account(user_id=U, name="Auto", type="debt", balance=D("15325.11"), interest_rate=D("20.29"),
                          min_payment=D("641.12"), debt_subtype="auto_loan", interest_type="fixed", due_day=11))
        for name, amount, freq, inc in cashflow:
            s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency=freq, is_income=inc,
                               category="income" if inc else "expense", day_of_month=1))
        for name, amount, freq, status in subs:
            s.add(RecurringSubscription(user_id=U, name=name, amount=D(amount), frequency=freq, status=status))
        s.commit()


def get(client, url, headers=H):
    return client.get(url, headers=headers)


# ── Step 1 regression: summary and subscription totals identical ──
# Captured on main 8ee3335, before monthly_amount existed.
SUBS_BASE = {"monthly_total": "63.10", "annual_total": "757.24", "each": ["34.62", "10.00", "2.99", "15.49", "13.99"]}
BASELINE = {
    # feat/suscripciones-en-motor: the summary now counts the 63.10/mes of active subscriptions
    # (before: outflow 3546.12, surplus 462.21 · owner: outflow 2886.00, surplus 1414.01)
    "demo": {"summary": {"income_monthly": 4008.33, "expenses_monthly": 2570.0, "subscriptions_monthly": 63.1,
                         "debt_payments_monthly": 976.12, "outflow_monthly": 3609.22, "surplus_monthly": 399.11,
                         "balance_monthly": 399.11, "has_income": True},
             "subs": SUBS_BASE},
    "owner": {"summary": {"income_monthly": 4300.0, "expenses_monthly": 1909.88, "subscriptions_monthly": 63.1,
                          "debt_payments_monthly": 976.12, "outflow_monthly": 2949.1, "surplus_monthly": 1350.9,
                          "balance_monthly": 1350.9, "has_income": True},
              "subs": SUBS_BASE},
}


@pytest.mark.parametrize("name,data", [("demo", DEMO), ("owner", OWNER)])
def test_summary_and_subscription_totals_identical_to_before(client, name, data):
    seed(data)
    summary = get(client, "/api/cashflow/summary").json()
    subs = get(client, "/api/subscriptions").json()
    now = {"summary": summary, "subs": {"monthly_total": subs["monthly_total"], "annual_total": subs["annual_total"],
                                        "each": [x["monthly_equivalent"] for x in subs["items"]]}}
    print("REGRESSION", name, now)
    if os.environ.get("KX_CAPTURE_BASELINE"):
        return
    assert now == BASELINE[name]


# ── Step 2: one PAYMENT_CATEGORIES; the mission counts attacks too ──

def test_payment_categories_live_in_helpers_and_coach_imports_them():
    import routers.coach as coach
    from helpers import PAYMENT_CATEGORIES, is_payment_category
    assert PAYMENT_CATEGORIES == ("payment", "debt payment") and not hasattr(coach, "PAYMENT_CATEGORIES")
    assert is_payment_category("Debt Payment") and is_payment_category("payment") and not is_payment_category("Food: food")


def test_a_confirmed_attack_after_the_cut_reduces_the_pending_statement():
    from helpers import build_daily_mission
    t = date.today()
    seed([], subs=[], debts=False)
    with Session(database.engine) as s:
        amex = Account(user_id=U, name="Amex", type="debt", balance=D("2500"), interest_rate=D("27"), min_payment=D("80"),
                       debt_subtype="credit_card", closing_day=(t - timedelta(days=2)).day, due_day=(t + timedelta(days=20)).day)
        s.add(amex); s.commit(); s.refresh(amex)
        cut = t - timedelta(days=2)
        s.add(CutHistory(user_id=U, account_id=amex.id, cut_date=cut, reported_balance=D("1679.27")))
        s.add(Transaction(user_id=U, account_id=amex.id, date=(cut + timedelta(days=1)).isoformat(), amount=D("100"),
                          description="Pago", category="payment"))
        s.add(Transaction(user_id=U, account_id=amex.id, date=t.isoformat(), amount=D("400"),
                          description="Velocity Execution: Ataque", category="Debt Payment"))
        s.commit()
        r = build_daily_mission(s, U, s.exec(select(Account).where(Account.user_id == U)).all())
    [estado] = [o for o in r["obligaciones"] if o["cuenta"] == "Amex"]
    assert estado["monto"] == D("1179.27")  # 1679.27 − 100 manual − 400 attack (before: the attack was ignored → 1579.27)


# ── /api/analytics/v2: contract — every figure == its source ──

def test_v2_owner_dataset_with_zero_transactions_gives_real_numbers_equal_to_sources(client):
    seed(OWNER)
    v2 = get(client, "/api/analytics/v2").json()
    summary = get(client, "/api/cashflow/summary").json()
    subs = get(client, "/api/subscriptions").json()
    dash = get(client, "/api/dashboard").json()
    assert v2["estado"] == "ok" and v2["etiqueta"] == "estimado"
    b = v2["bloque"]
    assert b["entra"] == summary["income_monthly"] == 4300.0
    assert b["gastos_de_vida"] == summary["expenses_monthly"] == 1909.88
    assert b["pagos_a_deudas"] == summary["debt_payments_monthly"] == 976.12
    assert b["suscripciones"] == float(subs["monthly_total"])
    assert v2["heroe"]["sale_de_tu_bolsillo"] == round(summary["expenses_monthly"] + float(subs["monthly_total"]), 2)
    assert b["te_quedan"] == round(b["entra"] - b["gastos_de_vida"] - b["suscripciones"] - b["pagos_a_deudas"], 2)
    assert "surplus" not in str(v2)  # the engine surplus is not shown on this page
    assert v2["deudas"]["interes_por_dia"] == dash["total_daily_interest"]
    assert v2["deudas"]["objetivo"] == {"nombre": "Fortiva", "apr": 36.0}
    assert v2["deudas"]["pagado_este_mes"] == 0.0


def test_v2_bars_are_by_concept_and_add_up_exactly_to_the_hero(client):
    seed(OWNER)
    v2 = get(client, "/api/analytics/v2").json()
    bars = v2["en_que_se_va"]
    names = [x["nombre"] for x in bars]
    assert len(bars) == 7 and names[-1] == "Otros" and "Suscripciones" in names and names[0] == "Renta"
    assert round(sum(x["monto"] for x in bars), 2) == v2["heroe"]["sale_de_tu_bolsillo"]


def test_v2_without_hidden_bars_the_cents_still_close(client):
    seed(DEMO, subs=[])  # 6 expenses = 6 bars, nothing hidden
    v2 = get(client, "/api/analytics/v2").json()
    bars = v2["en_que_se_va"]
    assert "Otros" not in [x["nombre"] for x in bars]
    assert round(sum(x["monto"] for x in bars), 2) == v2["heroe"]["sale_de_tu_bolsillo"] == 2570.0


def test_v2_paid_this_month_counts_manual_payments_and_attacks_only(client):
    seed(OWNER)
    t = date.today()
    with Session(database.engine) as s:
        acc = s.exec(select(Account).where(Account.user_id == U, Account.name == "Fortiva")).first()
        for amount, cat, d in (("120", "payment", t), ("300", "Debt Payment", t), ("50", "payment", t.replace(day=1) - timedelta(days=1)),
                               ("80", "food", t), ("-40", "payment", t)):
            s.add(Transaction(user_id=U, account_id=acc.id, date=d.isoformat(), amount=D(amount), description=cat, category=cat))
        s.commit()
    assert get(client, "/api/analytics/v2").json()["deudas"]["pagado_este_mes"] == 420.0


@pytest.mark.parametrize("data,motivo", [([], "sin_recurrentes"), ([("Renta", "1200", "monthly", False)], "sin_ingresos")])
def test_v2_empty_states_are_explicit_never_silent_zeros(client, data, motivo):
    seed(data, subs=[])
    v2 = get(client, "/api/analytics/v2").json()
    assert (v2["estado"], v2["motivo"]) == ("vacio", motivo)


def test_v2_with_kx_token_200_and_without_auth_rejected(client):
    from tests.test_api_tokens import bearer, make_token
    seed(OWNER)
    tok = make_token(client, U, scopes=["read:dashboard"])
    assert client.get("/api/analytics/v2", headers=bearer(tok)).status_code == 200
    tok_no_scope = make_token(client, U, scopes=["read:accounts"], name="sin dashboard")
    assert client.get("/api/analytics/v2", headers=bearer(tok_no_scope)).status_code == 403
    app.dependency_overrides.pop(get_current_user_id, None)
    assert client.get("/api/analytics/v2").status_code in (401, 403)


# ── Dedupe (presentation only), top 3, zero-hero guard ──

DUP_RECURRENTES = [("Nómina", "9000", "monthly", True), ("Renta", "1500", "monthly", False),
                   ("AT&T", "1036", "monthly", False), ("Washington National", "38.41", "monthly", False),
                   ("Planet Fitness", "27.28", "monthly", False), ("Hello Fitness", "45", "monthly", False),
                   ("Self Lender", "27.87", "monthly", False), ("CreditStrong", "28.30", "monthly", False),
                   ("RentReporters", "11", "monthly", False), ("Frontier Sec", "86", "monthly", False),
                   ("Suscripciones (varias)", "330", "monthly", False), ("Kikoff", "35", "monthly", False)]
DUP_SUBS = [("AT&T", "1035.99", "monthly", "active"), ("Washington  National", "38.41", "monthly", "active"),
            ("planet-fitness", "27.11", "monthly", "active"), ("Hello Fitness", "45", "monthly", "active"),
            ("Self Lender", "26.20", "monthly", "active"), ("CreditStrong", "29.14", "monthly", "active"),
            ("RentReporters", "10.95", "monthly", "active"), ("Frontier (internet)", "86.49", "monthly", "active"),
            ("Kikoff", "35", "monthly", "cancelled")]  # cancelled: Kikoff stays a living expense


def test_v2_counts_a_service_once_when_it_is_both_recurring_and_subscription(client):
    seed(DUP_RECURRENTES, subs=DUP_SUBS, debts=False)
    with Session(database.engine) as s:
        before = (len(s.exec(select(CashflowItem).where(CashflowItem.user_id == U)).all()),
                  len(s.exec(select(RecurringSubscription).where(RecurringSubscription.user_id == U)).all()))
    v2 = get(client, "/api/analytics/v2").json()
    summary = get(client, "/api/cashflow/summary").json()
    subs = get(client, "/api/subscriptions").json()
    d = v2["duplicados"]
    assert d["cantidad"] == 7 and d["monto_mensual"] == 1213.86
    assert d["servicios"] == sorted(["AT&T", "Washington National", "Planet Fitness", "Hello Fitness", "Self Lender",
                                     "CreditStrong", "RentReporters"])
    # Frontier Sec vs Frontier (internet): different names, NOT deduplicated (pending owner confirmation)
    assert "Frontier Sec" in [b["nombre"] for b in v2["en_que_se_va"]] or v2["en_que_se_va"][-1]["nombre"] == "Otros"
    # the engine applies the same rule: the summary's living expenses already exclude the overlap
    assert summary["expenses_monthly"] == 1951.0 and summary["subscriptions_monthly"] == 1299.29
    assert v2["bloque"]["gastos_de_vida"] == round(3164.86 - 1213.86, 2) == 1951.0
    assert v2["bloque"]["suscripciones"] == float(subs["monthly_total"]) == 1299.29
    assert v2["heroe"]["sale_de_tu_bolsillo"] == round(1951.0 + 1299.29, 2)
    b = v2["bloque"]
    assert b["te_quedan"] == round(b["entra"] - b["gastos_de_vida"] - b["suscripciones"] - b["pagos_a_deudas"], 2)
    assert round(sum(x["monto"] for x in v2["en_que_se_va"]), 2) == v2["heroe"]["sale_de_tu_bolsillo"]
    assert not {"AT&T", "Planet Fitness"} & {x["nombre"] for x in v2["en_que_se_va"]}
    # no user data touched
    with Session(database.engine) as s:
        after = (len(s.exec(select(CashflowItem).where(CashflowItem.user_id == U)).all()),
                 len(s.exec(select(RecurringSubscription).where(RecurringSubscription.user_id == U)).all()))
    assert before == after


def test_v2_top_3_subscriptions_by_monthly_amount(client):
    seed(DUP_RECURRENTES, subs=DUP_SUBS + [("Dominio", "1200", "annual", "active")], debts=False)
    top = get(client, "/api/analytics/v2").json()["suscripciones"]["top_3"]
    assert top == [{"nombre": "AT&T", "monto": 1035.99}, {"nombre": "Dominio", "monto": 100.0},
                   {"nombre": "Frontier (internet)", "monto": 86.49}]


def test_v2_income_but_nothing_going_out_is_the_guided_empty_state_not_a_zero_hero(client):
    seed([("Nómina", "3000", "monthly", True)], subs=[], debts=False)
    v2 = get(client, "/api/analytics/v2").json()
    assert (v2["estado"], v2["motivo"]) == ("vacio", "sin_gastos")
