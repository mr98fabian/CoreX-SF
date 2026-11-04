"""Fase 5: personal API tokens — hashing, isolation between users, scopes,
revocation, audit of writes, rate limit and default-deny."""
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import api_tokens
import database
from auth import get_current_user_id, DEMO_USER_ID
from main import app
from models import Account, ApiToken, ApiTokenAudit, Subscription, Transaction

A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"
B = "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb"
ALL = list(api_tokens.SCOPES)


@pytest.fixture(autouse=True)
def clean():
    api_tokens._hits.clear()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (ApiTokenAudit, ApiToken, Transaction, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id.in_([A, B]))).all():
                s.delete(row)
        s.commit()


def login(user):
    app.dependency_overrides[get_current_user_id] = lambda: user


def set_plan(user, plan="velocity", status="active"):
    """AI tokens are a paid feature (Fase 6 addendum 2)."""
    with Session(database.engine) as s:
        sub = s.exec(select(Subscription).where(Subscription.user_id == user)).first() or Subscription(user_id=user)
        sub.plan, sub.status = plan, status
        s.add(sub); s.commit()


def make_token(client, user, scopes=ALL, name="agent"):
    set_plan(user)
    login(user)
    r = client.post("/api/tokens", json={"name": name, "scopes": scopes})
    assert r.status_code == 200, r.text
    app.dependency_overrides.pop(get_current_user_id, None)
    return r.json()


def bearer(tok):
    return {"Authorization": f"Bearer {tok['token']}"}


def add_account(user, name, balance="1000.00"):
    with Session(database.engine) as s:
        acc = Account(user_id=user, name=name, type="debt", balance=Decimal(balance),
                      interest_rate=Decimal("20"), min_payment=Decimal("50"))
        s.add(acc); s.commit(); s.refresh(acc)
        return acc.id


# ── Storage ──────────────────────────────────────────────────

def test_plain_token_shown_once_and_only_hash_stored(client):
    tok = make_token(client, A)
    assert tok["token"].startswith("kx_") and len(tok["token"]) > 40
    with Session(database.engine) as s:
        row = s.get(ApiToken, tok["id"])
        assert row.token_hash == api_tokens.hash_token(tok["token"])
        assert tok["token"] not in str(row.model_dump())
    login(A)
    listed = client.get("/api/tokens").json()
    assert listed and all("token" not in t for t in listed)


# ── Isolation ────────────────────────────────────────────────

def test_token_only_sees_its_owner_accounts(client):
    add_account(A, "A card"); add_account(B, "B card")
    names = [a["name"] for a in client.get("/api/accounts", headers=bearer(make_token(client, A))).json()]
    assert names == ["A card"]


def test_token_cannot_write_to_another_users_account(client):
    b_acc = add_account(B, "B card", "1000.00")
    tok = make_token(client, A)
    r = client.post("/api/transactions/manual", headers=bearer(tok),
                    json={"account_id": b_acc, "amount": 100, "description": "x", "category": "payment", "date": "2026-11-03"})
    assert r.status_code == 404
    with Session(database.engine) as s:
        assert s.get(Account, b_acc).balance == Decimal("1000.00")


def test_created_account_belongs_to_token_owner_even_if_body_says_otherwise(client):
    tok = make_token(client, A)
    r = client.post("/api/accounts", headers=bearer(tok),
                    json={"name": "New", "type": "debt", "balance": 500, "interest_rate": 10, "user_id": B})
    assert r.status_code == 200 and r.json()["user_id"] == A


# ── Scopes / default deny / revocation ───────────────────────

def test_missing_scope_is_403(client):
    tok = make_token(client, A, scopes=["read:accounts"])
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 200
    assert client.get("/api/dashboard", headers=bearer(tok)).status_code == 403
    assert client.post("/api/accounts", headers=bearer(tok), json={"name": "x", "type": "debt"}).status_code == 403


def test_tokens_rejected_on_endpoints_that_did_not_opt_in(client):
    tok = make_token(client, A)
    assert client.get("/api/subscriptions/status", headers=bearer(tok)).status_code == 403
    assert client.post("/api/tokens", headers=bearer(tok), json={"name": "x", "scopes": ALL}).status_code == 403


def test_revoked_token_is_401(client):
    tok = make_token(client, A)
    login(A)
    assert client.delete(f"/api/tokens/{tok['id']}").json()["active"] is False
    app.dependency_overrides.pop(get_current_user_id, None)
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 401
    assert client.get("/api/accounts", headers={"Authorization": "Bearer kx_nope"}).status_code == 401


def test_user_cannot_revoke_someone_elses_token(client):
    tok = make_token(client, A)
    login(B)
    assert client.delete(f"/api/tokens/{tok['id']}").status_code == 404


def test_demo_user_cannot_create_tokens(client):
    login(DEMO_USER_ID)
    assert client.post("/api/tokens", json={"name": "x", "scopes": ALL}).status_code == 403


# ── Audit / rate limit ───────────────────────────────────────

def test_writes_are_audited_reads_are_not(client):
    acc = add_account(A, "A card", "1000.00")
    tok = make_token(client, A)
    client.get("/api/accounts", headers=bearer(tok))
    r = client.post("/api/transactions/manual", headers=bearer(tok),
                    json={"account_id": acc, "amount": 100, "description": "Pago", "category": "payment", "date": "2026-11-03"})
    assert r.status_code == 200
    with Session(database.engine) as s:
        rows = s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).all()
        assert [(x.token_id, x.action, x.detail) for x in rows] == [
            (tok["id"], "POST /api/transactions/manual", "write:payments")]
        assert s.get(ApiToken, tok["id"]).last_used_at is not None


def test_rate_limit_per_token(client, monkeypatch):
    monkeypatch.setattr(api_tokens, "RATE_LIMIT_PER_MIN", 3)
    tok = make_token(client, A)
    codes = [client.get("/api/accounts", headers=bearer(tok)).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
