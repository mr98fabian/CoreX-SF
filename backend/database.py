from sqlmodel import create_engine, SQLModel, Session, select
from sqlalchemy import text
from models import User, Account, Transaction, CashflowItem, MovementLog, Subscription
from decimal import Decimal

import os
from dotenv import load_dotenv, dotenv_values

load_dotenv()

# ================================================================
# DATABASE CONNECTION
# Supabase PostgreSQL (Primary) | SQLite (Local Fallback)
# ================================================================

DATABASE_URL = os.environ.get("DATABASE_URL")
# SQLite is a LOCAL-DEV convenience only. In production a missing or broken
# DATABASE_URL must fail loudly at boot — a silent fallback to an ephemeral
# SQLite file hides a misconfigured/paused database behind a "healthy" service.
ALLOW_SQLITE_FALLBACK = os.environ.get("ENVIRONMENT", "production") == "development"

# Development never connects to the database URL stored in backend/.env (that is
# PRODUCTION). Shell quirks (cmd's `set X=` deletes X) silently let load_dotenv()
# fill it in, and the startup create_all then wrote tables into prod (2026-11-03).
# A remote DB in development must come from the real environment, not the file.
if ALLOW_SQLITE_FALLBACK and DATABASE_URL and DATABASE_URL == dotenv_values().get("DATABASE_URL"):
    print("[DEV] Ignoring DATABASE_URL from .env in development — using local SQLite")
    DATABASE_URL = None


def _mask_db_url(url: str) -> str:
    """scheme://host:port/dbname only — never user, password or tenant ref."""
    try:
        from sqlalchemy.engine import make_url
        u = make_url(url)
        return f"{u.drivername}://{u.host}:{u.port}/{u.database}"
    except Exception:
        return "<unparseable DATABASE_URL>"


def _make_sqlite_engine():
    sqlite_file_name = "/tmp/korex.db" if os.environ.get("VERCEL") else "korex.db"
    eng = create_engine(f"sqlite:///{sqlite_file_name}", connect_args={"check_same_thread": False})
    print("[DEV] Using SQLite (local development)")
    return eng


# pool_pre_ping costs one round trip to Supabase on EVERY checkout (≈ one per
# request). Pinging only a connection that sat idle longer than IDLE_PING_S
# keeps the safety where it matters (pooler/idle drops, restarts) and skips the
# round trip during active use. A failed ping raises DisconnectionError, which
# makes SQLAlchemy discard that connection and check out a fresh one (the
# documented pessimistic-disconnect pattern), so callers never see the error.
IDLE_PING_S = 30.0


def install_idle_ping(eng) -> None:
    import time as _t
    from sqlalchemy import event, exc

    @event.listens_for(eng, "checkin")
    def _mark(dbapi_conn, record):
        record.info["kx_last_used"] = _t.monotonic()

    @event.listens_for(eng, "checkout")
    def _ping_if_idle(dbapi_conn, record, proxy):
        last = record.info.get("kx_last_used")
        if last is None or _t.monotonic() - last < IDLE_PING_S:
            return  # brand-new connection, or used moments ago
        try:
            cur = dbapi_conn.cursor()
            cur.execute("SELECT 1")
            cur.close()
        except Exception as err:
            raise exc.DisconnectionError() from err


if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=False, pool_recycle=1800)
        install_idle_ping(engine)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[OK] Connected to {_mask_db_url(DATABASE_URL)}")  # says which DB, so a dev server on prod is obvious
    except Exception as _pg_err:
        if not ALLOW_SQLITE_FALLBACK:
            raise RuntimeError(
                f"Cannot connect to the database at {_mask_db_url(DATABASE_URL)} "
                f"({_pg_err.__class__.__name__}). Check that the Supabase project is "
                "active and that DATABASE_URL is the current pooler connection string."
            ) from None
        print(f"[WARN] PostgreSQL unavailable ({_pg_err.__class__.__name__}), falling back to SQLite (ENVIRONMENT=development)")
        engine = _make_sqlite_engine()
elif ALLOW_SQLITE_FALLBACK:
    engine = _make_sqlite_engine()
else:
    raise RuntimeError(
        "DATABASE_URL is not set. Production requires a PostgreSQL connection string; "
        "SQLite is only allowed when ENVIRONMENT=development."
    )

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    # Run safe migrations for new columns (SQLite create_all won't add to existing tables)
    _migrate_account_columns()

def _migrate_account_columns():
    """Add loan classification columns if they don't exist."""
    migrations = [
        ("interest_type", "VARCHAR DEFAULT 'revolving'"),
        ("debt_subtype", "VARCHAR DEFAULT 'credit_card'"),
        ("original_amount", "DECIMAL(14,2) DEFAULT NULL"),
        ("loan_term_months", "INTEGER DEFAULT NULL"),
        ("remaining_months", "INTEGER DEFAULT NULL"),
        ("credit_limit", "DECIMAL(14,2) DEFAULT NULL"),
        ("apy", "DECIMAL(5,2) DEFAULT NULL"),
    ]
    with Session(engine) as session:
        for col_name, col_def in migrations:
            try:
                session.exec(text(f"ALTER TABLE accounts ADD COLUMN {col_name} {col_def}"))
                session.commit()
                print(f"  [+] Added column: accounts.{col_name}")
            except Exception:
                session.rollback()  # Column likely already exists

# ── One DB session per request (perf 2026-11-05) ──────────────
# Every Session against Supabase pays network latency, and a hot request used
# to open 2–3 (router + plan_guard + require_scope). The request middleware in
# main.py installs a holder; request_session() opens ONE session lazily on
# first use and every caller in that request (handler and guards) shares it.
# Outside a request (scripts, tests calling functions directly) it falls back
# to a private session, exactly like before. Handlers keep their explicit
# commit() calls; the middleware closes the session (rolling back anything
# uncommitted) when the response is done.
from contextlib import contextmanager
from contextvars import ContextVar


class _RequestDB:
    __slots__ = ("session",)

    def __init__(self):
        self.session = None


_request_db: ContextVar = ContextVar("kx_request_db", default=None)


def begin_request_db():
    return _request_db.set(_RequestDB())


def end_request_db(token) -> None:
    holder = _request_db.get()
    _request_db.reset(token)
    if holder is not None and holder.session is not None:
        holder.session.close()


@contextmanager
def request_session():
    import database as _db  # read the engine at call time (tests swap it)
    holder = _request_db.get()
    if holder is None:
        with Session(_db.engine) as session:
            yield session
        return
    if holder.session is None:
        holder.session = Session(_db.engine)
    yield holder.session


def get_session():
    with request_session() as session:
        yield session

def seed_data():
    with Session(engine) as session:
        if not session.exec(select(User)).first():
            print("Running Seed Data...")
            # Create Default User
            user = User(name="Demo User", email="demo@korex.com", shield_target=Decimal("1000.00"))
            session.add(user)
            
            session.commit()
            print("Seed Data Completed! (User Initialized)")
        else:
            print("Database already seeded.")
