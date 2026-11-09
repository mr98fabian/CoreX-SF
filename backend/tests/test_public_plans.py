"""GET /api/public/plans mirrors plan_guard.PLAN_LIMITS, no auth, read-only."""
from fastapi.testclient import TestClient

import plan_guard
from main import app


def test_plans_come_from_plan_guard_without_auth():
    with TestClient(app) as c:
        r = c.get("/api/public/plans")
    assert r.status_code == 200
    got = {p["plan"]: p["debt_limit"] for p in r.json()}
    expected = {k: v for k, v in plan_guard.PLAN_LIMITS.items() if k not in plan_guard.HIDDEN_PLANS}
    assert got == expected
    assert got["starter"] == 2  # the free plan the site advertises


def test_plans_follow_a_change_in_plan_guard(monkeypatch):
    monkeypatch.setitem(plan_guard.PLAN_LIMITS, "starter", 3)
    with TestClient(app) as c:
        got = {p["plan"]: p["debt_limit"] for p in c.get("/api/public/plans").json()}
    assert got["starter"] == 3


def test_plans_is_read_only():
    with TestClient(app) as c:
        assert c.post("/api/public/plans", json={}).status_code == 405


def test_commercial_table_two_plans():
    """Owner decision (Precios reales): only Gratis (2 debts) and the paid annual plan (freedom, unlimited)."""
    with TestClient(app) as c:
        got = {p["plan"]: p["debt_limit"] for p in c.get("/api/public/plans").json()}
    assert got == {"starter": 2, "freedom": None}


def test_retired_and_internal_plans_are_hidden_but_keep_their_keys():
    assert {"velocity", "accelerator", "founder", "freedom-dev"} <= plan_guard.HIDDEN_PLANS
    for key in ("velocity", "accelerator"):  # the locks still consume them by key
        assert key in plan_guard.PLAN_LIMITS and key in plan_guard.PLAN_RANK
