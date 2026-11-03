from sqlmodel import create_engine, SQLModel, Session, select
from sqlalchemy import text
from models import User, Account, Transaction, CashflowItem, MovementLog, Subscription
from decimal import Decimal

import os
from dotenv import load_dotenv

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


if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[OK] Connected to PostgreSQL")
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

def get_session():
    with Session(engine) as session:
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
