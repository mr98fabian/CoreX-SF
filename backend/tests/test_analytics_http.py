"""Analytics (Análisis): the three endpoints the page loads with Promise.all.
Transaction.date is an ISO str by design, so a strftime on it (or a date-vs-str
comparison) 500s every user with transactions and blanks the whole page.
Each endpoint is hit WITH transactions (the case that broke) and without."""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, Transaction

A = "a7a7a7a7-a7a7-4a7a-a7a7-a7a7a7a7a7a7"
H = {"Authorization": "Bearer x"}
ENDPOINTS = ("/api/analytics/summary", "/api/analytics/spending-by-category", "/api/analytics/monthly-trend")


@pytest.fixture(autouse=True)
def as_user():
    app.dependency_overrides[get_current_user_id] = lambda: A
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (Transaction, Account):
            for row in s.exec(select(model).where(model.user_id == A)).all():
                s.delete(row)
        s.commit()


def seed():
    t = date.today()
    with Session(database.engine) as s:
        acc = Account(user_id=A, name="Cheques", type="checking", balance=Decimal("1000"))
        s.add(acc); s.commit(); s.refresh(acc)
        for days, amount, cat in ((1, "2400", "salary"), (2, "-120.50", "food"), (40, "-300", "rent"),
                                  (45, "-80", "food"), (400, "-999", "old")):  # the last one is outside every window
            s.add(Transaction(user_id=A, account_id=acc.id, date=(t - timedelta(days=days)).isoformat(),
                              amount=Decimal(amount), description=cat, category=cat))
        s.commit()


@pytest.mark.parametrize("url", ENDPOINTS)
def test_every_endpoint_answers_200_without_transactions(client, url):
    assert client.get(url, headers=H).status_code == 200


@pytest.mark.parametrize("url", ENDPOINTS)
def test_every_endpoint_answers_200_with_transactions(client, url):
    seed()
    assert client.get(url, headers=H).status_code == 200


def test_numbers_with_transactions_and_the_iso_cutoff(client):
    seed()
    t = date.today()
    trend = client.get("/api/analytics/monthly-trend", headers=H).json()["trend"]
    months = {m["month"] for m in trend}
    assert (t - timedelta(days=1)).isoformat()[:7] in months
    assert round(sum(m["income"] for m in trend), 2) == 2400.0
    assert round(sum(m["expense"] for m in trend), 2) == 500.5  # the 400-day-old expense is out

    cats = client.get("/api/analytics/spending-by-category", headers=H).json()
    assert cats["total_spent"] == 500.5
    assert cats["categories"][0] == {"name": "rent", "amount": 300.0}

    summary = client.get("/api/analytics/summary", headers=H).json()
    assert (summary["transaction_count"], summary["total_3m_spending"], summary["top_category"]) == (3, 500.5, "rent")
