"""Funding rule unified (2026-11-05): any non-debt account with balance > 0
funds the plan — a user whose money lives in a "cash" account gets the risky
opportunity exactly like one with "checking"."""
from decimal import Decimal

from sqlmodel import Session

import database
from auth import get_current_user_id
from helpers import funding_accounts
from main import app
from models import Account
from tests.test_api_tokens import A, B, clean  # noqa: F401  (clean is autouse)


class Acc:
    def __init__(self, type, balance, name="x"):
        self.type, self.balance, self.name = type, Decimal(balance), name


def test_funding_accounts_rule():
    accs = [Acc("debt", "900"), Acc("cash", "300", "Efectivo"), Acc("checking", "0"), Acc("savings", "500", "Ahorro")]
    assert [a.name for a in funding_accounts(accs)] == ["Ahorro", "Efectivo"]


def _seed(user, funding_type, funding_name):
    with Session(database.engine) as s:
        # liquid == shield (default $1,000): shield full, no free attack → the risky path runs
        s.add(Account(user_id=user, name=funding_name, type=funding_type, balance=Decimal("1000")))
        s.add(Account(user_id=user, name="Visa", type="debt", balance=Decimal("3000"), interest_rate=Decimal("24"),
                      min_payment=Decimal("90"), debt_subtype="credit_card"))
        s.commit()


def _risky(client, user):
    app.dependency_overrides[get_current_user_id] = lambda: user
    try:
        return client.get("/api/strategy/command-center").json()
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)


def test_cash_funded_user_gets_the_risky_opportunity_like_checking(client):
    _seed(A, "checking", "Cheques")
    _seed(B, "cash", "Efectivo")
    a, b = _risky(client, A), _risky(client, B)
    assert a["risky_opportunity"] is not None
    assert b["risky_opportunity"] is not None
    # Same numbers; only the funding account's name differs
    strip = lambda r: {k: v for k, v in r.items() if "source" not in k and "description" not in k and "label" not in k}  # noqa: E731
    assert strip(b["risky_opportunity"]) == strip(a["risky_opportunity"])
    assert "Efectivo" in str(b["risky_opportunity"]) and "Checking" not in str(b["risky_opportunity"])
    assert len(b["arbitrage_alerts"]) == len(a["arbitrage_alerts"])  # cash counts for arbitrage too
