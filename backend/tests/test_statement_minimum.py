"""Mínimo del estado (Fase B, safety version). The daily mission treats the current
statement's minimum as a per-card obligation: reserve = max(engine minimum, statement
minimum). Gate (owner's decision 2026-11-13): NEVER set aside less than the statement
minimum; the plan projection does not change. The issuer-formula optimisation was
rejected by its own measurement gate and is not here."""
from datetime import date
from decimal import Decimal as D
from itertools import product

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import build_daily_mission
from main import app
from models import Account, CashflowItem, CutHistory
from velocity_engine import (DebtAccount, FIXED_SUBTYPES, MissionAccount, compare_paths, get_daily_mission,
                             mission_obligations, plan_minimum, statement_minimum_due)

TODAY = date(2026, 11, 10)
INCOME = [{"name": "Nómina", "amount": D("3000"), "dates": {date(2026, 11, 28)}}]


def card(bal="1000", mn="35", closing=None, due=None, reported=None, cut=None, paid="0", smin=None, sdue=None, name="Chase"):
    return MissionAccount(name=name, balance=D(bal), interest_rate=D("27.74"), min_payment=D(mn), debt_subtype="credit_card",
                          closing_day=closing, due_day=due, last_cut_date=cut,
                          last_cut_reported=D(reported) if reported is not None else None, paid_since_cut=D(paid),
                          statement_minimum=D(smin) if smin is not None else None, statement_due=sdue)


def reserved_for(acc, today=TODAY):
    return sum((o["monto"] for o in mission_obligations([acc], today) if o["cuenta"] == acc.name), D("0"))


# ── (1) Gate: with a statement loaded, the mission never reserves below its minimum ──

SCENARIOS = [
    # no cut/due days on the account: the minimum is its own obligation
    dict(smin="40", sdue=date(2026, 11, 20)),
    # statement state (a): pending statement already ≥ minimum
    dict(closing=21, due=15, cut=date(2026, 10, 21), reported="300", smin="40", sdue=date(2026, 11, 15)),
    # statement state (a) after a partial payment
    dict(closing=21, due=15, cut=date(2026, 10, 21), reported="300", paid="20", smin="40", sdue=date(2026, 11, 15)),
    # minimum due before the next cut, both in the window: minimum + rest of the balance
    dict(closing=25, cut=date(2026, 10, 25), smin="40", sdue=date(2026, 11, 18)),
    # minimum bigger than the balance: capped at the balance
    dict(bal="30", smin="40", sdue=date(2026, 11, 20)),
    # engine minimum bigger than the statement's: the bigger one
    dict(mn="120", smin="40", sdue=date(2026, 11, 20)),
]


@pytest.mark.parametrize("kw", SCENARIOS)
def test_the_mission_never_sets_aside_less_than_the_statement_minimum(kw):
    acc = card(**kw)
    owed = statement_minimum_due(acc, TODAY)
    assert owed > 0
    assert reserved_for(acc) >= owed
    # and never more than the whole balance (no double count with the cut)
    assert reserved_for(acc) <= acc.balance


def test_grid_gate_holds_for_every_combination():
    for bal, mn, smin, paid, closing in product(("25", "300", "5000"), ("0", "35", "150"), ("25", "40", "200"),
                                                ("0", "20", "60"), (None, 25)):
        acc = card(bal=bal, mn=mn, smin=smin, paid=paid, closing=closing, cut=date(2026, 10, 25),
                   sdue=date(2026, 11, 18))
        assert reserved_for(acc) >= statement_minimum_due(acc, TODAY), (bal, mn, smin, paid, closing)


def test_the_minimum_obligation_reads_and_the_reserve_includes_it():
    acc = card(smin="40", sdue=date(2026, 11, 20))
    [o] = mission_obligations([acc], TODAY)
    assert (o["tipo"], o["monto"], o["fecha_evento"]) == ("minimo", D("40"), date(2026, 11, 20))
    assert o["copy"] == "Paga el mínimo de la Chase ($40.00) antes del 20 de noviembre, según tu estado de cuenta"
    r = get_daily_mission([acc], D("2000"), D("0"), INCOME, [], today=TODAY)
    assert r["reserva"] >= D("40")


def test_minimum_and_cut_in_the_same_window_never_double_count():
    acc = card(closing=25, cut=date(2026, 10, 25), smin="40", sdue=date(2026, 11, 18))
    obs = {o["tipo"]: o["monto"] for o in mission_obligations([acc], TODAY)}
    assert obs == {"minimo": D("40"), "corte": D("960")}


def test_paid_minimum_releases_the_reserve():
    acc = card(smin="40", sdue=date(2026, 11, 20), paid="40", cut=date(2026, 10, 25))
    assert statement_minimum_due(acc, TODAY) == 0
    assert mission_obligations([acc], TODAY) == []


# ── (2) Without a statement minimum, the mission is exactly what it was ──

BASES = [dict(), dict(closing=21, due=5), dict(closing=21, due=15, cut=date(2026, 10, 21), reported="300"),
         dict(closing=21, due=15, cut=date(2026, 10, 21), reported="300", paid="300"), dict(closing=12), dict(due=20)]


@pytest.mark.parametrize("kw", BASES)
def test_no_statement_minimum_changes_nothing(kw):
    plain = card(**kw)
    # no data, or a statement whose due date already passed: same obligations and same mission
    for other in (card(**kw, smin=None, sdue=None), card(**kw, smin="40", sdue=date(2026, 11, 1))):
        assert mission_obligations([other], TODAY) == mission_obligations([plain], TODAY)
        a = get_daily_mission([plain], D("2000"), D("500"), INCOME, [], today=TODAY)
        b = get_daily_mission([other], D("2000"), D("500"), INCOME, [], today=TODAY)
        assert a == b


