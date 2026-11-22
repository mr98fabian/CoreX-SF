"""Web billing with Stripe Managed Payments (misión 2026-11-22-integracion-stripe): checkout
session, Stripe-Signature verification, subscription lifecycle (alta, renovación, cancelación,
expiración, pago fallido), ordering/idempotency, server-side plan limits, the one plan sold
and the migration lemon → stripe. Stripe's API is mocked; no real key anywhere."""
import hashlib
import hmac
import importlib.util
import json
import pathlib
import time

import pytest
import sqlalchemy as sa
from sqlmodel import Session, select

import database
from auth import get_current_user_id, DEMO_USER_ID
from main import app
from models import Subscription
from plan_guard import plan_limit_for
from routers import subscriptions

USER = "22222222-2222-4222-a222-222222222222"
SECRET = "whsec_test_only"
PRICE = "price_test_freedom_annual"
URL = "/api/subscriptions/webhook"
BACKEND = pathlib.Path(__file__).resolve().parents[1]
T0 = 1_790_000_000  # event clock (2026-09); each test moves forward from here


@pytest.fixture(autouse=True)
def billing_env(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)
    monkeypatch.setenv("STRIPE_PRICE_FREEDOM_ANNUAL", PRICE)
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    yield
    with Session(database.engine) as s:
        for row in s.exec(select(Subscription)).all():
            s.delete(row)
        s.commit()
    app.dependency_overrides.pop(get_current_user_id, None)


def subscription(status="active", sub_id="sub_1", price=PRICE, period_end=T0 + 365 * 86400,
                 trial_end=None, cancel_at_period_end=False, cancel_at=None, user=USER):
    # basil API shape: the period lives on the subscription item
    return {"id": sub_id, "object": "subscription", "status": status, "customer": "cus_1",
            "metadata": {"user_id": user} if user else {},
            "cancel_at_period_end": cancel_at_period_end, "cancel_at": cancel_at, "trial_end": trial_end,
            "items": {"data": [{"price": {"id": price}, "current_period_end": period_end}]}}


def event(etype, obj, created=T0, eid="evt_1"):
    return {"id": eid, "object": "event", "type": etype, "created": created, "data": {"object": obj}}


def sign(body: bytes, secret=SECRET, ts=None):
    ts = int(time.time()) if ts is None else ts
    sig = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def send(client, payload, secret=SECRET, ts=None, header=None):
    body = json.dumps(payload).encode()
    return client.post(URL, content=body, headers={"Stripe-Signature": header if header is not None else sign(body, secret, ts)})


def row():
    with Session(database.engine) as s:
        return s.exec(select(Subscription).where(Subscription.user_id == USER)).first()


def status(client):
    app.dependency_overrides[get_current_user_id] = lambda: USER
    return client.get("/api/subscriptions/status").json()


# ── Signature ─────────────────────────────────────────────────

def test_valid_signature_creates_paid_plan(client):
    r = send(client, event("customer.subscription.created", subscription()))
    assert r.status_code == 200
    got = row()
    assert (got.plan, got.status, got.ls_subscription_id, got.ls_customer_id, got.store_source) == \
        ("freedom", "active", "sub_1", "cus_1", "stripe")
    assert status(client)["plan"] == "freedom" and status(client)["store_source"] == "stripe"


def test_invalid_signature_changes_nothing(client):
    assert send(client, event("customer.subscription.created", subscription()), secret="forged").status_code == 401
    assert row() is None


def test_missing_or_malformed_signature_is_rejected(client):
    for header in ("", "deadbeef", "t=abc,v1=00", "v1=00"):
        assert send(client, event("customer.subscription.created", subscription()), header=header).status_code == 401
    assert row() is None


def test_replayed_old_signature_is_rejected(client):
    old = int(time.time()) - 3600  # outside the 5 min tolerance
    assert send(client, event("customer.subscription.created", subscription()), ts=old).status_code == 401
    assert row() is None


def test_webhook_fails_closed_without_secret(client, monkeypatch):
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert send(client, event("customer.subscription.created", subscription())).status_code == 503
    assert row() is None


