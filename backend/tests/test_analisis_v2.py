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
    "demo": {"summary": {"income_monthly": 4008.33, "expenses_monthly": 2570.0, "debt_payments_monthly": 976.12,
                         "outflow_monthly": 3546.12, "surplus_monthly": 462.21, "balance_monthly": 462.21, "has_income": True},
             "subs": SUBS_BASE},
    "owner": {"summary": {"income_monthly": 4300.0, "expenses_monthly": 1909.88, "debt_payments_monthly": 976.12,
                          "outflow_monthly": 2886.0, "surplus_monthly": 1414.01, "balance_monthly": 1414.01, "has_income": True},
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
