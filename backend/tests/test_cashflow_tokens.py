"""Micro-fase 5.1 (addendum): cashflow opt-in for tokens — GET read:dashboard,
POST/PUT/DELETE write:payments — owner-only with cross-user 404; and the
Hard Reset (DELETE /api/accounts) restored and still closed to tokens."""
from decimal import Decimal

from sqlmodel import Session, select

import database
from main import app
from auth import get_current_user_id
from models import Account, ApiTokenAudit, CashflowItem
from tests.test_api_tokens import A, B, add_account, bearer, clean, login, make_token  # noqa: F401  (clean is autouse)


def add_cashflow(user, name="Sueldo", amount="1850", account_id=None):
    with Session(database.engine) as s:
        cf = CashflowItem(user_id=user, name=name, amount=Decimal(amount), category="income",
                          is_income=True, account_id=account_id)
        s.add(cf); s.commit(); s.refresh(cf)
        return cf.id


def cleanup_cashflow():
    with Session(database.engine) as s:
        for row in s.exec(select(CashflowItem).where(CashflowItem.user_id.in_([A, B]))).all():
            s.delete(row)
        s.commit()


def test_token_reads_only_own_cashflow(client):
    add_cashflow(A, "Sueldo A"); add_cashflow(B, "Sueldo B")
    tok = make_token(client, A)
    names = [i["name"] for i in client.get("/api/cashflow", headers=bearer(tok)).json()]
    assert "Sueldo A" in names and "Sueldo B" not in names
    cleanup_cashflow()


def test_token_creates_edits_deletes_own_cashflow(client):
    tok = make_token(client, A)
    r = client.post("/api/cashflow", headers=bearer(tok),
                    json={"name": "Renta", "amount": 1350, "category": "expense", "user_id": B, "id": 4242})
    assert r.status_code == 200 and r.json()["user_id"] == A and r.json()["id"] != 4242
    cf = r.json()["id"]
    r = client.put(f"/api/cashflow/{cf}", headers=bearer(tok), json={"amount": 1400})
    assert r.status_code == 200 and float(r.json()["amount"]) == 1400 and r.json()["name"] == "Renta"
    assert client.delete(f"/api/cashflow/{cf}", headers=bearer(tok)).status_code == 200
    assert all(i.get("id") != cf for i in client.get("/api/cashflow", headers=bearer(tok)).json())


def test_cross_user_put_and_delete_are_404_and_leave_b_intact(client):
    b_cf = add_cashflow(B, "Sueldo B", "2000")
    tok = make_token(client, A)
    assert client.put(f"/api/cashflow/{b_cf}", headers=bearer(tok), json={"amount": 1}).status_code == 404
    assert client.delete(f"/api/cashflow/{b_cf}", headers=bearer(tok)).status_code == 404
    with Session(database.engine) as s:
        assert s.get(CashflowItem, b_cf).amount == Decimal("2000")
    cleanup_cashflow()


def test_cannot_link_cashflow_to_another_users_account(client):
    b_acc = add_account(B, "B checking")
    a_cf = add_cashflow(A)
    tok = make_token(client, A)
    assert client.post("/api/cashflow", headers=bearer(tok),
                       json={"name": "x", "amount": 1, "category": "income", "account_id": b_acc}).status_code == 404
    assert client.put(f"/api/cashflow/{a_cf}", headers=bearer(tok), json={"account_id": b_acc}).status_code == 404
    cleanup_cashflow()


def test_scopes_on_cashflow(client):
    a_cf = add_cashflow(A)
    reader = make_token(client, A, scopes=["read:dashboard"])
    assert client.get("/api/cashflow", headers=bearer(reader)).status_code == 200
    assert client.post("/api/cashflow", headers=bearer(reader), json={"name": "x", "amount": 1, "category": "income"}).status_code == 403
    assert client.put(f"/api/cashflow/{a_cf}", headers=bearer(reader), json={"amount": 1}).status_code == 403
    assert client.delete(f"/api/cashflow/{a_cf}", headers=bearer(reader)).status_code == 403
    writer = make_token(client, A, scopes=["write:payments"], name="w")
    assert client.get("/api/cashflow", headers=bearer(writer)).status_code == 403
    cleanup_cashflow()


def test_normal_session_still_manages_cashflow(client):
    login(A)
    cf = client.post("/api/cashflow", json={"name": "Luz", "amount": 90, "category": "expense"}).json()["id"]
    assert client.put(f"/api/cashflow/{cf}", json={"amount": 95}).status_code == 200
    assert client.delete(f"/api/cashflow/{cf}").status_code == 200
    app.dependency_overrides.pop(get_current_user_id, None)


def test_cashflow_writes_with_token_are_audited(client):
    tok = make_token(client, A)
    cf = client.post("/api/cashflow", headers=bearer(tok), json={"name": "Gym", "amount": 30, "category": "expense"}).json()["id"]
    client.put(f"/api/cashflow/{cf}", headers=bearer(tok), json={"amount": 35})
    client.delete(f"/api/cashflow/{cf}", headers=bearer(tok))
    with Session(database.engine) as s:
        rows = s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).all()
    assert [(r.action, r.detail) for r in rows] == [
        ("POST /api/cashflow", "write:payments"),
        (f"PUT /api/cashflow/{cf}", "write:payments"),
        (f"DELETE /api/cashflow/{cf}", "write:payments"),
    ]


# ── Hard Reset (restored from main) ──────────────────────────

def test_hard_reset_still_works_for_the_session(client):
    add_account(A, "Visa"); add_cashflow(A)
    login(A)
    r = client.delete("/api/accounts")
    assert r.status_code == 200 and r.json()["message"] == "System Hard Reset Complete"
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        assert s.exec(select(Account).where(Account.user_id == A)).all() == []
        assert s.exec(select(CashflowItem).where(CashflowItem.user_id == A)).all() == []


def test_hard_reset_is_not_open_to_tokens(client):
    add_account(A, "Visa")
    tok = make_token(client, A)
    assert client.delete("/api/accounts", headers=bearer(tok)).status_code == 403
    with Session(database.engine) as s:
        assert len(s.exec(select(Account).where(Account.user_id == A)).all()) == 1
