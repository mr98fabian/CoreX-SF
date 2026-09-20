"""Regression tests for the Peace Shield multi-tenant leak.

Before the fix, routers used `select(User).first()` — "give me the first user
in the table" — so every user saw the FIRST registered user's shield_target,
and `PUT /user/me/shield` had no authentication at all.
"""
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
from helpers import get_shield_target
from models import UserSettings
from velocity_engine import DEFAULT_PEACE_SHIELD

USER_A = "00000000-0000-4000-a000-00000000000a"
USER_B = "00000000-0000-4000-a000-00000000000b"


@pytest.fixture
def db_session():
    """Direct session against the in-memory test engine, cleaned up after."""
    with Session(database.engine) as session:
        yield session
        for uid in (USER_A, USER_B):
            row = session.exec(
                select(UserSettings).where(UserSettings.user_id == uid)
            ).first()
            if row:
                session.delete(row)
        session.commit()


def test_shield_target_is_per_user(db_session):
    """Two users with different targets must each see their own."""
    db_session.add(UserSettings(user_id=USER_A, shield_target=Decimal("2500.00")))
    db_session.add(UserSettings(user_id=USER_B, shield_target=Decimal("7000.00")))
    db_session.commit()

    assert get_shield_target(db_session, USER_A) == Decimal("2500.00")
    assert get_shield_target(db_session, USER_B) == Decimal("7000.00")


def test_shield_target_falls_back_to_default(db_session):
    """A user with no settings row gets the default, not another user's value."""
    db_session.add(UserSettings(user_id=USER_A, shield_target=Decimal("9999.00")))
    db_session.commit()

    assert get_shield_target(db_session, USER_B) == DEFAULT_PEACE_SHIELD


def test_update_shield_requires_auth(client):
    """PUT /user/me/shield without a token must not mutate anything."""
    response = client.put("/api/user/me/shield", json={"target": 5000})
    assert response.status_code in (401, 403)