# ── Lifecycle ─────────────────────────────────────────────────

def test_trial_grants_access_until_trial_end(client):
    send(client, event("customer.subscription.created", subscription(status="trialing", trial_end=T0 + 30 * 86400)))
    assert (row().plan, row().status) == ("freedom", "on_trial")
    assert row().current_period_end.startswith("2026-")
    assert status(client)["plan"] == "freedom"


def test_renewal_updates_period_end(client):
    send(client, event("customer.subscription.created", subscription(period_end=T0 + 365 * 86400)))
    first = row().current_period_end
    send(client, event("customer.subscription.updated", subscription(period_end=T0 + 2 * 365 * 86400),
                       created=T0 + 365 * 86400, eid="evt_2"))
    assert row().current_period_end > first and row().status == "active"


def test_cancel_keeps_access_until_period_end_then_degrades(client):
    send(client, event("customer.subscription.created", subscription()))
    send(client, event("customer.subscription.updated",
                       subscription(cancel_at_period_end=True, period_end=4_100_000_000), created=T0 + 10, eid="evt_2"))
    assert row().status == "cancelled" and status(client)["plan"] == "freedom"  # paid period still running
    send(client, event("customer.subscription.updated",
                       subscription(cancel_at_period_end=True, period_end=1_600_000_000), created=T0 + 20, eid="evt_3"))
    assert status(client)["plan"] == "starter"  # period over → degraded


def test_deleted_subscription_degrades_to_starter(client):
    send(client, event("customer.subscription.created", subscription()))
    send(client, event("customer.subscription.deleted", subscription(status="canceled"), created=T0 + 10, eid="evt_2"))
    assert (row().plan, row().status) == ("starter", "expired")
    assert status(client)["plan"] == "starter"


def test_payment_failed_marks_past_due_then_recovers(client):
    send(client, event("customer.subscription.created", subscription()))
    # basil invoice shape: the subscription id under parent.subscription_details
    inv = {"id": "in_1", "object": "invoice", "parent": {"subscription_details": {"subscription": "sub_1"}}}
    assert send(client, event("invoice.payment_failed", inv, eid="evt_2")).status_code == 200
    assert (row().plan, row().status, row().ls_subscription_id) == ("freedom", "past_due", "sub_1")
    assert status(client)["plan"] == "freedom"  # dunning: access kept while Stripe retries
    send(client, event("invoice.paid", {"id": "in_1", "subscription": "sub_1"}, eid="evt_3"))
    assert row().status == "active"


