import sys
import os
from datetime import date
from decimal import Decimal
from sqlmodel import Session, select

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.database import engine
from backend.models import Account, Transaction, MovementLog

def debug_execution():
    print("Debugging Execution Logic...")
    
    amount = Decimal("10.00")
    source_name = "Chase Checking"
    dest_name = "Credit Card"
    
    with Session(engine) as session:
        # 1. Find Source
        print(f"Looking for source: {source_name}")
        source_acc = session.exec(select(Account).where(Account.name == source_name)).first()
        print(f"Source found: {source_acc}")
        
        if source_acc:
            print(f"Old Balance: {source_acc.balance}")
            source_acc.balance -= amount
            session.add(source_acc)
            
        # 2. Find Dest
        print(f"Looking for dest: {dest_name}")
        dest_acc = session.exec(select(Account).where(Account.name == dest_name)).first()
        print(f"Dest found: {dest_acc}")
        
        if dest_acc:
            print(f"Old Debt: {dest_acc.balance}")
            dest_acc.balance -= amount
            session.add(dest_acc)
            
        # 3. Create Transaction
        print("Creating Transaction...")
        try:
            tx = Transaction(
                date=date.today(), # Check if this date type is compatible
                amount=amount,
                description="Debug Execution",
                category="Debt Payment",
                account_id=source_acc.id if source_acc else None,
                is_manual=False
            )
            session.add(tx)
            session.commit()
            print("Transaction Committed Successfully!")
        except Exception as e:
            print(f"ERROR: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    debug_execution()
