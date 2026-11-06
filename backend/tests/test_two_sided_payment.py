"""Pagos de doble cara (2026-11-06): a payment with funding_account_id lowers the
debt AND the source by the same applied amount, all or nothing."""
from decimal import Decimal

from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, ApiTokenAudit, Transaction
from tests.test_api_tokens import A, B, clean, make_token, bearer  # noqa: F401  (clean is autouse)


def _acc(user, name, type, balance):
    with Session(database.engine) as s:
        a = Account(user_id=user, name=name, type=type, balance=Decimal(balance),
                    interest_rate=Decimal("24") if type == "debt" else Decimal("0"),
                    min_payment=Decimal("50") if type == "debt" else Decimal("0"))
        s.add(a); s.commit(); s.refresh(a)
        return a.id


def _bal(acc_id):
    with Session(database.engine) as s:
        return s.get(Account, acc_id).balance


def _pay(client, debt, amount, funding=None, headers=None):
    body = {"account_id": debt, "amount": amount, "description": "Pago", "category": "payment", "date": "2026-11-06"}
    if funding is not None:
        body["funding_account_id"] = funding
    return client.post("/api/transactions/manual", json=body, headers=headers or {})


def _login(user):
    app.dependency_overrides[get_current_user_id] = lambda: user


def test_payment_with_source_moves_both_sides_and_audit_names_it(client):
    debt, chk = _acc(A, "Amex Gold", "debt", "5000"), _acc(A, "Chase Checking 6022", "checking", "3000")
    tok = make_token(client, A, scopes=["write:payments"])
    r = _pay(client, debt, "1771.40", chk, bearer(tok))
    assert r.status_code == 200 and r.json()["funding_applied"] is True
    assert _bal(debt) == Decimal("3228.60") and _bal(chk) == Decimal("1228.60")
    with Session(database.engine) as s:
        audit = s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).first()
    assert audit.summary == "Pago $1,771.40 a Amex Gold desde Chase Checking 6022"


def test_insufficient_source_is_400_and_nothing_written(client):
    debt, chk = _acc(A, "Visa", "debt", "2000"), _acc(A, "Checking", "checking", "100")
    _login(A)
    r = _pay(client, debt, "500", chk)
    assert r.status_code == 400
    assert _bal(debt) == Decimal("2000") and _bal(chk) == Decimal("100")
    with Session(database.engine) as s:
        assert not s.exec(select(Transaction).where(Transaction.user_id == A)).all()


def test_source_equals_destination_is_400(client):
    chk = _acc(A, "Checking", "checking", "1000")
    _login(A)
    assert _pay(client, chk, "10", chk).status_code == 400


def test_source_of_another_user_is_404(client):
    debt, other = _acc(A, "Visa", "debt", "2000"), _acc(B, "Their checking", "checking", "9000")
    _login(A)
    assert _pay(client, debt, "100", other).status_code == 404
    assert _bal(debt) == Decimal("2000") and _bal(other) == Decimal("9000")


def test_debt_as_source_is_400(client):
    debt, debt2 = _acc(A, "Visa", "debt", "2000"), _acc(A, "Mastercard", "debt", "800")
    _login(A)
    assert _pay(client, debt, "100", debt2).status_code == 400
    assert _bal(debt) == Decimal("2000") and _bal(debt2) == Decimal("800")


def test_overpayment_applies_debt_balance_on_both_sides(client):
    debt, chk = _acc(A, "Visa", "debt", "100"), _acc(A, "Checking", "checking", "1000")
    _login(A)
    assert _pay(client, debt, "150", chk).status_code == 200
    assert _bal(debt) == Decimal("0") and _bal(chk) == Decimal("900")


def test_without_source_legacy_unchanged(client):
    debt, chk = _acc(A, "Visa", "debt", "2000"), _acc(A, "Checking", "checking", "1000")
    _login(A)
    r = _pay(client, debt, "300")
    assert r.status_code == 200 and r.json()["funding_applied"] is False
    assert _bal(debt) == Decimal("1700") and _bal(chk) == Decimal("1000")
