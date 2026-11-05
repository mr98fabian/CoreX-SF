"""GET /api/public/plans mirrors plan_guard.PLAN_LIMITS, no auth, read-only."""
from fastapi.testclient import TestClient

import plan_guard
from main import app


def test_plans_come_from_plan_guard_without_auth():
    with TestClient(app) as c:
        r = c.get("/api/public/plans")
    assert r.status_code == 200
    got = {p["plan"]: p["debt_limit"] for p in r.json()}
    expected = {k: v for k, v in plan_guard.PLAN_LIMITS.items() if k != "freedom-dev"}
    assert got == expected
    assert got["starter"] == 2  # the free plan the site advertises


def test_plans_follow_a_change_in_plan_guard(monkeypatch):
    monkeypatch.setitem(plan_guard.PLAN_LIMITS, "velocity", 15)
    with TestClient(app) as c:
        got = {p["plan"]: p["debt_limit"] for p in c.get("/api/public/plans").json()}
    assert got["velocity"] == 15


def test_plans_is_read_only():
    with TestClient(app) as c:
        assert c.post("/api/public/plans", json={}).status_code == 405


def test_commercial_table_2026_11_04():
    """Owner decision: Gratis 2 · Velocity 15 · Accelerator and Freedom unlimited."""
    with TestClient(app) as c:
        got = {p["plan"]: p["debt_limit"] for p in c.get("/api/public/plans").json()}
    assert got == {"starter": 2, "velocity": 15, "accelerator": None, "freedom": None}
