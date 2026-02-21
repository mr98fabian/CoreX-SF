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

if DATABASE_URL:
    # Supabase PostgreSQL — Production
    engine = create_engine(DATABASE_URL, echo=False)
    print("✅ Connected to Supabase PostgreSQL")
else:
    # SQLite Fallback — Local Development
    if os.environ.get("VERCEL"):
        sqlite_file_name = "/tmp/corex.db"
    else:
        sqlite_file_name = "corex.db"
    
    sqlite_url = f"sqlite:///{sqlite_file_name}"
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    print("⚠️  Using SQLite fallback (no DATABASE_URL found)")

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
                print(f"  ✅ Added column: accounts.{col_name}")
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
