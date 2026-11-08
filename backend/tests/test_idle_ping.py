"""Idle-only ping: a connection idle past IDLE_PING_S is checked and, if dead,
silently replaced; a recently used one is handed out without a round trip."""
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.pool import QueuePool

import database


def _engine(tmp_path):
    eng = create_engine(f"sqlite:///{tmp_path / 'p.db'}", poolclass=QueuePool, pool_size=1, max_overflow=0)
    database.install_idle_ping(eng)
    with eng.connect() as c:
        c.execute(text("SELECT 1"))
    return eng


def _kill_pooled_and_age(eng, seconds):
    rec = eng.pool._pool.queue[0]  # the single idle ConnectionPoolEntry
    rec.dbapi_connection.close()   # simulate the server dropping it
    rec.info["kx_last_used"] -= seconds


def test_dead_idle_connection_is_replaced_transparently(tmp_path):
    eng = _engine(tmp_path)
    _kill_pooled_and_age(eng, database.IDLE_PING_S + 1)
    with eng.connect() as c:
        assert c.execute(text("SELECT 1")).scalar() == 1


def test_recent_connection_skips_the_ping(tmp_path):
    eng = _engine(tmp_path)
    _kill_pooled_and_age(eng, 0)  # dead but "just used": no ping, so the query itself fails
    with pytest.raises(DBAPIError):
        with eng.connect() as c:
            c.execute(text("SELECT 1"))
