"""Suscripciones (feat/logos-suscripciones): CRUD with session and token,
normalised totals, order, soft cancel, and official-logo validation."""
from decimal import Decimal

from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, RecurringSubscription
from tests.test_api_tokens import A, B, clean, make_token, bearer  # noqa: F401  (clean is autouse)
import pytest


@pytest.fixture(autouse=True)
def wipe_subs():
    yield
    with Session(database.engine) as s:
        for r in s.exec(select(RecurringSubscription).where(RecurringSubscription.user_id.in_([A, B]))).all():
            s.delete(r)
        s.commit()


def _login(u):
    app.dependency_overrides[get_current_user_id] = lambda: u


def _card(u, name="Amex Gold 4884"):
    with Session(database.engine) as s:
        a = Account(user_id=u, name=name, type="debt", balance=Decimal("100"))
        s.add(a); s.commit(); s.refresh(a)
        return a.id


def test_no_auth_401(client):
    assert client.get("/api/subscriptions").status_code == 401
    assert client.post("/api/subscriptions", json={"name": "x", "amount": 1}).status_code == 401


def test_token_scopes(client):
    ro = make_token(client, A, scopes=["read:accounts"])
    assert client.get("/api/subscriptions", headers=bearer(ro)).status_code == 200
    assert client.post("/api/subscriptions", json={"name": "Netflix", "amount": "15.49"}, headers=bearer(ro)).status_code == 403
    rw = make_token(client, A, scopes=["write:accounts"], name="w")
    r = client.post("/api/subscriptions", json={"name": "Netflix", "amount": "15.49"}, headers=bearer(rw))
    assert r.status_code == 200
    sid = r.json()["id"]
    assert client.patch(f"/api/subscriptions/{sid}", json={"amount": "17.99"}, headers=bearer(rw)).json()["amount"] == "17.99"
    assert client.delete(f"/api/subscriptions/{sid}", headers=bearer(rw)).json()["status"] == "cancelled"


def test_totals_normalised_and_order_and_soft_cancel(client):
    _login(A)
    card = _card(A)
    mk = lambda **b: client.post("/api/subscriptions", json=b).json()
    mk(name="Gym", amount="30.00", frequency="monthly", next_charge_date="2026-11-20")
    mk(name="Dominio", amount="120.00", frequency="annual", next_charge_date="2026-11-09", account_id=card)
    mk(name="Café", amount="6.00", frequency="weekly", next_charge_date="2026-11-12")
    gone = mk(name="Spotify", amount="11.99", next_charge_date="2026-11-07")
    assert client.delete(f"/api/subscriptions/{gone['id']}").status_code == 200
    body = client.get("/api/subscriptions").json()
    # 30 + 120/12 + 6*52/12 = 30 + 10 + 26 = 66 / month; Spotify cancelled → out of totals
    assert body["monthly_total"] == "66.00" and body["annual_total"] == "792.00"
    assert [i["name"] for i in body["items"]] == ["Dominio", "Café", "Gym", "Spotify"]
    assert body["items"][-1]["status"] == "cancelled"
    assert body["items"][0]["account_name"] == "Amex Gold 4884"


def test_isolation_and_foreign_account(client):
    _login(A)
    sid = client.post("/api/subscriptions", json={"name": "Netflix", "amount": "10"}).json()["id"]
    other_card = _card(B)
    assert client.post("/api/subscriptions", json={"name": "X", "amount": "1", "account_id": other_card}).status_code == 404
    _login(B)
    assert client.patch(f"/api/subscriptions/{sid}", json={"amount": "1"}).status_code == 404
    assert client.delete(f"/api/subscriptions/{sid}").status_code == 404
    assert client.get("/api/subscriptions").json()["items"] == []


def test_logo_rules(client):
    _login(A)
    ok = client.post("/api/subscriptions", json={"name": "N", "amount": "1", "logo_url": "https://plaid-merchant-logos.plaid.com/netflix.png"})
    assert ok.status_code == 200
    b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    assert client.post("/api/subscriptions", json={"name": "P", "amount": "1", "logo_url": b64}).json()["logo_url"].startswith("data:image/png;base64,")
    for bad in ("http://x.com/a.png", "javascript:alert(1)", "data:text/html;base64,AAAA"):
        assert client.post("/api/subscriptions", json={"name": "B", "amount": "1", "logo_url": bad}).status_code == 422


def test_account_logo_create_update(client):
    _login(A)
    r = client.post("/api/accounts", json={"name": "Chase", "type": "checking", "balance": 10, "logo_url": "https://x.plaid.com/c.png"})
    assert r.status_code == 200 and r.json()["logo_url"] == "https://x.plaid.com/c.png"
    aid = r.json()["id"]
    assert client.put(f"/api/accounts/{aid}", json={"logo_url": "ftp://nope"}).status_code == 422
    assert client.put(f"/api/accounts/{aid}", json={"logo_url": ""}).json()["logo_url"] is None
