"""Gráfico de Inicio (2026-11-12): plan vs pagar solo el mínimo.
compare_paths runs each strategy once; calculate_debt_free_date reads from it;
GET /api/velocity/compare serves it as-is (the client computes nothing)."""
from datetime import date
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
import velocity_engine as ve
from auth import get_current_user_id
from main import app
from models import Account, CashflowItem, Subscription
from velocity_engine import DebtAccount, calculate_debt_free_date, compare_paths, simulate_freedom_path

START = date(2026, 11, 1)
U = "c0c0c0c0-c0c0-4c0c-a0c0-c0c0c0c0c0c0"
H = {"Authorization": "Bearer x"}


def debt(name, bal, apr, minp, sub="credit_card"):
    return DebtAccount(name=name, balance=D(str(bal)), interest_rate=D(str(apr)), min_payment=D(str(minp)), debt_subtype=sub)


DEBTS = [debt("Amex", 3327.50, 28.74, 99.96), debt("Upstart", 9463.94, 32.30, 331.04, "personal_loan"),
         debt("Carro", 15325.11, 20.29, 641.12, "auto_loan"), debt("Fortiva", 92.38, 36, 25)]


def test_points_are_the_simulator_timelines_month_by_month():
    c = compare_paths(DEBTS, D("400"), START)
    plan = simulate_freedom_path(DEBTS, D("400"), start=START)
    mins = simulate_freedom_path(DEBTS, D("0"), roll_freed_payments=False, recalc_minimums=True, start=START)
    assert [p["saldo"] for p in c["plan"]["puntos"][1:]] == [t["total_balance"] for t in plan["timeline"]]
    assert [p["fecha"] for p in c["plan"]["puntos"][1:]] == [t["date"] for t in plan["timeline"]]
    n = c["dominio_meses"]
    assert [p["saldo"] for p in c["minimos"]["puntos"][1:]] == [t["total_balance"] for t in mins["timeline"][:n]]
    assert len(c["plan"]["puntos"]) == plan["total_months"] + 1


def test_point_zero_is_the_sum_of_balances_today():
    c = compare_paths(DEBTS, D("400"), START)
    total = sum((d.balance for d in DEBTS), D("0"))
    assert c["deuda_hoy"] == total
    assert c["plan"]["puntos"][0] == c["minimos"]["puntos"][0] == {"mes": 0, "fecha": START.isoformat(), "saldo": float(total)}


@pytest.mark.parametrize("extra", ["0", "150", "400", "1250.55"])
def test_saving_equals_calculate_debt_free_date_to_the_cent(extra):
    c = compare_paths(DEBTS, D(extra), START)
    legacy = calculate_debt_free_date(DEBTS, D(extra), START)
    assert c["ahorro"]["intereses"] == legacy["interest_saved"]
    assert c["ahorro"]["meses"] == legacy["months_saved"]
    assert c["plan"]["fecha_libre"] == legacy["velocity_date"]
    assert c["plan"]["interes_total"] == legacy["velocity_interest"]
    # and the value is the plain difference of the two simulations
    plan = simulate_freedom_path(DEBTS, D(extra), start=START)
    mins = simulate_freedom_path(DEBTS, D("0"), roll_freed_payments=False, recalc_minimums=True, start=START)
    assert c["ahorro"]["intereses"] == max(D("0"), D(str(mins["total_interest_paid"])) - D(str(plan["total_interest_paid"]))).quantize(D("0.01"))


def test_each_strategy_runs_once(monkeypatch):
    calls = []
    real = ve._simulate_freedom_path
    monkeypatch.setattr(ve, "_simulate_freedom_path", lambda *a, **k: calls.append(a[2:4]) or real(*a, **k))
    ve._sim_cache.clear()
    compare_paths(DEBTS, D("321"), START)
    assert sorted(calls) == [(False, True), (True, False)]


def test_domain_and_cut():
    c = compare_paths(DEBTS, D("400"), START)
    assert c["dominio_meses"] == max(24, 2 * c["plan"]["meses"])
    assert c["minimos"]["cortado"] == (c["minimos"]["meses"] > c["dominio_meses"])
    assert len(c["minimos"]["puntos"]) == min(c["minimos"]["meses"], c["dominio_meses"]) + 1
    # a quick plan keeps the 24-month floor
    quick = compare_paths([debt("Card", 500, 24, 30)], D("400"), START)
    assert quick["dominio_meses"] == 24 and quick["plan"]["meses"] < 12