def test_checkout_completed_reads_the_subscription_from_stripe(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    asked = []

    async def fake_fetch(sub_id):
        asked.append(sub_id)
        return subscription(status="trialing", sub_id=sub_id, trial_end=T0 + 30 * 86400, user=None)
    monkeypatch.setattr(subscriptions, "_fetch_subscription", fake_fetch)
    session_obj = {"id": "cs_1", "object": "checkout.session", "client_reference_id": USER,
                   "subscription": "sub_9", "customer": "cus_1", "metadata": {"user_id": USER}}
    assert send(client, event("checkout.session.completed", session_obj)).status_code == 200
    assert asked == ["sub_9"] and (row().plan, row().status, row().ls_subscription_id) == ("freedom", "on_trial", "sub_9")


def test_checkout_completed_without_key_asks_stripe_to_retry(client):
    session_obj = {"id": "cs_1", "client_reference_id": USER, "subscription": "sub_9"}
    assert send(client, event("checkout.session.completed", session_obj)).status_code == 500  # Stripe retries
    assert row() is None


def test_manage_link_points_to_link(client):
    send(client, event("customer.subscription.created", subscription()))
    assert row().customer_portal_url == "https://app.link.com"
    app.dependency_overrides[get_current_user_id] = lambda: USER
    assert client.post("/api/subscriptions/portal").json() == {"portal_url": "https://app.link.com"}


# ── Ordering / idempotency ───────────────────────────────────

def test_duplicate_delivery_is_harmless(client):
    e = event("customer.subscription.created", subscription())
    send(client, e)
    assert send(client, e).status_code == 200
    assert (row().plan, row().status) == ("freedom", "active")


def test_stale_event_cannot_resurrect_a_deleted_subscription(client):
    send(client, event("customer.subscription.created", subscription(), created=T0))
    send(client, event("customer.subscription.deleted", subscription(status="canceled"), created=T0 + 100, eid="evt_2"))
    r = send(client, event("customer.subscription.updated", subscription(), created=T0 + 50, eid="evt_3"))
    assert r.json()["result"] == "stale"
    assert (row().plan, row().status) == ("starter", "expired")


def test_resubscribing_replaces_the_previous_subscription(client):
    send(client, event("customer.subscription.created", subscription(sub_id="sub_1")))
    send(client, event("customer.subscription.deleted", subscription(status="canceled", sub_id="sub_1"), created=T0 + 10, eid="e2"))
    send(client, event("customer.subscription.created", subscription(sub_id="sub_2"), created=T0 + 20, eid="e3"))
    assert (row().plan, row().status, row().ls_subscription_id) == ("freedom", "active", "sub_2")
    # the old subscription's late "deleted" never clobbers the new one
    send(client, event("customer.subscription.deleted", subscription(status="canceled", sub_id="sub_1"), created=T0 + 30, eid="e4"))
    assert (row().status, row().ls_subscription_id) == ("active", "sub_2")


def test_unknown_price_never_downgrades(client):
    send(client, event("customer.subscription.created", subscription()))
    send(client, event("customer.subscription.updated", subscription(price="price_other"), created=T0 + 10, eid="e2"))
    assert row().plan == "freedom"


def test_a_stripe_end_never_touches_a_google_play_row(client):
    with Session(database.engine) as s:
        s.add(Subscription(user_id=USER, plan="freedom", status="active", store_source="google_play",
                           gp_purchase_token="gp-tok", ls_subscription_id="sub_1"))
        s.commit()
    send(client, event("customer.subscription.deleted", subscription(status="canceled"), created=T0 + 10))
    assert (row().store_source, row().status, row().plan) == ("google_play", "active", "freedom")


# ── Checkout session ─────────────────────────────────────────

@pytest.fixture
def stripe_configured(monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
    app.dependency_overrides[get_current_user_id] = lambda: USER


def checkout(client, plan="freedom", cycle="annual", **extra):
    return client.post("/api/subscriptions/checkout", json={"plan": plan, "billing_cycle": cycle, **extra},
                       headers={"Authorization": "Bearer x"})


def test_checkout_without_secret_key_is_503(client, monkeypatch):
    app.dependency_overrides[get_current_user_id] = lambda: USER
    assert checkout(client).status_code == 503


def test_annual_checkout_without_the_price_env_is_a_clean_error(client, stripe_configured, monkeypatch):
    monkeypatch.delenv("STRIPE_PRICE_FREEDOM_ANNUAL", raising=False)
    calls = []
    monkeypatch.setattr(subscriptions.httpx, "AsyncClient", lambda *a, **k: calls.append(1))
    r = checkout(client)
    assert r.status_code == 503 and "annual plan" in r.json()["detail"]
    assert calls == []  # never reached Stripe


@pytest.mark.parametrize("plan,cycle", [("freedom", "monthly"), ("velocity", "annual"), ("accelerator", "monthly"), ("starter", "annual")])
def test_retired_or_unsold_combinations_are_rejected(client, stripe_configured, plan, cycle):
    assert checkout(client, plan, cycle).status_code == 400


def test_checkout_session_is_managed_payments_annual_with_the_shown_trial(client, stripe_configured, monkeypatch):
    sent = {}

    class FakeResp:
        status_code = 200
        headers = {"content-type": "application/json"}
        def json(self):
            return {"id": "cs_test_1", "url": "https://checkout.stripe.com/c/pay/cs_test_1"}

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, data=None, headers=None, **kw):
            sent.update(url=url, data=data, headers=headers)
            return FakeResp()

    monkeypatch.setattr(subscriptions.httpx, "AsyncClient", lambda *a, **k: FakeClient())
    r = checkout(client, email="a@example.test")
    assert r.status_code == 200 and r.json() == {"checkout_url": "https://checkout.stripe.com/c/pay/cs_test_1"}
    d = sent["data"]
    assert sent["url"] == "https://api.stripe.com/v1/checkout/sessions"
    assert d["mode"] == "subscription" and d["managed_payments[enabled]"] == "true"
    assert d["line_items[0][price]"] == PRICE and d["line_items[0][quantity]"] == "1"
    assert d["client_reference_id"] == USER and d["subscription_data[metadata][user_id]"] == USER
    assert d["subscription_data[trial_period_days]"] == str(subscriptions.TRIAL_DAYS)
    assert d["customer_email"] == "a@example.test"
    assert "automatic_tax[enabled]" not in d  # not allowed with Managed Payments: Stripe handles tax
    assert d["success_url"].endswith("/dashboard/settings?tab=subscription&checkout=success")
    assert sent["headers"]["Stripe-Version"] >= "2025-03-31.basil"


def test_stripe_error_is_a_clean_502(client, stripe_configured, monkeypatch):
    class FakeResp:
        status_code = 400
        headers = {"content-type": "application/json"}
        def json(self):
            return {"error": {"type": "invalid_request_error", "code": "resource_missing", "param": "line_items[0][price]"}}

    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, *a, **kw): return FakeResp()

    monkeypatch.setattr(subscriptions.httpx, "AsyncClient", lambda *a, **k: FakeClient())
    assert checkout(client).status_code == 502


