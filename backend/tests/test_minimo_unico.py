"""Mínimo único (U-01 / U-02), Fase A.

Rule: nobody reads the stored min_payment except velocity_engine.plan_minimum
(and the "mínimo del banco" display). Every screen that charges a minimum
(virtual cashflow rows, cashflow projection, calendar via /api/accounts) uses
plan_minimum, capped at the balance. One calculator in the whole repo."""
import os
import re
import subprocess
import sys
from datetime import date
from decimal import Decimal as D
from pathlib import Path

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from helpers import get_cashflow_surplus, accounts_to_active_debt_objects
from main import app
from models import Account, CashflowItem, Subscription

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
O = "0e0e0e0e-0e0e-4e0e-a0e0-0e0e0e0e0e0e"
H = {"Authorization": "Bearer x"}


# ── One calculator ───────────────────────────────────────────

def test_a_single_minimum_formula_in_the_repo_and_no_root_core_engine():
    assert not (REPO / "core_engine").exists()
    hits = []
    for p in REPO.rglob("*.py"):
        rel = p.relative_to(REPO)
        if set(rel.parts) & {"venv", ".venv", "node_modules", "__pycache__", ".git", ".claude"}:
            continue
        if re.search(r"^def calculate_minimum_payment\(", p.read_text(encoding="utf-8", errors="ignore"), re.M):
            hits.append(rel.as_posix())
    # velocity_engine's is a delegating wrapper (no formula); the formula lives in backend/core_engine
    assert sorted(hits) == ["backend/core_engine/calculators.py", "backend/velocity_engine.py"]
    wrapper = (BACKEND / "velocity_engine.py").read_text(encoding="utf-8")
    body = wrapper[wrapper.index("def calculate_minimum_payment("):wrapper.index("FIXED_SUBTYPES =")]
    assert "from core_engine.calculators import calculate_minimum_payment" in body and "0.01" not in body


PROBE = ("import sys; sys.path.insert(0, {backend!r}); "
         "import core_engine.calculators as c; from decimal import Decimal as D; "
         "print(c.__file__); print(c.calculate_minimum_payment(D('100'), D('20')))")


@pytest.mark.parametrize("cwd", [BACKEND, REPO], ids=["cwd=backend", "cwd=repo-root"])
def test_both_import_routes_resolve_the_same_file_and_the_35_floor(cwd):
    out = subprocess.run([sys.executable, "-c", PROBE.format(backend=str(BACKEND))], cwd=cwd,
                         capture_output=True, text=True, check=True).stdout.split()
    assert Path(out[0]).resolve() == (BACKEND / "core_engine" / "calculators.py").resolve()
    assert out[1] == "35.00"


# ── Owner-like dataset: every screen charges plan_minimum ────

@pytest.fixture
def owner(client):
    app.dependency_overrides[get_current_user_id] = lambda: O
    with Session(database.engine) as s:
        s.add(Subscription(user_id=O, plan="accelerator", status="active"))
        s.add(Account(user_id=O, name="Cheques", type="checking", balance=D("1915.32")))
        s.add(Account(user_id=O, name="Fortiva", type="debt", balance=D("800"), interest_rate=D("36"),
                      min_payment=D("25"), debt_subtype="credit_card", due_day=14, closing_day=20))
        s.add(Account(user_id=O, name="Chase 2323", type="debt", balance=D("34.23"), interest_rate=D("24.99"),
                      min_payment=D("10.95"), debt_subtype="credit_card", due_day=18, closing_day=21))
        s.add(Account(user_id=O, name="Auto", type="debt", balance=D("15325.11"), interest_rate=D("20.29"),
                      min_payment=D("641.12"), debt_subtype="auto_loan", interest_type="fixed", due_day=11))
        s.add(CashflowItem(user_id=O, name="Nómina", amount=D("4200"), category="income", is_income=True,
                           frequency="monthly", day_of_month=1))
        s.add(CashflowItem(user_id=O, name="Renta", amount=D("1200"), category="expense", frequency="monthly", day_of_month=3))
        s.commit()
    yield client
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == O)).all():
                s.delete(row)
        s.commit()


