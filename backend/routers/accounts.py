"""
Accounts Router — CRUD operations for financial accounts.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from typing import List

from database import engine
from models import Account, Transaction, MovementLog
from schemas import BalanceUpdate
from helpers import bypass_fk
from auth import get_current_user_id

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

router = APIRouter(prefix="/api", tags=["accounts"])


@router.get("/accounts", response_model=List[Account])
async def get_accounts(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        return session.exec(select(Account).where(Account.user_id == user_id)).all()


@router.post("/accounts", response_model=Account)
async def create_account(account: Account, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account.user_id = user_id
        if account.type == "debt":
            if account.min_payment is None or account.min_payment == 0:
                account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        return account


@router.put("/accounts/{id}", response_model=Account)
async def update_account(id: int, account_data: Account, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        account.name = account_data.name
        account.balance = account_data.balance
        account.interest_rate = account_data.interest_rate
        account.type = account_data.type
        account.min_payment = account_data.min_payment
        account.due_day = account_data.due_day
        account.closing_day = account_data.closing_day

        if account.type == "debt" and (account.min_payment is None or account.min_payment == 0):
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        return account


@router.patch("/accounts/{id}/balance", response_model=Account)
async def update_account_balance(id: int, data: BalanceUpdate, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        account.balance = Decimal(str(data.balance))
        if account.type == "debt":
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        session.add(account)
        with bypass_fk(session):
            session.commit()
        session.refresh(account)
        return account


@router.delete("/accounts/{id}")
async def delete_account(id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if item:
            transactions = session.exec(select(Transaction).where(Transaction.account_id == id, Transaction.user_id == user_id)).all()
            tx_ids = [tx.id for tx in transactions]

            if tx_ids:
                logs = session.exec(select(MovementLog).where(MovementLog.verified_transaction_id.in_(tx_ids), MovementLog.user_id == user_id)).all()
                for log in logs:
                    log.verified_transaction_id = None
                    log.status = "executed"
                    session.add(log)

            for tx in transactions:
                session.delete(tx)

            session.delete(item)
            session.commit()
        return {"ok": True}


@router.delete("/accounts")
async def delete_all_accounts(user_id: str = Depends(get_current_user_id)):
    """HARD RESET: Wipe all user's accounts, transactions, and movement logs."""
    try:
        with Session(engine) as session:
            logs = session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()
            for log in logs:
                session.delete(log)

            transactions = session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
            for tx in transactions:
                session.delete(tx)

            accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
            for acc in accounts:
                session.delete(acc)

            session.commit()
        return {"ok": True, "message": "System Hard Reset Complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
