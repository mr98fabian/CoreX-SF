"""Juez de compras: cost_in_interest is the simulator's real delta (total interest of
the impact projection − the baseline's, both from compare_paths), not the old linear
estimate (amount × APR × baseline months / 12)."""
import dataclasses
from decimal import Decimal as D

from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account
from velocity_engine import DebtAccount, calculate_purchase_time_cost

LOAN = dict(name="Préstamo", balance=D("1000"), interest_rate=D("12"), min_payment=D("500"), debt_subtype="personal_loan")


def test_hand_computed_delta():
    """1%/month, fixed $500, no extra.
    Base:   10.00 → 510 · 5.10 → 15.10 · 0.15 → paid      = $15.25
    +$200:  12.00 → 712 · 7.12 → 219.12 · 2.19 → paid     = $21.31  → Δ $6.06 (old estimate: $6.00)"""
    r = calculate_purchase_time_cost(D("200"), [DebtAccount(**LOAN)], D("0"))
    assert (r["interest_baseline"], r["interest_impact"], r["cost_in_interest"]) == (15.25, 21.31, 6.06)
    assert r["months_delayed"] == 0


def test_zero_purchase_zero_delta():
    for debts in ([DebtAccount(**LOAN)],
                  [DebtAccount(name="Visa", balance=D("4000"), interest_rate=D("24"), min_payment=D("120"), debt_subtype="credit_card"),
                   DebtAccount(name="Carro", balance=D("15000"), interest_rate=D("20.29"), min_payment=D("641.12"), debt_subtype="auto_loan")]):
        r = calculate_purchase_time_cost(D("0"), debts, D("300"))
        assert r["cost_in_interest"] == 0.0 and r["months_delayed"] == 0


def test_no_debts_zero():
    assert calculate_purchase_time_cost(D("500"), [], D("300"))["cost_in_interest"] == 0.0


def test_the_impact_clone_keeps_every_field_that_drives_the_simulation():
    """The old clone copied 5 fields and dropped debt_subtype: a fixed loan became a
    revolving card in the impact run (different minimums) and the delta lied."""
    # Measured 2026-11-13: without its subtype this mortgage simulates as a card (82 months, $43,888
    # interest) instead of 361 months / $231,677: the impact run ended 279 months earlier than the
    # baseline, so any purchase on a mortgage read as "no delay".
    casa = DebtAccount(name="Casa", balance=D("200000"), interest_rate=D("6"), min_payment=D("1199.10"),
                       debt_subtype="mortgage", closing_day=3, due_day=12)
    r = calculate_purchase_time_cost(D("0"), [casa], D("0"))
    assert r["cost_in_interest"] == 0.0 and r["debug"]["baseline_months"] == r["debug"]["impact_months"] == 361
    assert {f.name for f in dataclasses.fields(DebtAccount)} == {
        "name", "balance", "interest_rate", "min_payment", "due_day", "closing_day", "debt_subtype", "credit_limit", "is_active"}


def test_bigger_purchase_costs_more_interest():
    debts = [DebtAccount(name="Visa", balance=D("4000"), interest_rate=D("24"), min_payment=D("120"), debt_subtype="credit_card")]
    small = calculate_purchase_time_cost(D("200"), debts, D("300"))["cost_in_interest"]
    big = calculate_purchase_time_cost(D("1500"), debts, D("300"))["cost_in_interest"]
    assert 0 < small < big


U = "b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2"


def test_endpoint_returns_the_new_delta(client):
    app.dependency_overrides[get_current_user_id] = lambda: U
    try:
        with Session(database.engine) as s:
            s.add(Account(user_id=U, name="Préstamo", type="debt", balance=D("1000"), interest_rate=D("12"),
                          min_payment=D("500"), debt_subtype="personal_loan"))
            s.commit()
        body = client.post("/api/simulator/time-cost", json={"amount": 200}).json()
        # no cash on record → extra $0: exactly the hand-computed case
        assert (body["interest_baseline"], body["interest_impact"], body["cost_in_interest"]) == (15.25, 21.31, 6.06)
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
        with Session(database.engine) as s:
            for row in s.exec(select(Account).where(Account.user_id == U)).all():
                s.delete(row)
            s.commit()
