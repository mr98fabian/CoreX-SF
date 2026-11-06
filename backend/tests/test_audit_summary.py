"""Actividad-detalle Part A: each AI write records WHAT changed (summary) and,
if sent, WHY (X-Korex-Note). Normal sessions write no audit, as before."""
from datetime import datetime
from urllib.parse import quote

from sqlmodel import Session, select

import database
from api_tokens import sanitize_note
from auth import get_current_user_id
from main import app
from models import ApiTokenAudit
from tests.test_api_tokens import A, add_account, bearer, clean, login, make_token  # noqa: F401  (clean is autouse)


def rows():
    with Session(database.engine) as s:
        return s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A).order_by(ApiTokenAudit.id)).all()


def test_account_update_by_token_records_before_after(client):
    acc = add_account(A, "Amex Gold", "3327.50")
    tok = make_token(client, A)
    r = client.put(f"/api/accounts/{acc}", headers=bearer(tok), json={"balance": 3440.68, "interest_rate": 28.74})
    assert r.status_code == 200
    (row,) = rows()
    assert row.summary == "Amex Gold · saldo $3,327.50 → $3,440.68 · APR 20.00% → 28.74%"
    assert row.detail == "write:accounts"  # detail stays the scope


def test_payment_by_token_records_amount_and_account(client):
    acc = add_account(A, "Toyota Corolla", "16500.00")
    tok = make_token(client, A)
    client.post("/api/transactions/manual", headers=bearer(tok),
                json={"account_id": acc, "amount": 641.12, "description": "Pago", "category": "payment", "date": "2026-11-05"})
    assert rows()[-1].summary == "Pago de $641.12 a Toyota Corolla"


def test_account_create_and_delete_and_cashflow_by_token(client):
    tok = make_token(client, A)
    acc = client.post("/api/accounts", headers=bearer(tok), json={"name": "Visa", "type": "debt", "balance": 500, "interest_rate": 20}).json()["id"]
    cf = client.post("/api/cashflow", headers=bearer(tok), json={"name": "Renta", "amount": 1350, "category": "expense", "frequency": "monthly"}).json()["id"]
    client.put(f"/api/cashflow/{cf}", headers=bearer(tok), json={"amount": 1400})
    client.delete(f"/api/cashflow/{cf}", headers=bearer(tok))
    client.delete(f"/api/accounts/{acc}", headers=bearer(tok))
    assert [r.summary for r in rows()] == [
        "Agregó la cuenta Visa · saldo $500.00",
        "Agregó el gasto Renta · $1,350.00 monthly",
        "Renta · monto $1,350.00 → $1,400.00",
        "Quitó Renta de tus ingresos y gastos",
        "Eliminó la cuenta Visa",
    ]


def test_normal_session_writes_no_audit(client):
    acc = add_account(A, "Visa", "1000.00")
    login(A)
    try:
        client.put(f"/api/accounts/{acc}", json={"balance": 900})
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
    assert rows() == []


def test_note_header_is_stored_and_sanitized(client):
    acc = add_account(A, "Visa", "1000.00")
    tok = make_token(client, A)
    note_header = quote("  Sincronicé\tel saldo <script> del estado de cuenta  " + "x" * 200)  # headers are ASCII: UTF-8 percent-encoded
    client.put(f"/api/accounts/{acc}", headers={**bearer(tok), "X-Korex-Note": note_header},
               json={"balance": 950})
    note = rows()[-1].note
    assert note.startswith("Sincronicé el saldo script del estado de cuenta")
    assert "<" not in note and "\t" not in note and len(note) <= 140


def test_sanitize_note_edge_cases():
    assert sanitize_note(None) is None
    assert sanitize_note("   ") is None
    assert sanitize_note("\x00\x01ok\x7f") == "ok"


def test_old_rows_without_summary_still_list(client):
    tok = make_token(client, A)
    with Session(database.engine) as s:
        s.add(ApiTokenAudit(token_id=tok["id"], user_id=A, action="PUT /api/accounts/1", detail="write:accounts", created_at=datetime.utcnow()))
        s.commit()
    login(A)
    try:
        listed = client.get("/api/tokens/audit").json()
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
    assert len(listed) == 1 and listed[0]["action"] == "PUT /api/accounts/1"
