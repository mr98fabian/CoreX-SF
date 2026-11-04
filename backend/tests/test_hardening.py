"""Fase 2 hardening: no dev doors for real users, no tracebacks to clients,
fail-closed Lemon Squeezy webhook."""
import hashlib
import hmac
import json

import pytest

from auth import get_current_user_id, DEMO_USER_ID
from main import app
from routers import demo, subscriptions

REAL_USER_ID = "11111111-1111-4111-a111-111111111111"
SEED_URL = "/api/dev/seed-stress-test"
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
    monkeypatch.setattr(demo, "_seed_impl", lambda uid: called.append(uid))
    as_user(REAL_USER_ID)
    assert client.post(SEED_URL).status_code == 404
    assert called == []  # the user's data was never wiped


def test_seed_still_works_for_demo_user_in_production(client, as_user, monkeypatch):
    monkeypatch.setattr(demo, "IS_DEV", False)
    monkeypatch.setattr(demo, "_seed_impl", lambda uid: {"status": "ok"})
    as_user(DEMO_USER_ID)
    assert client.post(SEED_URL).status_code == 200


# ── 2. No tracebacks or internals in error responses ─────────

def test_seed_failure_returns_generic_error(client, as_user, monkeypatch):
    def boom(uid):
        raise RuntimeError('connection to "aws-0-pooler.supabase.com" failed at /app/backend/database.py')
    monkeypatch.setattr(demo, "IS_DEV", False)
    monkeypatch.setattr(demo, "_seed_impl", boom)
    as_user(DEMO_USER_ID)
    r = client.post(SEED_URL)
    assert r.status_code == 500
    for leak in ("Traceback", "pooler", "supabase", "/app/", ".py"):
        assert leak not in r.text


# ── 3. Webhook fails closed ──────────────────────────────────

BODY = json.dumps({"meta": {"event_name": "subscription_created",
                            "custom_data": {"user_id": REAL_USER_ID}},
                   "data": {"id": "1", "attributes": {"variant_id": "1"}}}).encode()


def test_webhook_rejected_when_secret_missing(client, monkeypatch):
    monkeypatch.setattr(subscriptions, "LS_WEBHOOK_SECRET", "")
    r = client.post(WEBHOOK_URL, content=BODY, headers={"X-Signature": "anything"})
    assert r.status_code == 503


def test_webhook_rejected_with_invalid_signature(client, monkeypatch):
    monkeypatch.setattr(subscriptions, "LS_WEBHOOK_SECRET", "test-secret")
    r = client.post(WEBHOOK_URL, content=BODY, headers={"X-Signature": "deadbeef"})
    assert r.status_code == 401


def test_webhook_rejected_without_signature(client, monkeypatch):
    monkeypatch.setattr(subscriptions, "LS_WEBHOOK_SECRET", "test-secret")
    assert client.post(WEBHOOK_URL, content=BODY).status_code == 401


def test_webhook_accepted_with_valid_signature(client, monkeypatch):
    monkeypatch.setattr(subscriptions, "LS_WEBHOOK_SECRET", "test-secret")
    sig = hmac.new(b"test-secret", BODY, hashlib.sha256).hexdigest()
    r = client.post(WEBHOOK_URL, content=BODY, headers={"X-Signature": sig})
    assert r.status_code == 200
