"""Fase 4 billing: Lemon Squeezy webhook lifecycle, idempotency, legacy
variants, server-side plan limits and the dev-only promo code."""
import hashlib
import hmac
import json

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id, DEMO_USER_ID
from main import app
from models import Subscription
from plan_guard import plan_limit_for
from routers import subscriptions

USER = "22222222-2222-4222-a222-222222222222"
SECRET = "test-secret"
URL = "/api/subscriptions/webhook"


@pytest.fixture(autouse=True)
def billing_env(monkeypatch):
    monkeypatch.setattr(subscriptions, "LS_WEBHOOK_SECRET", SECRET)
    monkeypatch.setattr(subscriptions, "PLAN_VARIANTS", {
        "velocity": {"monthly": "101", "annual": "102"},
        "accelerator": {"monthly": "201", "annual": "202"},
        "freedom": {"monthly": "301", "annual": "302"},
    })
    monkeypatch.setattr(subscriptions, "LEGACY_VARIANTS", {"9001": "accelerator"})
    yield
    with Session(database.engine) as s:
        for row in s.exec(select(Subscription)).all():
            s.delete(row)
        s.commit()
    app.dependency_overrides.pop(get_current_user_id, None)


def sub_event(event, variant="101", status="active", updated="2026-11-03T10:00:00Z",
              renews="2026-12-03T10:00:00Z", ends=None, sub_id="5001"):
    return {
        "meta": {"event_name": event, "custom_data": {"user_id": USER}},
        "data": {"type": "subscriptions", "id": sub_id, "attributes": {
            "variant_id": int(variant), "status": status, "customer_id": 77,
            "renews_at": renews, "ends_at": ends, "updated_at": updated,
            "urls": {"customer_portal": "https://example.test/portal",
                     "update_payment_method": "https://example.test/pay"},
        }},
    }


def invoice_event(event, sub_id="5001"):
    return {
        "meta": {"event_name": event, "custom_data": {"user_id": USER}},
        "data": {"type": "subscription-invoices", "id": "inv-1",
                 "attributes": {"subscription_id": int(sub_id), "status": "failed"}},
    }


def send(client, payload, secret=SECRET):
    body = json.dumps(payload).encode()
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post(URL, content=body, headers={"X-Signature": sig})


def row():
    with Session(database.engine) as s:
        return s.exec(select(Subscription).where(Subscription.user_id == USER)).first()


def status(client):
    app.dependency_overrides[get_current_user_id] = lambda: USER
    return client.get("/api/subscriptions/status").json()


# ── Lifecycle ─────────────────────────────────────────────────

def test_valid_signature_creates_paid_plan(client):
    assert send(client, sub_event("subscription_created")).status_code == 200
    r = row()
    assert (r.plan, r.status, r.ls_subscription_id) == ("velocity", "active", "5001")
    assert status(client)["plan"] == "velocity"


def test_invalid_signature_changes_nothing(client):
    assert send(client, sub_event("subscription_created"), secret="forged").status_code == 401
    assert row() is None


def test_cancelled_keeps_access_until_period_end_then_degrades(client):
    send(client, sub_event("subscription_created"))
    send(client, sub_event("subscription_cancelled", status="cancelled",
                           updated="2026-11-04T10:00:00Z", ends="2999-01-01T00:00:00Z"))
    assert status(client)["plan"] == "velocity"  # paid period still running
    send(client, sub_event("subscription_updated", status="cancelled",
                           updated="2026-11-05T10:00:00Z", ends="2020-01-01T00:00:00Z"))
    assert status(client)["plan"] == "starter"  # period over → degraded


def test_expired_degrades_to_starter(client):
    send(client, sub_event("subscription_created"))
    send(client, sub_event("subscription_expired", status="expired", updated="2026-11-06T10:00:00Z"))
    assert (row().plan, row().status) == ("starter", "expired")
    assert status(client)["plan"] == "starter"


def test_payment_failed_marks_past_due_without_touching_plan(client):
    send(client, sub_event("subscription_created"))
    assert send(client, invoice_event("subscription_payment_failed")).status_code == 200
    r = row()
    assert (r.plan, r.status, r.ls_subscription_id) == ("velocity", "past_due", "5001")
    send(client, invoice_event("subscription_payment_recovered"))
    assert row().status == "active"


# ── Idempotency / ordering ───────────────────────────────────

def test_duplicate_created_is_ignored(client):
    send(client, sub_event("subscription_created"))
    r = send(client, sub_event("subscription_created"))
    assert r.json().get("duplicate") is True
    assert row().plan == "velocity"


def test_stale_event_cannot_resurrect_cancelled_subscription(client):
    send(client, sub_event("subscription_created", updated="2026-11-03T10:00:00Z"))
    send(client, sub_event("subscription_expired", status="expired", updated="2026-11-08T10:00:00Z"))
    # A delayed retry of an older "active" update arrives last
    r = send(client, sub_event("subscription_updated", status="active", updated="2026-11-04T10:00:00Z"))
    assert r.json().get("duplicate") is True
    assert (row().plan, row().status) == ("starter", "expired")


def test_resubscribing_replaces_the_previous_subscription(client):
    send(client, sub_event("subscription_created", sub_id="5001"))
    send(client, sub_event("subscription_expired", status="expired", updated="2026-11-08T10:00:00Z"))
    send(client, sub_event("subscription_created", variant="301", sub_id="5002", updated="2026-11-09T10:00:00Z"))
    assert (row().plan, row().status, row().ls_subscription_id) == ("freedom", "active", "5002")


def test_renewal_updates_period_end(client):
    send(client, sub_event("subscription_created"))
    send(client, sub_event("subscription_updated", updated="2026-12-03T10:00:01Z", renews="2027-01-03T10:00:00Z"))
    assert row().current_period_end == "2027-01-03T10:00:00Z"


# ── Variant mapping ──────────────────────────────────────────

def test_legacy_variant_keeps_its_plan(client):
    send(client, sub_event("subscription_created", variant="9001"))
    assert row().plan == "accelerator"


def test_unknown_variant_never_downgrades(client):
    send(client, sub_event("subscription_created", variant="201"))
    send(client, sub_event("subscription_updated", variant="555", updated="2026-11-04T10:00:00Z"))
    assert row().plan == "accelerator"


# ── Server-side limits & promo ───────────────────────────────

def test_plan_limits_come_from_the_server(client):
    with Session(database.engine) as s:
        assert plan_limit_for(s, USER) == 2  # no subscription → Starter
        assert plan_limit_for(s, DEMO_USER_ID) is None  # demo sandbox shows everything
    send(client, sub_event("subscription_created", variant="201"))
    with Session(database.engine) as s:
        assert plan_limit_for(s, USER) is None  # Accelerator: unlimited


def test_client_plan_limit_param_is_ignored(client, monkeypatch):
    import routers.dashboard as dash
    seen = []
    real = dash.filter_active_debt_accounts
    monkeypatch.setattr(dash, "filter_active_debt_accounts", lambda acc, lim=None: seen.append(lim) or real(acc, lim))
    app.dependency_overrides[get_current_user_id] = lambda: USER
    client.get("/api/dashboard?plan_limit=999")
    assert seen and all(lim == 2 for lim in seen)


def test_dev_promo_code_no_longer_exists_anywhere(client):
    """apply-promo and its hard-coded KOREX-DEV-UNLIMITED were replaced by /api/codes/redeem."""
    app.dependency_overrides[get_current_user_id] = lambda: USER
    r = client.post("/api/subscriptions/apply-promo", json={"code": "KOREX-DEV-UNLIMITED"})
    assert r.status_code in (404, 405) and row() is None
