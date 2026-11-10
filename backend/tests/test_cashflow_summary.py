"""GET /api/cashflow/summary (Reloj de dinero): monthly totals computed only by the engine —
MONTHLY_FACTOR for frequencies, plan_minimum for debt payments, monthly_surplus for the surplus."""
from decimal import Decimal

import pytest
from sqlmodel import Session, delete

import database
from auth import get_current_user_id
from main import app
from models import Account, CashflowItem
from tests.test_api_tokens import A, B, bearer, clean, make_token  # noqa: F401  (clean is autouse)
from velocity_engine import DebtAccount, plan_minimum


@pytest.fixture(autouse=True)
def _no_cashflow():
    def wipe():
        with Session(database.engine) as s:
            s.exec(delete(CashflowItem).where(CashflowItem.user_id.in_([A, B])))
            s.commit()
    wipe()
    yield
    wipe()


def _as(user):
    app.dependency_overrides[get_current_user_id] = lambda: user


def _cf(user, name, amount, frequency, income):
    return CashflowItem(user_id=user, name=name, amount=Decimal(amount), frequency=frequency,
                        category="income" if income else "expense", is_income=income, day_of_month=1)


def test_totals_use_the_engine_frequency_table(client):
    with Session(database.engine) as s:
        s.add(_cf(A, "Sueldo", "1200", "biweekly", True))     # 1200 × 26/12 = 2600.00
        s.add(_cf(A, "Freelance", "300", "weekly", True))     # 300 × 52/12 = 1300.00
        s.add(_cf(A, "Renta", "1500", "monthly", False))      # 1500.00
        s.add(_cf(A, "Súper", "100", "weekly", False))        # 100 × 52/12 = 433.33
        s.add(_cf(A, "Seguro", "1200", "annually", False))    # 100.00
        s.commit()
    _as(A)
    r = client.get("/api/cashflow/summary")
    assert r.status_code == 200
    b = r.json()
    assert b["income_monthly"] == 3900.00
    assert b["expenses_monthly"] == 2033.33
    assert b["debt_payments_monthly"] == 0.0
    assert b["outflow_monthly"] == 2033.33
    assert b["surplus_monthly"] == 1866.67
    assert b["balance_monthly"] == 1866.67
    assert b["has_income"] is True


def test_no_income_gives_has_income_false_and_null_surplus(client):
    with Session(database.engine) as s:
        s.add(_cf(B, "Renta", "900", "monthly", False))
        s.commit()
    _as(B)
    b = client.get("/api/cashflow/summary").json()
    assert b["has_income"] is False and b["surplus_monthly"] is None
    assert b["income_monthly"] == 0.0 and b["expenses_monthly"] == 900.0


def test_debt_payments_use_plan_minimum_and_balance_is_unfloored(client):
    with Session(database.engine) as s:
        s.add(_cf(A, "Sueldo", "1000", "monthly", True))
        s.add(_cf(A, "Renta", "900", "monthly", False))
        # stored min $25 is stale: plan_minimum uses the single rule (interest + 1%, $35 floor)
        s.add(Account(user_id=A, name="Visa", type="debt", balance=Decimal("6000"), interest_rate=Decimal("24"),
                      min_payment=Decimal("25"), debt_subtype="credit_card"))
        s.commit()
    expected = plan_minimum(DebtAccount(name="Visa", balance=Decimal("6000"), interest_rate=Decimal("24"),
                                        min_payment=Decimal("25"), debt_subtype="credit_card"))
    assert expected > Decimal("25")
    _as(A)
    b = client.get("/api/cashflow/summary").json()
    assert b["debt_payments_monthly"] == float(expected)
    assert b["outflow_monthly"] == float(Decimal("900") + expected)
    assert b["balance_monthly"] == float(Decimal("100") - expected)  # negative: no floor
    assert b["surplus_monthly"] == 0.0                                # the engine's floored surplus


def test_a_kx_token_with_read_dashboard_can_read_it(client):
    tok = make_token(client, A, scopes=["read:dashboard"])
    assert client.get("/api/cashflow/summary", headers=bearer(tok)).status_code == 200
    tok2 = make_token(client, A, scopes=["read:accounts"], name="other")
    assert client.get("/api/cashflow/summary", headers=bearer(tok2)).status_code == 403
