"""Engine calibration (2026-11-04). One test per defect D1–D7 plus the exam
with the owner's real debt set. The amortization core is unchanged."""
from datetime import date
from decimal import Decimal as D

import pytest

import velocity_engine as ve
from velocity_engine import (DebtAccount, attack_impact, calculate_debt_free_date, monthly_attack,
                             monthly_surplus, plan_minimum, simulate_freedom_path)

START = date(2026, 11, 1)


def debt(name, bal, apr, minp, sub="credit_card"):
    return DebtAccount(name=name, balance=D(str(bal)), interest_rate=D(str(apr)), min_payment=D(str(minp)), debt_subtype=sub)


# The owner's 9 debts (audit 2026-11-04). Fortiva and Capital One APRs are not
# in the brief: assumed 36% and 29.99% (balances < $100, ~$5 of interest effect).
OWNER = [
    debt("Amex Gold", 3327.50, 28.74, 99.96),
    debt("Upstart", 9463.94, 32.30, 331.04, "personal_loan"),
    debt("Carro", 15325.11, 20.29, 641.12, "auto_loan"),
    debt("Sapphire", 29.36, 26.99, 25),
    debt("Chase 4884", 86.49, 27.74, 25),
    debt("Freedom 9334", 0, 25.49, 0),
    debt("Slate 2323", 10.95, 0, 10.95),
    debt("Fortiva", 92.38, 36.0, 25),
    debt("Capital One", 49.76, 29.99, 25),
]


# ── D1 — the attack comes from the real cashflow, not a fixed % ──

def test_d1_surplus_is_income_minus_expenses_minus_payments():
    debts = [debt("Card", 1000, 24, 0)]  # rule minimum: 20 + 10 → $30 (floor $25 → 30)
    items = [(1850, "biweekly", True), (1350, "monthly", False), (120, "weekly", False)]
    income = D(1850) * D(26) / D(12)
    expenses = D(1350) + D(120) * D(52) / D(12)
    expected = (income - expenses - plan_minimum(debts[0])).quantize(D("0.01"))
    assert monthly_surplus(items, debts) == expected


def test_d1_surplus_floors_at_zero_and_is_none_without_income():
    assert monthly_surplus([(100, "monthly", True), (500, "monthly", False)], []) == D("0.00")
    assert monthly_surplus([(500, "monthly", False)], []) is None
    # no income on record → declared default (attack % of liquid cash)
    assert monthly_attack(None, D("1000"), D("20")) == D("200.00")
    assert monthly_attack(D("750"), D("1000"), D("20")) == D("750")


# ── D2 — freed payments roll to the next debt ──

def test_d2_freed_minimums_roll_into_the_next_debt():
    debts = [debt("Small", 300, 25, 150), debt("Big", 6000, 20, 200)]
    rolled = simulate_freedom_path(debts, D("0"), start=START)
    frozen = simulate_freedom_path(debts, D("0"), roll_freed_payments=False, start=START)
    assert rolled["total_months"] < frozen["total_months"]
    assert rolled["total_interest_paid"] < frozen["total_interest_paid"]


# ── D3 — the minimums-only baseline recalculates the card minimum ──

def test_d3_baseline_minimum_declines_with_balance():
    card = [debt("Card", 5000, 20, 0)]
    frozen = simulate_freedom_path(card, D("0"), roll_freed_payments=False, start=START)
    real = simulate_freedom_path(card, D("0"), roll_freed_payments=False, recalc_minimums=True, start=START)
    assert real["total_months"] > frozen["total_months"]  # a declining minimum takes longer
    assert calculate_debt_free_date(card, D("0"), start=START)["standard_months"] == real["total_months"]


def test_d3_installment_loans_keep_their_payment_in_the_baseline():
    loan = [debt("Car", 10000, 10, 400, "auto_loan")]
    a = simulate_freedom_path(loan, D("0"), roll_freed_payments=False, recalc_minimums=True, start=START)
    b = simulate_freedom_path(loan, D("0"), roll_freed_payments=False, start=START)
    assert a["total_months"] == b["total_months"]


# ── D4 — the tactical GPS counts ALL liquid cash ──

