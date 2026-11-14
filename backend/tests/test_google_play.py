"""Google Play Billing: the plan is granted ONLY after the server reads the purchase from
Google (Play Developer API mocked here), with the same row/plan Lemon writes. RTDN keeps it
current and never degrades on old or duplicate events. No config = 503."""
import base64
import importlib.util
import json
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Subscription
from plan_guard import entitlement
from routers import google_play as gp

USER = "33333333-3333-4333-a333-333333333333"
OTHER = "44444444-4444-4444-a444-444444444444"
TOKEN = "play-token-abc"
AUD = "https://api.korexf.com/api/subscriptions/google/rtdn"
BACKEND = Path(__file__).resolve().parents[1]
KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def future(days=300):
    return (datetime.now(timezone.utc) + timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def purchase(state="SUBSCRIPTION_STATE_ACTIVE", product="korex_annual", account=USER, expiry=None, ack="ACKNOWLEDGEMENT_STATE_PENDING"):
    p = {"subscriptionState": state, "acknowledgementState": ack,
         "lineItems": [{"productId": product, "expiryTime": expiry or future()}]}
    if account is not None:
        p["externalAccountIdentifiers"] = {"obfuscatedExternalAccountId": account}
    return p


class Google:
    """The Play Developer API: token → SubscriptionPurchaseV2, plus the acknowledge calls."""
    def __init__(self):
        self.tokens, self.acks = {}, []

    async def fetch(self, info, token):
        return self.tokens.get(token)

    async def ack(self, info, product, token):
        self.acks.append(token)
        return True


@pytest.fixture
def google(monkeypatch):
    g = Google()
    monkeypatch.setenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "svc@test.iam", "private_key": "unused"}))
    monkeypatch.setenv("GOOGLE_RTDN_AUDIENCE", AUD)
    monkeypatch.setattr(gp, "fetch_subscription", g.fetch)
    monkeypatch.setattr(gp, "acknowledge", g.ack)
    monkeypatch.setattr(gp, "_signing_key", lambda token: KEY.public_key())
    app.dependency_overrides[get_current_user_id] = lambda: USER
    yield g
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for row in s.exec(select(Subscription)).all():
            s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def verify(client, token=TOKEN, product="korex_annual", **extra):
    return client.post("/api/subscriptions/google/verify", json={"product_id": product, "purchase_token": token, **extra})


def row(uid=USER):
    with Session(database.engine) as s:
        return s.exec(select(Subscription).where(Subscription.user_id == uid)).first()


def plan_of(uid=USER):
    with Session(database.engine) as s:
        return entitlement(s, uid)["plan"]


def push(client, kind, token=TOKEN, at_ms=None, audience=AUD, key=KEY, issuer="https://accounts.google.com"):
    data = {"version": "1.0", "packageName": "com.korexf.app", "eventTimeMillis": str(at_ms or int(time.time() * 1000)),
            "subscriptionNotification": {"version": "1.0", "notificationType": kind, "purchaseToken": token, "subscriptionId": "korex_annual"}}
    now = int(time.time())
    bearer = jwt.encode({"iss": issuer, "aud": audience, "iat": now, "exp": now + 600, "email": "push@test.iam"}, key, algorithm="RS256")
    body = {"message": {"data": base64.b64encode(json.dumps(data).encode()).decode(), "messageId": "1"}, "subscription": "projects/x/subscriptions/y"}
    return client.post("/api/subscriptions/google/rtdn", json=body, headers={"Authorization": f"Bearer {bearer}"})


# ── verify ──────────────────────────────────────────────────────────────────────────

def test_active_purchase_grants_freedom_on_the_same_row_and_acknowledges(client, google):
    google.tokens[TOKEN] = purchase()
    r = verify(client)
    assert r.status_code == 200 and r.json()["granted"] is True and r.json()["plan"] == "freedom"
    assert r.json()["acknowledged"] is True and google.acks == [TOKEN]
    sub = row()
    assert (sub.plan, sub.status, sub.store_source, sub.gp_purchase_token) == ("freedom", "active", "google_play", TOKEN)
    assert plan_of() == "freedom"  # plan_guard reads it unchanged
    status = client.get("/api/subscriptions/status").json()
    assert status["store_source"] == "google_play" and status["plan"] == "freedom" and status["source"] == "subscription"


