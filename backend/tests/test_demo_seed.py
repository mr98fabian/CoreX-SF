"""The demo seeds use raw INSERTs, so model defaults don't apply: every
NOT NULL column (e.g. payment_frequency) must be listed explicitly."""
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

import models  # noqa: F401  (registers tables on SQLModel.metadata)
from routers import demo

UID = "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def engine(monkeypatch):
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(eng)
    monkeypatch.setattr(demo, "engine", eng)
    return eng


def test_relatable_seed_is_maria_with_35k_debt(engine):
    result = demo._seed_impl(UID, demo.MARIA)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT type, balance, payment_frequency FROM accounts")).fetchall()
        n_cash = conn.execute(text("SELECT count(*) FROM cashflow_items")).scalar()
        orphans = conn.execute(text("SELECT count(*) FROM transactions WHERE account_id IS NULL")).scalar()
    debt = sum(Decimal(str(r[1])) for r in rows if r[0] == "debt")
    assert debt == Decimal("35050.00")
    assert Decimal("35000") <= debt <= Decimal("40000")
    assert len(rows) == 7 and sum(r[0] == "debt" for r in rows) == 5
    assert all(r[2] == "monthly" for r in rows)
    assert n_cash == len(demo.MARIA["cashflows"])
    assert orphans == 0  # every transaction resolved to a seeded account
    assert result["summary"]["total_debt"] == pytest.approx(35050)


def test_stress_seed_still_loads(engine):
    demo._seed_impl(UID, demo.STRESS)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM accounts")).scalar() == len(demo.STRESS["accounts"])
