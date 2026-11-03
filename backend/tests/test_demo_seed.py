"""The demo seed uses a raw INSERT, so model defaults don't apply: every
NOT NULL column (e.g. payment_frequency) must be listed explicitly."""
from sqlalchemy import text
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, create_engine

import models  # noqa: F401  (registers tables on SQLModel.metadata)
from routers import demo


def test_demo_seed_inserts_accounts(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(demo, "engine", engine)

    demo._seed_impl("00000000-0000-0000-0000-000000000001")

    with engine.connect() as conn:
        freqs = [r[0] for r in conn.execute(text("SELECT payment_frequency FROM accounts"))]
    assert freqs and all(f == "monthly" for f in freqs)
