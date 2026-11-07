"""María is the one fictional persona shared by the public landing and the demo.
The landing quotes her plan (KxLanding.tsx: $18,400, 4 cards, 14 months to $0);
this pins the engine to those numbers so they can never silently drift."""
from datetime import date

from routers import demo

EXPENSES = [c for c in demo.MARIA["cashflows"] if c[2] != "income"]
INCOME = [c for c in demo.MARIA["cashflows"] if c[2] == "income"]


def _load(client, h):
    for a in demo.MARIA["accounts"]:
        body = dict(name=a[0], type=a[1], balance=a[2], interest_rate=a[3])
        if a[1] == "debt":
            body.update(min_payment=a[4], due_day=a[5], closing_day=a[6], credit_limit=a[13],
                        debt_subtype=a[9], interest_type=a[8])
        assert client.post("/api/accounts", headers=h, json=body).status_code == 200
    for n, amt, cat, freq, var, dom, dow, moy in INCOME + EXPENSES:
        r = client.post("/api/cashflow", headers=h, json=dict(
            name=n, amount=amt, category=cat, frequency=freq, is_variable=var,
            day_of_month=dom, day_of_week=dow, month_of_year=moy, is_income=cat == "income"))
        assert r.status_code == 200


def test_maria_plan_matches_the_landing(client, auth_headers):
    from sqlmodel import SQLModel
    import database
    SQLModel.metadata.drop_all(database.engine)
    SQLModel.metadata.create_all(database.engine)
    _load(client, auth_headers)
    debts = [a for a in demo.MARIA["accounts"] if a[1] == "debt"]
    assert len(debts) == 4 and sum(a[2] for a in debts) == 18400

    path = client.get("/api/velocity/freedom-path", headers=auth_headers).json()
    free = date.fromisoformat(path["freedom_date"])
    today = date.today()
    assert (free.year - today.year) * 12 + free.month - today.month == 14
