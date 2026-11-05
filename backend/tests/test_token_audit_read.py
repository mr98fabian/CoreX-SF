"""GET /api/tokens/audit: read-only, owner-scope, session only."""
from datetime import datetime

from sqlmodel import Session

import database
from main import app
from auth import get_current_user_id, DEMO_USER_ID
from models import ApiTokenAudit
from tests.test_api_tokens import A, B, add_account, bearer, clean, login, make_token  # noqa: F401


def test_owner_sees_only_their_ai_writes(client):
    acc = add_account(A, "Visa")
    tok_a = make_token(client, A, name="Claude laptop")
    client.post("/api/transactions/manual", headers=bearer(tok_a),
                json={"account_id": acc, "amount": 50, "description": "x", "category": "payment", "date": "2026-11-04"})
    tok_b = make_token(client, B)
    client.post("/api/accounts", headers=bearer(tok_b), json={"name": "B", "type": "debt", "balance": 1})

    login(A)
    rows = client.get("/api/tokens/audit").json()
    assert [(r["action"], r["scope"], r["token_name"]) for r in rows] == [
        ("POST /api/transactions/manual", "write:payments", "Claude laptop")]
    login(B)
    assert [r["action"] for r in client.get("/api/tokens/audit").json()] == ["POST /api/accounts"]
    app.dependency_overrides.pop(get_current_user_id, None)


def test_tokens_cannot_read_the_audit(client):
    tok = make_token(client, A)
    assert client.get("/api/tokens/audit", headers=bearer(tok)).status_code == 403


def test_demo_sees_only_its_own_rows(client):
    with Session(database.engine) as s:
        s.add(ApiTokenAudit(token_id=999, user_id=A, action="POST /api/accounts", detail="write:accounts", created_at=datetime.utcnow()))
        s.commit()
    login(DEMO_USER_ID)
    assert client.get("/api/tokens/audit").json() == []
    app.dependency_overrides.pop(get_current_user_id, None)


def test_audit_is_read_only(client):
    login(A)
    assert client.post("/api/tokens/audit", json={}).status_code in (404, 405)
    assert client.delete("/api/tokens/audit").status_code in (404, 405, 422)
    app.dependency_overrides.pop(get_current_user_id, None)