EXPECTED = {"Fortiva": 35.0, "Chase 2323": 34.23, "Auto": 641.12}


def test_virtual_row_projection_and_calendar_field_equal_plan_minimum(owner):
    accounts = {a["name"]: a for a in owner.get("/api/accounts", headers=H).json()}
    assert {n: float(accounts[n]["plan_minimum"]) for n in EXPECTED} == EXPECTED   # what the calendar reads
    assert float(accounts["Fortiva"]["min_payment"]) == 25.0                        # stored stays as "mínimo del banco"

    virtual = {r["name"].removeprefix("Deuda: "): r["amount"] for r in owner.get("/api/cashflow", headers=H).json()
               if r.get("is_debt_virtual")}
    assert virtual == EXPECTED

    days = owner.get("/api/cashflow/projection", headers=H).json()
    charged = {}
    for d in days["days"] if isinstance(days, dict) else days:
        for ev in d.get("events", []):
            if ev.get("category") == "debt_payment":
                charged.setdefault(ev["name"].removeprefix("Deuda: "), -ev["amount"])
    assert charged == EXPECTED


def test_total_min_payments_sums_plan_minimum(owner):
    from velocity_engine import get_projections
    with Session(database.engine) as s:
        debts = accounts_to_active_debt_objects(s.exec(select(Account).where(Account.user_id == O)).all())
    assert get_projections(debts, D("1915.32"))["total_min_payments"] == round(sum(EXPECTED.values()), 2)


def test_debt_with_stored_minimum_zero_never_shows_a_50(owner):
    with Session(database.engine) as s:
        s.add(Account(user_id=O, name="Sin minimo", type="debt", balance=D("2000"), interest_rate=D("24"),
                      min_payment=D("0"), debt_subtype="credit_card", due_day=9))
        s.commit()
    rows = [r for r in owner.get("/api/cashflow", headers=H).json() if r["name"] == "Deuda: Sin minimo"]
    assert rows and rows[0]["amount"] == 60.0                 # the rule: 2000 × 2% + 1% = $60, not $50
    body = str(owner.get("/api/cashflow/projection", headers=H).json())
    assert "-50.0" not in body


def test_fixed_loan_created_with_minimum_zero_keeps_zero(owner):
    r = owner.post("/api/accounts", headers=H, json={"name": "Hipoteca", "type": "debt", "balance": 90000,
                                                     "interest_rate": 7, "min_payment": 0, "debt_subtype": "mortgage",
                                                     "interest_type": "fixed"})
    assert r.status_code == 200 and float(r.json()["min_payment"]) == 0.0


# ── Regression: surplus and freedom date must not move ───────
# Captured on main 070a927 (before Fase A) with this exact dataset.

# On 2026-11-10: surplus 2289.65, freedom 2027-04-01 (6 months), standard 2030-03-01.
# Dates are stored as month offsets from today so the test doesn't age.
BASELINE = {"surplus": "2289.65", "total_months": 6, "freedom_offset": 5, "standard_offset": 40}


def _offset(iso: str) -> int:
    t, d = date.today(), date.fromisoformat(iso)
    return (d.year - t.year) * 12 + d.month - t.month


def test_surplus_and_freedom_date_identical_to_before(owner):
    with Session(database.engine) as s:
        debts = accounts_to_active_debt_objects(s.exec(select(Account).where(Account.user_id == O)).all())
        surplus = get_cashflow_surplus(s, O, debts)
    path = owner.get("/api/velocity/freedom-path", headers=H).json()
    fc = owner.get("/api/strategy/command-center", headers=H).json()["freedom_counter"]
    now = {"surplus": str(surplus), "total_months": path["total_months"],
           "freedom_offset": _offset(path["freedom_date"]), "standard_offset": _offset(fc["standard_freedom_date"])}
    print("REGRESSION", now)
    if os.environ.get("KX_CAPTURE_BASELINE"):
        return
    assert now == BASELINE