def test_cut_minimums_carry_their_year_and_the_simulator_cap_never_invents_a_date():
    c = compare_paths(DEBTS, D("2500"), START)
    assert c["minimos"]["cortado"] is True
    assert c["minimos"]["anio_libre"] == int(c["minimos"]["fecha_libre"][:4])
    # minimum below the interest: the bank's minimum never pays it off → cap 600
    capped = compare_paths([debt("Loan", 20000, 30, 400, "personal_loan")], D("600"), START)
    m = capped["minimos"]
    assert m["tope_simulador"] is True and m["fecha_libre"] is None and m["anio_libre"] is None
    assert m["meses"] == 600 and m["anios"] == D("50.0")
    assert capped["ahorro"]["es_minimo"] is True


def test_sin_ahorro_when_both_routes_arrive_the_same_day():
    # a single fixed loan with no extra: same payment, nothing rolls
    c = compare_paths([debt("Carro", 5000, 10, 300, "auto_loan")], D("0"), START)
    assert c["estado"] == "sin_ahorro"
    assert c["ahorro"]["meses"] == 0 and c["ahorro"]["intereses"] == D("0")
    assert c["plan"]["fecha_libre"] == c["minimos"]["fecha_libre"]


def test_sin_deudas():
    for debts in ([], [debt("Paid", 0, 20, 0)]):
        c = compare_paths(debts, D("300"), START)
        assert c["estado"] == "sin_deudas" and c["plan"] is None and c["minimos"] is None and c["deuda_hoy"] == 0


def test_label_and_contribution():
    c = compare_paths(DEBTS, D("400"), START, fuente_aporte="excedente")
    assert c["etiqueta"] == "estimado" and c["estado"] == "ok"
    assert c["plan"]["aporte_mensual"] == D("400.00") and c["plan"]["fuente_aporte"] == "excedente"
    assert c["ahorro"]["anios"] == (D(c["ahorro"]["meses"]) / 12).quantize(D("0.1"))


# ── endpoint ──

@pytest.fixture
def owner(client):
    app.dependency_overrides[get_current_user_id] = lambda: U
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Checking", type="checking", balance=D("1500")))
        for name, bal, apr, mn, sub in (("Amex", "3327.50", "28.74", "99.96", "credit_card"),
                                        ("Carro", "15325.11", "20.29", "641.12", "auto_loan")):
            s.add(Account(user_id=U, name=name, type="debt", balance=D(bal), interest_rate=D(apr), min_payment=D(mn),
                          debt_subtype=sub, interest_type="fixed" if sub == "auto_loan" else "revolving", due_day=5))
        for name, amount, inc in (("Nómina", "4200", True), ("Renta", "1700", False)):
            s.add(CashflowItem(user_id=U, name=name, amount=D(amount), frequency="monthly", is_income=inc,
                               category="income" if inc else "expense", day_of_month=1))
        s.commit()
    yield client
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def test_endpoint_matches_freedom_path(owner):
    c = owner.get("/api/velocity/compare", headers=H).json()
    path = owner.get("/api/velocity/freedom-path", headers=H).json()
    assert c["estado"] == "ok" and c["etiqueta"] == "estimado"
    assert c["plan"]["fecha_libre"] == path["freedom_date"]
    assert c["plan"]["meses"] == path["total_months"]
    assert [p["saldo"] for p in c["plan"]["puntos"][1:]] == [t["total_balance"] for t in path["timeline"]]
    assert c["plan"]["fuente_aporte"] == "excedente"
    assert float(c["deuda_hoy"]) == pytest.approx(3327.50 + 15325.11)


def test_endpoint_without_debts(client):
    app.dependency_overrides[get_current_user_id] = lambda: "c1c1c1c1-c1c1-4c1c-a1c1-c1c1c1c1c1c1"
    try:
        c = client.get("/api/velocity/compare", headers=H).json()
        assert c["estado"] == "sin_deudas" and c["plan"] is None
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
