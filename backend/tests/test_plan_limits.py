"""Plan limits enforced by the server (plan_guard): Velocity counts up to 15
debts, the 16th is left out of every calculation; Accelerator has no cap."""
from sqlmodel import Session, select

import database
from helpers import filter_active_debt_accounts
from models import Account, Subscription
from plan_guard import plan_limit_for
from tests.test_api_tokens import A, add_account, clean, set_plan  # noqa: F401  (clean is autouse)


def _debts():
    with Session(database.engine) as s:
        return s.exec(select(Account).where(Account.user_id == A)).all()


def test_velocity_counts_debt_15_and_leaves_out_16():
    set_plan(A, "velocity")
    for i in range(16):
        add_account(A, f"Deuda {i + 1}", "100.00")
    with Session(database.engine) as s:
        limit = plan_limit_for(s, A)
    assert limit == 15
    active = filter_active_debt_accounts(_debts(), limit)
    assert len(active) == 15  # #15 counts, #16 is left out of the plan


def test_accelerator_has_no_cap_beyond_12():
    set_plan(A, "accelerator")
    for i in range(14):
        add_account(A, f"Deuda {i + 1}", "100.00")
    with Session(database.engine) as s:
        limit = plan_limit_for(s, A)
    assert limit is None
    assert len(filter_active_debt_accounts(_debts(), limit)) == 14


def test_dashboard_reflects_the_velocity_limit(client):
    from auth import get_current_user_id
    from main import app
    set_plan(A, "velocity")
    for i in range(16):
        add_account(A, f"Deuda {i + 1}", "100.00")
    app.dependency_overrides[get_current_user_id] = lambda: A
    try:
        r = client.get("/api/dashboard").json()
        assert r["locked_account_count"] == 1  # the 16th debt is outside the Velocity plan
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
        with Session(database.engine) as s:
            for row in s.exec(select(Subscription).where(Subscription.user_id == A)).all():
                s.delete(row)
            s.commit()
