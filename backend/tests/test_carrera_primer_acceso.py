"""
Misión 16 — the first access of a brand-new account fires several requests in parallel
(settings, push/profile…) that each create the user's per-user row. Two of them used to see
"no row", both INSERT, and the second hit the UNIQUE(user_id) → IntegrityError → HTTP 500.

These tests reproduce the race deterministically: a real file-backed SQLite (so threads use
separate connections, like production), and a barrier that holds every INSERT until all the
requests have already run their SELECT and found nothing — the exact losing interleaving.
"""
import threading
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func
from sqlmodel import Session, SQLModel, create_engine, select

import database
import helpers
from auth import DEMO_TOKEN, DEMO_USER_ID
from main import app
from models import CoachProfile, HouseGoal, SyncState, UserSettings
from routers import settings_api

N = 6
# Required columns without a default (house_goals): what the PUT would send.
DEFAULTS = {HouseGoal: {"target_total": Decimal("10000"), "home_price": Decimal("250000")}}


@pytest.fixture
def race_engine(tmp_path, monkeypatch):
    eng = create_engine(f"sqlite:///{tmp_path / 'race.db'}",
                        connect_args={"check_same_thread": False, "timeout": 15})
    SQLModel.metadata.create_all(eng)
    monkeypatch.setattr(database, "engine", eng)
    monkeypatch.setattr(settings_api, "engine", eng)
    yield eng
    eng.dispose()


def _hold_inserts(eng, table: str, parties: int):
    """Every INSERT into `table` waits until `parties` of them are queued (all SELECTs done)."""
    barrier = threading.Barrier(parties)

    @event.listens_for(eng, "before_cursor_execute")
    def _wait(conn, cursor, statement, params, context, executemany):
        if statement.lstrip().upper().startswith(f"INSERT INTO {table.upper()}"):
            try:
                barrier.wait(timeout=5)
            except threading.BrokenBarrierError:
                pass
    return barrier


def _count(eng, model, user_id) -> int:
    with Session(eng) as s:
        return s.exec(select(func.count()).select_from(model).where(model.user_id == user_id)).one()


def test_first_access_parallel_requests_all_200_and_one_row(race_engine):
    _hold_inserts(race_engine, "user_settings", N)
    headers = {"Authorization": f"Bearer {DEMO_TOKEN}"}
    with TestClient(app, raise_server_exceptions=False) as client:
        def hit(i: int):
            if i % 2:
                return client.put("/api/push/profile", headers=headers,
                                  json={"language": "es", "timezone": "America/Bogota"})
            return client.get("/api/settings", headers=headers)

        with ThreadPoolExecutor(max_workers=N) as pool:
            responses = list(pool.map(hit, range(N)))

    statuses = [r.status_code for r in responses]
    assert statuses == [200] * N, f"statuses={statuses} bodies={[r.text[:120] for r in responses]}"
    assert _count(race_engine, UserSettings, DEMO_USER_ID) == 1
    # Same contract as before: the bodies keep their shape.
    assert responses[0].json() == {"onboarding_complete": False}
    assert responses[1].json() == {"language": "es", "timezone": "America/Bogota"}


@pytest.mark.parametrize("model", [UserSettings, CoachProfile, SyncState, HouseGoal],
                         ids=lambda m: m.__tablename__)
def test_helper_is_race_safe_for_every_per_user_table(race_engine, model):
    _hold_inserts(race_engine, model.__tablename__, N)
    user_id = "00000000-0000-4000-a000-0000000000aa"

    def create(_):
        with Session(race_engine) as s:
            return helpers.get_or_create_for_user(s, model, user_id, **DEFAULTS.get(model, {})).id

    with ThreadPoolExecutor(max_workers=N) as pool:
        ids = list(pool.map(create, range(N)))

    assert len(set(ids)) == 1 and ids[0] is not None
    assert _count(race_engine, model, user_id) == 1