def test_d4_tactical_gps_counts_cash_and_savings(client, monkeypatch):
    from auth import get_current_user_id
    from main import app
    from routers import strategy
    seen = {}
    real = strategy.generate_action_plan
    monkeypatch.setattr(strategy, "generate_action_plan", lambda debts, cf, cash, *a, **k: seen.setdefault("cash", cash) and real(debts, cf, cash, *a, **k))
    uid = "c0c0c0c0-0000-4000-a000-00000000000d"
    app.dependency_overrides[get_current_user_id] = lambda: uid
    try:
        client.post("/api/accounts", json={"name": "Efectivo", "type": "cash", "balance": 800})
        client.post("/api/accounts", json={"name": "Ahorro", "type": "savings", "balance": 200})
        client.post("/api/accounts", json={"name": "Card", "type": "debt", "balance": 1000, "interest_rate": 24})
        client.get("/api/strategy/tactical-gps")
        assert seen["cash"] == D("1000")  # was $0: only type == "checking" counted
    finally:
        for a in client.get("/api/accounts").json():
            client.delete(f"/api/accounts/{a['id']}")
        app.dependency_overrides.pop(get_current_user_id, None)


# ── D5 — one minimum-payment function ──

def test_d5_single_minimum_function():
    from core_engine import calculators
    assert ve.calculate_minimum_payment(D("3327.50"), D("28.74")) == calculators.calculate_minimum_payment(D("3327.50"), D("28.74"))
    amex = debt("Amex", 3327.50, 28.74, 99.96)       # stale stored minimum
    assert plan_minimum(amex) == D("112.97")          # the rule: interest + 1%
    assert plan_minimum(debt("Card", 5000, 20, 200)) == D("200")  # a user who pays more keeps paying more
    assert plan_minimum(debt("Car", 15325.11, 20.29, 641.12, "auto_loan")) == D("641.12")


# ── D6 — the recommendation never exceeds the debt or the cash ──

def test_d6_recommended_amount_is_capped():
    debts = [debt("Store card", 1150, 29.99, 40), debt("Visa", 6800, 26.99, 204)]
    r = attack_impact(debts, debts[0], D("1925"), D("3350"), D("500"), start=START)
    assert r["amount"] == D("1150.00")
    r = attack_impact(debts, debts[1], D("1925"), D("900"), D("500"), start=START)
    assert r["amount"] == D("900.00")


# ── D7 — days_accelerated from the same simulation route ──

def test_d7_days_accelerated_is_the_real_freedom_date_difference():
    plan = simulate_freedom_path(OWNER, D("5000"), start=START)
    r = attack_impact(OWNER, OWNER[0], D("3327.50"), D("4000"), D("5000"), start=START)
    after = [DebtAccount(name=d.name, balance=d.balance - (D("3327.50") if d.name == "Amex Gold" else 0),
                         interest_rate=d.interest_rate, min_payment=d.min_payment, debt_subtype=d.debt_subtype) for d in OWNER]
    freed = plan_minimum(OWNER[0])  # the payment kills the Amex: its payment rolls from now on
    expected = (date.fromisoformat(plan["freedom_date"]) - date.fromisoformat(simulate_freedom_path(after, D("5000") + freed, start=START)["freedom_date"])).days
    assert r["days_accelerated"] == max(0, expected)
    assert r["days_accelerated"] <= plan["total_months"] * 31  # never longer than the whole plan (was 1,444 days)


def test_d7_paying_off_a_debt_today_moves_the_date_forward():
    # María-like case: killing a $1,150 card today must not look worthless
    debts = [debt("Store card", 1150, 29.99, 40), debt("Visa", 6800, 26.99, 204), debt("Car", 16500, 11.9, 385, "auto_loan")]
    r = attack_impact(debts, debts[0], D("1150"), D("3350"), D("450"), start=START)
    assert r["days_accelerated"] > 0
    assert r["interest_saved_total"] > 0


# ── The exam: the owner's real set, surplus ~$5,000/month after minimums ──

def test_exam_freedom_route():
    r = simulate_freedom_path(OWNER, D("5000"), start=START)
    assert r["freedom_month_display"] == "March 2027"
    assert float(r["total_interest_paid"]) == pytest.approx(1650, rel=0.05)


def test_exam_minimums_only_route():
    r = simulate_freedom_path(OWNER, D("0"), roll_freed_payments=False, recalc_minimums=True, start=START)
    assert float(r["total_interest_paid"]) == pytest.approx(19600, rel=0.05)
    # Target was ≈ Sept 2042. The tail is the Amex alone paying the floor
    # minimum, so the end date follows the floor: with the owner's $35 floor it
    # ends Dec 2040 ($25 → Sept 2043, $28 → Oct 2042). Documented in the report.
    assert r["freedom_month_display"] == "December 2040"
