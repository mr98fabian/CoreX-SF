from sqlmodel import Session, select
from database import engine
from models import Account, CashflowItem
from velocity_engine import generate_tactical_schedule, DebtAccount, CashflowTactical
from decimal import Decimal

def debug():
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        cashflows = session.exec(select(CashflowItem)).all()
        
        print(f"Found {len(accounts)} accounts and {len(cashflows)} cashflows")
        
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50')
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        cf_tactical = [
            CashflowTactical(
                name=cf.name,
                amount=cf.amount,
                day_of_month=cf.day_of_month,
                category=cf.category
            )
            for cf in cashflows
        ]
        
        checking_balance = sum(acc.balance for acc in accounts if acc.type == "checking")
        heloc_acc = next((acc for acc in accounts if "HELOC" in acc.name.upper()), None)
        heloc_debt = None
        if heloc_acc:
             heloc_debt = DebtAccount(
                name=heloc_acc.name,
                balance=heloc_acc.balance,
                interest_rate=heloc_acc.interest_rate,
                min_payment=heloc_acc.min_payment if heloc_acc.min_payment else Decimal('0')
            )
        
        print("Generating schedule...")
        movements = generate_tactical_schedule(debts, cf_tactical, checking_balance, heloc_debt)
        print(f"Generated {len(movements)} movements")
        for m in movements:
            print(m)

if __name__ == "__main__":
    debug()
