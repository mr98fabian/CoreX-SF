"""POST /api/strategy/execute obeys the two-sided law: when the payment is larger
than the debt, the debt reaches $0 and the source loses ONLY what was applied."""
from decimal import Decimal

import pytest


def _acct(client, h, **body):
    r = client.post("/api/accounts", headers=h, json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _bal(client, h, acc_id):
    return Decimal(str(next(a for a in client.get("/api/accounts", headers=h).json() if a["id"] == acc_id)["balance"]))


def _exec(client, h, src, dst, amount, key):
    return client.post("/api/strategy/execute", headers=h, json={
        "movement_key": key, "title": f"Ataque a {dst}", "amount": amount,
        "date_planned": "2026-11-06", "source": src, "destination": dst})


@pytest.fixture
def pair(client, auth_headers):
    src = _acct(client, auth_headers, name="Fuente Overpay", type="checking", balance=5000, interest_rate=0)
    dst = _acct(client, auth_headers, name="Tarjeta Overpay", type="debt", balance=300, interest_rate=24.99,
                min_payment=25, debt_subtype="credit_card")
    yield src, dst
    for a in (src, dst):
        client.delete(f"/api/accounts/{a['id']}", headers=auth_headers)


def test_overpayment_only_costs_the_debt_balance(client, auth_headers, pair):
    src, dst = pair
    r = _exec(client, auth_headers, "Fuente Overpay", "Tarjeta Overpay", 500, "ovp-1")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount_requested"] == 500 and body["amount_applied"] == 300
    assert _bal(client, auth_headers, dst["id"]) == Decimal("0")
    assert _bal(client, auth_headers, src["id"]) == Decimal("4700")  # not 4500
    assert body["new_balance_source"] == 4700 and body["new_balance_dest"] == 0


def test_the_record_carries_the_applied_amount(client, auth_headers, pair):
    src, _ = pair
    _exec(client, auth_headers, "Fuente Overpay", "Tarjeta Overpay", 500, "ovp-2")
    txs = client.get(f"/api/accounts/{src['id']}/transactions", headers=auth_headers).json()
    tx = next(t for t in txs if "Velocity Execution" in t["description"])
    assert Decimal(str(tx["amount"])) == Decimal("300")
    assert "aplicado $300.00 de $500.00" in tx["description"]


def test_normal_payment_is_unchanged(client, auth_headers, pair):
    src, dst = pair
    r = _exec(client, auth_headers, "Fuente Overpay", "Tarjeta Overpay", 120, "ovp-3")
    assert r.status_code == 200
    body = r.json()
    assert body["amount_requested"] == body["amount_applied"] == 120
    assert _bal(client, auth_headers, dst["id"]) == Decimal("180")
    assert _bal(client, auth_headers, src["id"]) == Decimal("4880")
    txs = client.get(f"/api/accounts/{src['id']}/transactions", headers=auth_headers).json()
    tx = next(t for t in txs if "Velocity Execution" in t["description"])
    assert Decimal(str(tx["amount"])) == Decimal("120") and "aplicado" not in tx["description"]


def test_paid_debt_takes_nothing_from_the_source(client, auth_headers, pair):
    src, _ = pair
    assert _exec(client, auth_headers, "Fuente Overpay", "Tarjeta Overpay", 300, "ovp-4").status_code == 200
    r = _exec(client, auth_headers, "Fuente Overpay", "Tarjeta Overpay", 50, "ovp-5")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "DEBT_ALREADY_PAID"
    assert _bal(client, auth_headers, src["id"]) == Decimal("4700")


def test_funds_check_uses_the_applied_amount(client, auth_headers):
    src = _acct(client, auth_headers, name="Fuente Corta", type="checking", balance=350, interest_rate=0)
    dst = _acct(client, auth_headers, name="Tarjeta Corta", type="debt", balance=300, interest_rate=20,
                min_payment=25, debt_subtype="credit_card")
    try:
        # $500 nominal > $350 in the source, but only $300 applies: it goes through
        r = _exec(client, auth_headers, "Fuente Corta", "Tarjeta Corta", 500, "ovp-6")
        assert r.status_code == 200 and r.json()["amount_applied"] == 300
        assert _bal(client, auth_headers, src["id"]) == Decimal("50")
    finally:
        for a in (src, dst):
            client.delete(f"/api/accounts/{a['id']}", headers=auth_headers)
