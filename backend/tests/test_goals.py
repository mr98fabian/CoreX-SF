"""Sección Metas: /api/goals CRUD + add-savings, progress from velocity_engine.goal_progress,
metas_cumplidas in /api/logros, the house goal kept out, and the 3 MCP tools pinned."""
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlmodel import Session, delete

import database
from auth import get_current_user_id
from main import app
from models import Goal, HouseGoal
from tests.test_api_tokens import A, B, bearer, clean, make_token  # noqa: F401  (clean is autouse)
from velocity_engine import goal_progress


@pytest.fixture(autouse=True)
def _no_goals():
    def wipe():
        with Session(database.engine) as s:
            s.exec(delete(Goal).where(Goal.user_id.in_([A, B])))
            s.exec(delete(HouseGoal).where(HouseGoal.user_id.in_([A, B])))
            s.commit()
    wipe()
    yield
    wipe()


def _as(user):
    app.dependency_overrides[get_current_user_id] = lambda: user


# ── Engine ─────────────────────────────────────────────────────────

def test_eta_with_pace_rounds_months_up():
    p = goal_progress(Decimal("1000"), Decimal("250"), Decimal("100"), today=date(2026, 11, 9))
    assert p["remaining"] == Decimal("750.00") and p["pct"] == Decimal("25.0")
    assert p["eta_months"] == 8 and p["eta_date"] == date(2027, 7, 9)  # ceil(750/100)
    assert p["completed"] is False


def test_no_pace_means_no_eta():
    for pace in (None, Decimal("0")):
        p = goal_progress(Decimal("1000"), Decimal("100"), pace)
        assert p["eta_months"] is None and p["eta_date"] is None


def test_completed_when_saved_reaches_target():
    p = goal_progress(Decimal("500"), Decimal("620"), Decimal("50"))
    assert p["completed"] is True and p["remaining"] == Decimal("0.00") and p["pct"] == Decimal("100.0")
    assert p["eta_months"] == 0


# ── HTTP ───────────────────────────────────────────────────────────

def test_crud_and_add_savings(client):
    _as(A)
    r = client.post("/api/goals", json={"name": "Viaje", "target_amount": 1200, "monthly_saving": 200})
    assert r.status_code == 201
    g = r.json()
    assert g["saved_amount"] == 0 and g["eta_months"] == 6 and g["eta_etiqueta"] == "estimado"

    r = client.patch(f"/api/goals/{g['id']}", json={"name": "Viaje a Cancún", "monthly_saving": None})
    assert r.json()["name"] == "Viaje a Cancún" and r.json()["eta_months"] is None

    r = client.post(f"/api/goals/{g['id']}/add-savings", json={"amount": 300.5})
    assert r.json()["saved_amount"] == 300.5
    r = client.post(f"/api/goals/{g['id']}/add-savings", json={"amount": 100})
    assert r.json()["saved_amount"] == 400.5 and r.json()["remaining"] == 799.5

    listed = client.get("/api/goals").json()["goals"]
    assert [x["name"] for x in listed] == ["Viaje a Cancún"]

    assert client.delete(f"/api/goals/{g['id']}").status_code == 200
    assert client.get("/api/goals").json()["goals"] == []


def test_add_savings_rejects_non_positive(client):
    _as(A)
    gid = client.post("/api/goals", json={"name": "Fondo", "target_amount": 500}).json()["id"]
    for amount in (0, -10):
        assert client.post(f"/api/goals/{gid}/add-savings", json={"amount": amount}).status_code == 422


def test_someone_elses_goal_is_404(client):
    _as(A)
    gid = client.post("/api/goals", json={"name": "Mía", "target_amount": 500}).json()["id"]
    _as(B)
    assert client.patch(f"/api/goals/{gid}", json={"name": "x"}).status_code == 404
    assert client.post(f"/api/goals/{gid}/add-savings", json={"amount": 5}).status_code == 404
    assert client.delete(f"/api/goals/{gid}").status_code == 404
    assert client.get("/api/goals").json()["goals"] == []


def test_the_house_goal_is_not_in_the_list(client):
    _as(A)
    client.put("/api/house-goal", json={"target_total": 20000, "home_price": 300000, "saved_amount": 1000})
    assert client.get("/api/house-goal").json()["active"] is True
    assert client.get("/api/goals").json()["goals"] == []


def test_logros_counts_completed_goals(client):
    _as(A)
    client.post("/api/goals", json={"name": "Hecha", "target_amount": 100, "saved_amount": 100})
    client.post("/api/goals", json={"name": "En curso", "target_amount": 100, "saved_amount": 20})
    item = client.get("/api/logros").json()["metas_cumplidas"]
    assert item["valor"] == 1 and "etiqueta" in item


def test_token_scopes(client):
    read = make_token(client, A, scopes=["read:dashboard"])
    assert client.get("/api/goals", headers=bearer(read)).status_code == 200
    assert client.post("/api/goals", headers=bearer(read), json={"name": "x", "target_amount": 5}).status_code == 403
    write = make_token(client, A, scopes=["write:accounts"], name="w")
    assert client.post("/api/goals", headers=bearer(write), json={"name": "x", "target_amount": 5}).status_code == 201


# ── MCP ────────────────────────────────────────────────────────────

def test_mcp_has_the_three_goal_tools():
    src = (Path(__file__).resolve().parents[2] / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
    for name, call in (("korex_goals", '"GET", "/api/goals"'),
                       ("korex_set_goal", '"/api/goals"'),
                       ("korex_add_goal_savings", "/add-savings")):
        assert f"def {name}(" in src
        body = src[src.index(f"def {name}("):src.index("@mcp.tool()", src.index(f"def {name}("))]
        assert call in body
