from sqlmodel import Session, select, SQLModel
from database import engine
from models import Account, Transaction, MovementLog

def force_clean():
    print("Dropping all tables...")
    SQLModel.metadata.drop_all(engine)
    print("Creating all tables...")
    SQLModel.metadata.create_all(engine)
    print("FORCE CLEAN & SCHEMA RESET COMPLETE.")

if __name__ == "__main__":
    force_clean()
