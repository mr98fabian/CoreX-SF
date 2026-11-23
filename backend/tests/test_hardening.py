"""Fase 2 hardening: no dev doors for real users, no tracebacks to clients,
fail-closed Stripe webhook."""
import hashlib
import hmac
import json
import time

import pytest

from auth import get_current_user_id, DEMO_USER_ID
from main import app
from routers import demo, subscriptions

REAL_USER_ID = "11111111-1111-4111-a111-111111111111"
SEED_URL = "/api/demo/seed"
STRESS_URL = "/api/dev/seed-stress-test"
WEBHOOK_URL = "/api/subscriptions/webhook"


@pytest.fixture
def as_user():
    def _set(uid):
        app.dependency_overrides[get_current_user_id] = lambda: uid
    yield _set
    app.dependency_overrides.pop(get_current_user_id, None)


# ── 1. Dev seed closed outside development ───────────────────

def test_seed_is_404_for_real_users_in_production(client, as_user, monkeypatch):
    monkeypatch.setattr(demo, "IS_DEV", False)
    called = []
    monkeypatch.setattr(demo, "_seed_impl", lambda uid, ds: called.append(uid))
    as_user(REAL_USER_ID)
    assert client.post(SEED_URL).status_code == 404
    assert called == []  # the user's data was never wiped


def test_seed_still_works_for_demo_user_in_production(client, as_user, monkeypatch):
    monkeypatch.setattr(demo, "IS_DEV", False)
    monkeypatch.setattr(demo, "_seed_impl", lambda uid, ds: {"status": "ok"})
    as_user(DEMO_USER_ID)
    assert client.post(SEED_URL).status_code == 200


def test_stress_seed_is_404_in_production_even_for_demo_user(client, as_user, monkeypatch):
    monkeypatch.setattr(demo, "IS_DEV", False)
    as_user(DEMO_USER_ID)
    assert client.post(STRESS_URL).status_code == 404


# ── 2. No tracebacks or internals in error responses ─────────

def test_seed_failure_returns_generic_error(client, as_user, monkeypatch):
    def boom(uid, ds):
        raise RuntimeError('connection to "aws-0-pooler.supabase.com" failed at /app/backend/database.py')
    monkeypatch.setattr(demo, "IS_DEV", False)
    monkeypatch.setattr(demo, "_seed_impl", boom)
    as_user(DEMO_USER_ID)
    r = client.post(SEED_URL)
    assert r.status_code == 500
    for leak in ("Traceback", "pooler", "supabase", "/app/", ".py"):
        assert leak not in r.text


# ── 3. Webhook fails closed ──────────────────────────────────

BODY = json.dumps({"id": "evt_1", "type": "customer.subscription.created", "created": 1790000000,
                   "data": {"object": {"id": "sub_1", "status": "active", "metadata": {"user_id": REAL_USER_ID},
                                       "items": {"data": [{"price": {"id": "price_x"}}]}}}}).encode()


def _sig(secret: bytes, body: bytes) -> str:
    ts = int(time.time())
    return f"t={ts},v1=" + hmac.new(secret, f"{ts}.".encode() + body, hashlib.sha256).hexdigest()


def test_webhook_rejected_when_secret_missing(client, monkeypatch):
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    r = client.post(WEBHOOK_URL, content=BODY, headers={"Stripe-Signature": "t=1,v1=anything"})
    assert r.status_code == 503


def test_webhook_rejected_with_invalid_signature(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "test-secret")
    r = client.post(WEBHOOK_URL, content=BODY, headers={"Stripe-Signature": "t=1,v1=deadbeef"})
    assert r.status_code == 401


def test_webhook_rejected_without_signature(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "test-secret")
    assert client.post(WEBHOOK_URL, content=BODY).status_code == 401


def test_webhook_accepted_with_valid_signature(client, monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "test-secret")
    r = client.post(WEBHOOK_URL, content=BODY, headers={"Stripe-Signature": _sig(b"test-secret", BODY)})
    assert r.status_code == 200
