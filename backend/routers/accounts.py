"""
Accounts Router — CRUD operations for financial accounts.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from typing import List

from database import engine
from models import Account, Transaction, MovementLog, CashflowItem, UserSettings
from schemas import BalanceUpdate, AccountUpdate
from helpers import bypass_fk
from auth import get_current_user_id
from api_tokens import require_scope

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

router = APIRouter(prefix="/api", tags=["accounts"])


@router.get("/accounts", response_model=List[Account])
async def get_accounts(user_id: str = Depends(require_scope("read:accounts"))):
    with Session(engine) as session:
        return session.exec(select(Account).where(Account.user_id == user_id)).all()


@router.post("/accounts", response_model=Account)
async def create_account(account: Account, user_id: str = Depends(require_scope("write:accounts"))):
    with Session(engine) as session:
        account.user_id = user_id
        account.id = None  # never let the client pick (or collide with) a primary key
        if account.type == "debt":
            if account.min_payment is None or account.min_payment == 0:
                account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        return account


DECIMAL_FIELDS = {"balance", "interest_rate", "min_payment", "credit_limit"}


@router.put("/accounts/{id}", response_model=Account)
async def update_account(id: int, data: AccountUpdate, user_id: str = Depends(require_scope("write:accounts"))):
    with Session(engine) as session:
        # Ownership checked in the query: someone else's account is a plain 404
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        for field, value in data.model_dump(exclude_unset=True).items():
            if field in DECIMAL_FIELDS and value is not None:
                value = Decimal(str(value))
            setattr(account, field, value)

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
async def delete_account(id: int, user_id: str = Depends(require_scope("write:accounts"))):
    """Delete one of the user's accounts in a single transaction:
    - transactions of the account → deleted (they have no meaning without it);
    - movement_log rows verified against those transactions → kept as history,
      unlinked (verified_transaction_id = NULL, status back to "executed");
    - cashflow_items paying into/out of the account → kept (the income/bill is
      still real), account_id set to NULL so no FK points at a deleted row.
    Someone else's (or a missing) account → 404."""
    with Session(engine) as session:
        item = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not item:
            raise HTTPException(status_code=404, detail="Account not found")

        transactions = session.exec(select(Transaction).where(Transaction.account_id == id, Transaction.user_id == user_id)).all()
        tx_ids = [tx.id for tx in transactions]
        if tx_ids:
            logs = session.exec(select(MovementLog).where(MovementLog.verified_transaction_id.in_(tx_ids), MovementLog.user_id == user_id)).all()
            for log in logs:
                log.verified_transaction_id = None
                log.status = "executed"
                session.add(log)
        for cf in session.exec(select(CashflowItem).where(CashflowItem.account_id == id, CashflowItem.user_id == user_id)).all():
            cf.account_id = None
            session.add(cf)
        session.flush()  # unlink before deleting, so FK checks pass on Postgres

        for tx in transactions:
            session.delete(tx)
        session.delete(item)
        session.commit()
        return {"ok": True, "deleted_account_id": id, "deleted_transactions": len(tx_ids)}