# ── (3) Measurement on the owner's debts (audit 2026-11-04) ──

def debt(n, b, a, m, s="credit_card"):
    return DebtAccount(name=n, balance=D(str(b)), interest_rate=D(str(a)), min_payment=D(str(m)), debt_subtype=s)


OWNER = [debt("Amex Gold", 3327.50, 28.74, 99.96), debt("Upstart", 9463.94, 32.30, 331.04, "personal_loan"),
         debt("Carro", 15325.11, 20.29, 641.12, "auto_loan"), debt("Sapphire", 29.36, 26.99, 25),
         debt("Chase 4884", 86.49, 27.74, 25), debt("Slate 2323", 10.95, 0, 10.95), debt("Fortiva", 92.38, 36.0, 25),
         debt("Capital One", 49.76, 29.99, 25)]
# Statement minimums by issuer: BELIEVED (published cardholder terms), not read from statements
FLOOR = {"Amex Gold": 40, "Sapphire": 40, "Chase 4884": 40, "Slate 2323": 40, "Capital One": 25, "Fortiva": 25}


def test_plan_projection_is_identical_with_or_without_statements():
    """The projection (Plan, chart, freedom date) never reads statements: Δ interest $0.00, same date."""
    for extra in (300, 600, 1000, 1500):
        before = compare_paths(OWNER, D(extra), start=TODAY)
        after = compare_paths(OWNER, D(extra), start=TODAY)
        assert before["plan"]["interes_total"] == after["plan"]["interes_total"]
        assert before["plan"]["fecha_libre"] == after["plan"]["fecha_libre"]


def _replica(min_of, budget):
    """Monthly replica (Fable's U-13/Fase B harness): same total budget, avalanche with the rest."""
    ds = [debt(d.name, d.balance, d.interest_rate, d.min_payment, d.debt_subtype) for d in OWNER]
    total, months = D("0"), 0
    while any(d.balance > 0 for d in ds) and months < 600:
        months += 1
        mins = {d.name: min_of(d) for d in ds if d.balance > 0}
        for d in ds:
            if d.balance > 0:
                i = (d.balance * d.monthly_rate).quantize(D("0.01"))
                d.balance += i
                total += i
        ammo = D(budget)
        for d in ds:
            if d.name in mins:
                p = min(d.balance, mins[d.name])
                d.balance -= p
                ammo -= p
        for d in sorted([d for d in ds if d.balance > 0], key=lambda d: d.interest_rate, reverse=True):
            if ammo <= 0:
                break
            p = min(ammo, d.balance)
            d.balance -= p
            ammo -= p
    return months, total


def _engine_min(d):
    return min(d.balance, plan_minimum(d))


def _statement_min(d):
    if d.debt_subtype in FIXED_SUBTYPES:
        return d.min_payment
    rule = (d.balance * d.monthly_rate + d.balance * D("0.01")).quantize(D("0.01"))
    return min(d.balance, max(D(FLOOR[d.name]), rule))


@pytest.mark.parametrize("extra", [300, 600, 1000, 1500])
def test_replica_paying_max_engine_statement_keeps_the_date_and_costs_cents(extra):
    """Measured 2026-11-13: +$0.06/+$0.07/+$0.07/+$0.06 — the bank's real $40 Chase floor vs the engine's $35.
    Owner's gate (2026-11-13): safety, not interest; bound kept as a regression alarm."""
    budget = sum(_engine_min(d) for d in OWNER) + extra
    m0, i0 = _replica(_engine_min, budget)
    m1, i1 = _replica(lambda d: max(_engine_min(d), _statement_min(d)), budget)
    assert m1 == m0
    assert D("0") <= i1 - i0 <= D("0.10")


# ── HTTP: the statement minimum is stored with the cut and reaches the mission ──

U = "efefefef-efef-4fef-afef-efefefefefef"


@pytest.fixture
def owner_db():
    app.dependency_overrides[get_current_user_id] = lambda: U
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CutHistory, CashflowItem, Account):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def test_cut_stores_the_statement_minimum_and_the_mission_reserves_it(client, owner_db):
    with Session(database.engine) as s:
        a = Account(user_id=U, name="Chase 4884", type="debt", balance=86.49, interest_rate=27.74, min_payment=25,
                    debt_subtype="credit_card")
        s.add(a)
        s.commit()
        s.refresh(a)
        acc_id = a.id
    H = {"Authorization": "Bearer x"}
    r = client.post("/api/cuts", headers=H, json={"account_id": acc_id, "cut_date": "2026-11-01", "reported_balance": 86.49,
                                                  "statement_minimum": 40, "statement_due_date": "2026-11-20"})
    assert r.status_code == 200
    assert (r.json()["statement_minimum"], r.json()["statement_due_date"]) == (40.0, "2026-11-20")
    # re-recording without the fields keeps them
    r = client.post("/api/cuts", headers=H, json={"account_id": acc_id, "cut_date": "2026-11-01", "reported_balance": 86.49})
    assert (r.json()["statement_minimum"], r.json()["statement_due_date"]) == (40.0, "2026-11-20")
    with Session(database.engine) as s:
        accounts = s.exec(select(Account).where(Account.user_id == U)).all()
        result = build_daily_mission(s, U, accounts, today=TODAY)
    owed = [o for o in result["obligaciones"] if o["cuenta"] == "Chase 4884"]
    assert sum(o["monto"] for o in owed) >= D("40")
    assert owed[0]["tipo"] == "minimo"
