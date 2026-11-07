"""Modo Compra de Casa: inactive without a goal, breakdown adds up to the target,
ETA with/without pace, DTI null without income, isolation and validation."""
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, ApiTokenAudit, CashflowItem, HouseGoal
from velocity_engine import estimated_piti

A = "f0f0f0f0-f0f0-4f0f-a0f0-f0f0f0f0f0f0"
B = "f1f1f1f1-f1f1-4f1f-a1f1-f1f1f1f1f1f1"
H = {"Authorization": "Bearer x"}
FABIAN = {"target_total": 24000, "home_price": 180000, "saved_amount": 6000}


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (HouseGoal, CashflowItem, Account, ApiTokenAudit):
            for row in s.exec(select(model).where(model.user_id.in_([A, B]))).all():
                s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def test_without_goal_is_inactive(client):
    as_user(A)
    assert client.get("/api/house-goal", headers=H).json() == {"active": False}


def test_breakdown_adds_up_to_the_target(client):
    as_user(A)
    r = client.put("/api/house-goal", headers=H, json=FABIAN)
    assert r.status_code == 200, r.text
    g = r.json()
    d = g["desglose"]
    assert d["inicial"] == 6300.0 and d["cierre"] == 5400.0 and d["reserva"] == 12300.0
    assert d["inicial"] + d["cierre"] + d["reserva"] == g["target"] == 24000.0
    assert g["pct"] == 25.0 and g["missing"] == 18000.0 and d["etiqueta"] == "estimado"
    assert client.get("/api/house-goal", headers=H).json()["desglose"] == d


def test_eta_with_and_without_pace(client):
    as_user(A)
    g = client.put("/api/house-goal", headers=H, json=FABIAN).json()
    assert g["eta_months"] is None and g["eta_date"] is None and g["eta_nota"]
    g = client.put("/api/house-goal", headers=H, json={**FABIAN, "monthly_saving": 1000}).json()
    assert g["eta_months"] == 18 and g["eta_date"]
    g = client.put("/api/house-goal", headers=H, json={**FABIAN, "monthly_saving": 7000}).json()
    assert g["eta_months"] == 3  # 18000 / 7000 = 2.57 → 3 months
    g = client.put("/api/house-goal", headers=H, json={**FABIAN, "saved_amount": 24000}).json()
    assert g["eta_months"] == 0 and g["pct"] == 100.0 and g["missing"] == 0.0


def test_dti_is_null_without_income_and_estimated_with_it(client):
    as_user(A)
    g = client.put("/api/house-goal", headers=H, json=FABIAN).json()
    assert g["dti"]["valor"] is None and g["dti"]["nota"] and g["dti"]["etiqueta"] == "estimado"
    with Session(database.engine) as s:
        s.add(CashflowItem(user_id=A, name="Salario", amount=Decimal("3000"), category="income", frequency="biweekly", is_income=True))
        s.add(Account(user_id=A, name="Auto", type="debt", balance=12000, interest_rate=8, min_payment=300,
                      interest_type="fixed", debt_subtype="auto_loan", remaining_months=40))
        s.commit()
    dti = client.get("/api/house-goal", headers=H).json()["dti"]
    income = Decimal("3000") * 26 / 12
    piti = estimated_piti(Decimal("180000"), Decimal("3.5"))
    assert dti["ingreso_mensual"] == pytest.approx(float(income), abs=0.01)
    assert dti["piti"] == pytest.approx(float(piti), abs=0.01)
    assert dti["valor"] == pytest.approx(float((Decimal(str(dti["minimos_deudas"])) + piti) / income * 100), abs=0.1)
    assert "nota" not in dti and "MIP" in dti["supuestos"]


def test_piti_matches_the_stated_assumptions():
    # $173,700 loan at 7%/30y ≈ $1,155.63 P&I + (1.7% + 0.35%) × 180,000 / 12 = $307.50
    assert estimated_piti(Decimal("180000"), Decimal("3.5")).quantize(Decimal("0.01")) == Decimal("1463.13")


def test_goals_are_isolated(client):
    as_user(A)
    client.put("/api/house-goal", headers=H, json=FABIAN)
    as_user(B)
    assert client.get("/api/house-goal", headers=H).json() == {"active": False}


@pytest.mark.parametrize("bad", [{"saved_amount": -1}, {"monthly_saving": -5}, {"target_total": -100},
                                 {"down_pct": 51}, {"closing_pct": -0.5}, {"home_price": 0}])
def test_negative_or_out_of_range_is_422(client, bad):
    as_user(A)
    assert client.put("/api/house-goal", headers=H, json={**FABIAN, **bad}).status_code == 422


def test_scopes_and_audit(client):
    from tests.test_api_tokens import bearer, make_token
    assert client.get("/api/house-goal").status_code == 401
    read = make_token(client, A, scopes=["read:dashboard"])
    assert client.get("/api/house-goal", headers=bearer(read)).status_code == 200
    assert client.put("/api/house-goal", headers=bearer(read), json=FABIAN).status_code == 403
    rw = make_token(client, A, scopes=["write:accounts"])
    assert client.put("/api/house-goal", headers=bearer(rw), json=FABIAN).status_code == 200
    with Session(database.engine) as s:
        assert s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).first().summary == "Meta de compra de casa actualizada"