def test_grace_period_and_cancelled_with_time_left_still_grant(client, google):
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_IN_GRACE_PERIOD")
    assert verify(client).json()["status"] == "past_due" and plan_of() == "freedom"
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_CANCELED", expiry=future(20))
    assert verify(client).json()["status"] == "cancelled" and plan_of() == "freedom"


def test_expired_or_cancelled_past_expiry_answers_200_without_granting(client, google):
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_EXPIRED")
    r = verify(client)
    assert r.status_code == 200 and r.json()["granted"] is False and r.json()["status"] == "expired"
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_CANCELED", expiry="2020-01-01T00:00:00.000Z")
    assert verify(client).json()["granted"] is False
    assert row() is None and plan_of() == "starter" and google.acks == []


def test_wrong_product_or_unknown_token_is_400(client, google):
    google.tokens[TOKEN] = purchase(product="other_sku")
    assert verify(client).status_code == 400            # Google's line item is another product
    assert verify(client, product="other_sku").status_code == 400  # the app asks for another product
    assert verify(client, token="nobody-knows").status_code == 400
    assert verify(client, package_name="com.evil.app").status_code == 400
    assert row() is None


def test_token_bound_to_another_account_is_403(client, google):
    google.tokens[TOKEN] = purchase(account=OTHER)
    assert verify(client).status_code == 403 and row() is None
    google.tokens["t2"] = purchase(account=None)  # no obfuscated id: first verifier owns it
    assert verify(client, token="t2").status_code == 200
    as_user(OTHER)
    assert verify(client, token="t2").status_code == 403 and row(OTHER) is None


def test_reverify_is_idempotent(client, google):
    google.tokens[TOKEN] = purchase()
    verify(client)
    google.tokens[TOKEN] = purchase(ack="ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED")
    for _ in range(3):
        r = verify(client)
        assert r.status_code == 200 and r.json()["granted"] is True
    with Session(database.engine) as s:
        assert len(s.exec(select(Subscription).where(Subscription.user_id == USER)).all()) == 1
    assert row().plan == "freedom" and google.acks == [TOKEN]  # acknowledged once


def test_without_config_everything_is_503(client, google, monkeypatch):
    monkeypatch.delenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
    google.tokens[TOKEN] = purchase()
    assert verify(client).status_code == 503
    assert push(client, 2).status_code == 503
    monkeypatch.setenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "a", "private_key": "b"}))
    monkeypatch.delenv("GOOGLE_RTDN_AUDIENCE")
    assert push(client, 2).status_code == 503
    assert row() is None


# ── RTDN ────────────────────────────────────────────────────────────────────────────

def test_rtdn_rejects_bad_push_tokens(client, google):
    google.tokens[TOKEN] = purchase()
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    assert push(client, 4, key=other_key).status_code == 401
    assert push(client, 4, audience="https://evil.test").status_code == 401
    assert push(client, 4, issuer="https://evil.test").status_code == 401
    assert client.post("/api/subscriptions/google/rtdn", json={}).status_code == 401
    assert row() is None


def test_rtdn_lifecycle_renew_cancel_expire_revoke(client, google):
    google.tokens[TOKEN] = purchase()
    verify(client)
    t0 = int(time.time() * 1000) + 1000
    google.tokens[TOKEN] = purchase(expiry=future(400))
    assert push(client, 2, at_ms=t0).status_code == 200            # RENEWED
    assert row().status == "active" and plan_of() == "freedom"
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_CANCELED", expiry=future(30))
    push(client, 3, at_ms=t0 + 1000)                                # CANCELED: paid until expiry
    assert row().status == "cancelled" and plan_of() == "freedom"
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_ON_HOLD")
    push(client, 5, at_ms=t0 + 2000)                                # ON_HOLD: no access
    assert row().status == "paused" and plan_of() == "starter"
    google.tokens[TOKEN] = purchase()
    push(client, 1, at_ms=t0 + 3000)                                # RECOVERED
    assert row().status == "active" and plan_of() == "freedom"
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_EXPIRED", expiry="2020-01-01T00:00:00.000Z")
    push(client, 13, at_ms=t0 + 4000)                               # EXPIRED
    assert (row().plan, row().status) == ("starter", "expired") and plan_of() == "starter"
    google.tokens[TOKEN] = purchase()
    push(client, 1, at_ms=t0 + 5000)
    google.tokens[TOKEN] = purchase()  # Google may still say ACTIVE for a moment: REVOKED wins
    push(client, 12, at_ms=t0 + 6000)
    assert row().status == "expired" and plan_of() == "starter"


