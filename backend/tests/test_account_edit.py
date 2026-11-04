"""Micro-fase 5.1: edit and delete accounts with a write:accounts token (and the
normal session), owner-only, audited, without leaving orphan rows."""
from decimal import Decimal

from sqlmodel import Session, select

import database
from main import app
from auth import get_current_user_id
from models import Account, ApiTokenAudit, CashflowItem, MovementLog, Transaction
from tests.test_api_tokens import A, B, add_account, bearer, clean, login, make_token  # noqa: F401  (clean is autouse)


def test_token_edits_own_account_partially(client):
    acc = add_account(A, "Visa", "1000.00")
    tok = make_token(client, A)
    r = client.put(f"/api/accounts/{acc}", headers=bearer(tok),
                   json={"name": "Visa Oro", "interest_rate": 19.5, "user_id": B, "id": 999})
    assert r.status_code == 200
    got = {a["id"]: a for a in client.get("/api/accounts", headers=bearer(tok)).json()}[acc]
    assert got["name"] == "Visa Oro" and float(got["interest_rate"]) == 19.5
    assert float(got["balance"]) == 1000.0  # untouched field kept
    assert got["user_id"] == A and got["id"] == acc  # id / user_id not editable


def test_token_deletes_own_account(client):
    acc = add_account(A, "Visa")
    tok = make_token(client, A)
    assert client.delete(f"/api/accounts/{acc}", headers=bearer(tok)).status_code == 200
    assert client.get("/api/accounts", headers=bearer(tok)).json() == []


def test_cross_user_put_and_delete_are_404_and_leave_b_intact(client):
    b_acc = add_account(B, "B card", "500.00")
    tok = make_token(client, A)
    assert client.put(f"/api/accounts/{b_acc}", headers=bearer(tok), json={"balance": 0}).status_code == 404
    assert client.delete(f"/api/accounts/{b_acc}", headers=bearer(tok)).status_code == 404
    with Session(database.engine) as s:
        b = s.get(Account, b_acc)
        assert b is not None and b.balance == Decimal("500.00") and b.name == "B card"


def test_read_only_token_cannot_edit_or_delete(client):
    acc = add_account(A, "Visa")
    tok = make_token(client, A, scopes=["read:accounts"])
    assert client.put(f"/api/accounts/{acc}", headers=bearer(tok), json={"name": "x"}).status_code == 403
    assert client.delete(f"/api/accounts/{acc}", headers=bearer(tok)).status_code == 403


def test_normal_session_still_edits_and_deletes(client):
    acc = add_account(A, "Visa")
    login(A)
    assert client.put(f"/api/accounts/{acc}", json={"balance": 750}).json()["balance"] in ("750.00", 750, "750")
    assert client.delete(f"/api/accounts/{acc}").status_code == 200
    app.dependency_overrides.pop(get_current_user_id, None)


def test_put_and_delete_with_token_are_audited(client):
    acc = add_account(A, "Visa")
    tok = make_token(client, A)
    client.put(f"/api/accounts/{acc}", headers=bearer(tok), json={"name": "Nueva"})
    client.delete(f"/api/accounts/{acc}", headers=bearer(tok))
    with Session(database.engine) as s:
        actions = [r.action for r in s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).all()]
    assert actions == [f"PUT /api/accounts/{acc}", f"DELETE /api/accounts/{acc}"]


def test_delete_leaves_no_orphans(client):
    acc = add_account(A, "Visa", "1000.00")
    tok = make_token(client, A)
    client.post("/api/transactions/manual", headers=bearer(tok),
                json={"account_id": acc, "amount": 100, "description": "Pago", "category": "payment", "date": "2026-11-03"})
    with Session(database.engine) as s:
        tx_id = s.exec(select(Transaction).where(Transaction.account_id == acc)).first().id
        s.add(CashflowItem(user_id=A, name="Sueldo", amount=Decimal("1850"), category="income", account_id=acc, is_income=True))
        s.add(MovementLog(user_id=A, movement_key="k1", title="Ataque", amount=Decimal("100"),
                          date_planned="2026-11-03", date_executed="2026-11-03", status="verified",
                          verified_transaction_id=tx_id))
        s.commit()

    r = client.delete(f"/api/accounts/{acc}", headers=bearer(tok))
    assert r.status_code == 200 and r.json()["deleted_transactions"] == 1

    with Session(database.engine) as s:
        assert s.exec(select(Transaction).where(Transaction.account_id == acc)).all() == []
        cf = s.exec(select(CashflowItem).where(CashflowItem.user_id == A)).all()
        assert len(cf) == 1 and cf[0].account_id is None  # income kept, unlinked
        log = s.exec(select(MovementLog).where(MovementLog.user_id == A)).first()
        assert log.verified_transaction_id is None and log.status == "executed"
        for row in cf:
            s.delete(row)
        s.delete(log)
        s.commit()
