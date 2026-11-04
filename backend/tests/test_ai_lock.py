"""Fase 6 addendum 2: AI connection (API tokens / MCP) only on a paid plan,
enforced on the server at creation AND on every token request."""
from sqlmodel import Session, select

import database
from main import app
from auth import get_current_user_id, DEMO_USER_ID
from models import ApiToken, Subscription
from tests.test_api_tokens import A, ALL, bearer, clean, login, make_token, set_plan  # noqa: F401


def test_free_user_cannot_mint_a_token(client):
    login(A)  # no subscription row → Starter
    assert client.get("/api/tokens/access").json() == {"allowed": False, "reason": "free_plan", "plan": "starter"}
    r = client.post("/api/tokens", json={"name": "x", "scopes": ALL})
    assert r.status_code == 403
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        assert s.exec(select(ApiToken).where(ApiToken.user_id == A)).all() == []


def test_paid_user_mints_and_uses_a_token(client):
    tok = make_token(client, A)  # helper puts A on Velocity
    login(A)
    assert client.get("/api/tokens/access").json()["allowed"] is True
    app.dependency_overrides.pop(get_current_user_id, None)
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 200


def test_cancelled_user_loses_access_on_the_next_request(client):
    tok = make_token(client, A)
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 200
    # Lemon Squeezy webhook: subscription expired → effective plan drops to Starter
    set_plan(A, plan="starter", status="expired")
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 403
    # ...and an upgrade confirmed by the webhook opens it again, same token
    set_plan(A, plan="accelerator", status="active")
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 200


def test_cancelled_but_still_in_paid_period_keeps_access(client):
    tok = make_token(client, A)
    with Session(database.engine) as s:
        sub = s.exec(select(Subscription).where(Subscription.user_id == A)).first()
        sub.status, sub.current_period_end = "cancelled", "2999-01-01T00:00:00Z"
        s.add(sub); s.commit()
    assert client.get("/api/accounts", headers=bearer(tok)).status_code == 200


def test_demo_sees_the_lock(client):
    login(DEMO_USER_ID)
    assert client.get("/api/tokens/access").json()["allowed"] is False