def test_rtdn_old_or_duplicate_event_never_degrades(client, google):
    google.tokens[TOKEN] = purchase()
    verify(client)
    stored = row().updated_at
    google.tokens[TOKEN] = purchase("SUBSCRIPTION_STATE_EXPIRED", expiry="2020-01-01T00:00:00.000Z")
    old = int(time.time() * 1000) - 3_600_000  # an EXPIRED from an hour before the verify
    r = push(client, 13, at_ms=old)
    assert r.json().get("duplicate") is True and row().plan == "freedom" and row().updated_at == stored
    google.tokens[TOKEN] = purchase(expiry=future(400))
    at = int(time.time() * 1000) + 5000
    push(client, 2, at_ms=at)
    after = row().updated_at
    assert push(client, 2, at_ms=at).json().get("duplicate") is True and row().updated_at == after


def test_rtdn_purchase_from_outside_the_app_flow_is_granted_by_account_id(client, google):
    google.tokens["fresh"] = purchase(account=USER)  # PURCHASED for a token the app never sent
    assert push(client, 4, token="fresh").status_code == 200
    assert row().gp_purchase_token == "fresh" and plan_of() == "freedom" and google.acks == ["fresh"]


def test_rtdn_for_an_unknown_old_token_never_downgrades_the_current_row(client, google):
    google.tokens[TOKEN] = purchase()
    verify(client)
    google.tokens["old"] = purchase("SUBSCRIPTION_STATE_EXPIRED", expiry="2020-01-01T00:00:00.000Z")
    push(client, 13, token="old")
    assert row().gp_purchase_token == TOKEN and plan_of() == "freedom"


def test_rtdn_never_touches_a_lemon_row(client, google):
    with Session(database.engine) as s:
        s.add(Subscription(user_id=USER, plan="freedom", status="active", ls_subscription_id="5001"))
        s.commit()
    google.tokens["gp"] = purchase("SUBSCRIPTION_STATE_EXPIRED", expiry="2020-01-01T00:00:00.000Z")
    push(client, 13, token="gp")
    assert row().store_source == "lemon" and row().plan == "freedom"


# ── migration ───────────────────────────────────────────────────────────────────────

def test_one_head_and_the_migration_goes_up_and_down_clean():
    heads = ScriptDirectory.from_config(Config(str(BACKEND / "alembic.ini"))).get_heads()
    assert heads == ["a3f6c8e2d1b9"]
    path = next((BACKEND / "alembic" / "versions").glob("a3f6c8e2d1b9_*.py"))
    spec = importlib.util.spec_from_file_location("mig_play", path)
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL UNIQUE, plan VARCHAR)"))
        conn.execute(sa.text("INSERT INTO subscriptions (user_id, plan) VALUES ('u1', 'freedom')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        cols = {c["name"] for c in sa.inspect(conn).get_columns("subscriptions")}
        assert {"store_source", "gp_purchase_token"} <= cols
        assert conn.execute(sa.text("SELECT store_source FROM subscriptions")).scalar() == "lemon"  # existing rows = Lemon
        conn.execute(sa.text("UPDATE subscriptions SET gp_purchase_token = 'x'"))
        with pytest.raises(sa.exc.IntegrityError):
            conn.execute(sa.text("INSERT INTO subscriptions (user_id, plan, gp_purchase_token) VALUES ('u2', 'freedom', 'x')"))
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        cols = {c["name"] for c in sa.inspect(conn).get_columns("subscriptions")}
        assert cols == {"id", "user_id", "plan"}
