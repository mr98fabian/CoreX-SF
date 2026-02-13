from sqlmodel import create_engine, SQLModel, Session, select
from models import User, Account, Transaction, CashflowItem, MovementLog
from decimal import Decimal

import os

# Check if running on Vercel (read-only filesystem)
if os.environ.get("VERCEL"):
    sqlite_file_name = "/tmp/corex.db"
else:
    sqlite_file_name = "corex.db"

sqlite_url = f"sqlite:///{sqlite_file_name}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session

def seed_data():
    with Session(engine) as session:
        if not session.exec(select(User)).first():
            print("Running Seed Data...")
            # Create Default User
            user = User(name="Fabian", email="fabian@corex.com", shield_target=Decimal("1000.00"))
            session.add(user)
            
            session.commit()
            print("Seed Data Completed! (User Initialized)")
        else:
            print("Database already seeded.")