def test_price_and_trial_match_what_the_plan_card_shows():
    assert subscriptions.PLAN_COSTS == {"starter": 0, "freedom": 100}
    import re
    src = (BACKEND.parent / "frontend/src/lib/pricing.ts").read_text(encoding="utf-8")
    assert re.search(r"export const ANNUAL_PRICE = 100;", src)
    assert re.search(rf"export const TRIAL_DAYS = {subscriptions.TRIAL_DAYS};", src)


# ── Server-side limits & promo ───────────────────────────────

def test_plan_limits_come_from_the_server(client):
    with Session(database.engine) as s:
        assert plan_limit_for(s, USER) == 2  # no subscription → Starter
        assert plan_limit_for(s, DEMO_USER_ID) is None  # demo sandbox shows everything
    send(client, event("customer.subscription.created", subscription()))
    with Session(database.engine) as s:
        assert plan_limit_for(s, USER) is None  # KoreX Anual: unlimited


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


# ── Migration: one head, web rows relabelled ─────────────────

def test_one_head_and_the_stripe_migration_goes_up_and_down():
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from alembic.script import ScriptDirectory
    assert ScriptDirectory.from_config(Config(str(BACKEND / "alembic.ini"))).get_heads() == ["d2f7b3c9e4a6"]
    spec = importlib.util.spec_from_file_location("mig_stripe", next((BACKEND / "alembic" / "versions").glob("d2f7b3c9e4a6_*.py")))
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL UNIQUE, "
                             "store_source VARCHAR NOT NULL DEFAULT 'lemon')"))
        conn.execute(sa.text("INSERT INTO subscriptions (user_id, store_source) VALUES ('w', 'lemon'), ('g', 'google_play')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        rows = dict(conn.execute(sa.text("SELECT user_id, store_source FROM subscriptions")).fetchall())
        assert rows == {"w": "stripe", "g": "google_play"}
        conn.execute(sa.text("INSERT INTO subscriptions (user_id) VALUES ('n')"))
        assert conn.execute(sa.text("SELECT store_source FROM subscriptions WHERE user_id = 'n'")).scalar() == "stripe"
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        rows = dict(conn.execute(sa.text("SELECT user_id, store_source FROM subscriptions")).fetchall())
        assert rows["g"] == "google_play" and rows["w"] == mig.PREVIOUS_WEB_STORE
