"""
Transactions Router — Create, list, and sync transactions.
Includes Plaid transaction sync (kept together since they share schemas).
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from datetime import date, timedelta
from typing import List
import uuid

from database import engine
from models import Account, Transaction, TransactionCreate, MovementLog
from helpers import bypass_fk
from auth import get_current_user_id

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

from transaction_classifier import classify_transaction

router = APIRouter(prefix="/api", tags=["transactions"])


@router.post("/transactions", response_model=Transaction)
async def create_transaction(tx: TransactionCreate, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == tx.account_id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # 1. Create Transaction
        db_tx = Transaction(
            account_id=tx.account_id,
            amount=tx.amount,
            description=tx.description,
            category=tx.category,
            date=tx.date,
            user_id=user_id,
        )
        session.add(db_tx)

        # 2. Update Account Balance
        amount_decimal = Decimal(str(tx.amount))
        abs_amount = abs(amount_decimal)

        if account.type == "debt":
            if tx.category == "payment":
                # Cap debt payment at outstanding balance
                abs_amount = min(abs_amount, account.balance)
                account.balance -= abs_amount
            else:
                account.balance += abs_amount
            account.min_payment = calculate_minimum_payment(
                account.balance, account.interest_rate,
                account.interest_type, account.remaining_months,
            )
        else:
            # Guard: prevent negative balance on non-debt accounts
            new_balance = account.balance + amount_decimal
            if new_balance < 0:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "INSUFFICIENT_FUNDS",
                        "message": f"Fondos insuficientes. {account.name} tiene ${account.balance:.2f}, no se puede deducir ${abs(amount_decimal):.2f}.",
                        "account_name": account.name,
                        "current_balance": float(account.balance),
                        "requested_amount": float(abs(amount_decimal)),
                    },
                )
            account.balance = new_balance

        session.add(account)
        with bypass_fk(session):
            session.commit()
        session.refresh(db_tx)
        return db_tx


@router.get("/accounts/{account_id}/transactions", response_model=List[Transaction])
async def get_account_transactions(account_id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == account_id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        return session.exec(
            select(Transaction).where(Transaction.account_id == account_id, Transaction.user_id == user_id)
            .order_by(Transaction.date.desc())
        ).all()


@router.post("/transactions/manual")
async def create_manual_transaction(tx: TransactionCreate, user_id: str = Depends(get_current_user_id)):
    """Manually create a transaction and update account balance."""
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == tx.account_id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        new_tx = Transaction(
            account_id=tx.account_id,
            amount=tx.amount,
            description=tx.description,
            category=tx.category,
            date=tx.date,
            plaid_transaction_id=f"manual-{uuid.uuid4()}",
            user_id=user_id,
        )
        session.add(new_tx)

        abs_amount = abs(Decimal(str(tx.amount)))
        if account.type == "debt":
            if tx.category == "payment":
                # Cap debt payment at outstanding balance
                abs_amount = min(abs_amount, account.balance)
                account.balance -= abs_amount
            else:
                account.balance += abs_amount
            account.min_payment = calculate_minimum_payment(
                account.balance, account.interest_rate,
                account.interest_type, account.remaining_months,
            )
        else:
            amount_decimal = Decimal(str(tx.amount))
            new_balance = account.balance + amount_decimal
            # Guard: prevent negative balance on non-debt accounts
            if new_balance < 0:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "INSUFFICIENT_FUNDS",
                        "message": f"Fondos insuficientes. {account.name} tiene ${account.balance:.2f}, no se puede deducir ${abs(amount_decimal):.2f}.",
                        "account_name": account.name,
                        "current_balance": float(account.balance),
                        "requested_amount": float(abs(amount_decimal)),
                    },
                )
            account.balance = new_balance

        session.add(account)
        with bypass_fk(session):
            session.commit()
        session.refresh(new_tx)
        return new_tx


@router.get("/transactions/recent", response_model=List[Transaction])
async def get_recent_transactions(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    """Fetch most recent transactions for current user."""
    with Session(engine) as session:
        return session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
            .order_by(Transaction.date.desc()).limit(limit)
        ).all()


@router.get("/transactions/all")
async def get_all_transactions(
    account_id: int = None,
    category: str = None,
    date_from: str = None,
    date_to: str = None,
    search: str = None,
    limit: int = 100,
    offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    """Full transaction history with filtering, search, and pagination."""
    with Session(engine) as session:
        query = select(Transaction).where(Transaction.user_id == user_id)

        if account_id:
            query = query.where(Transaction.account_id == account_id)
        if category:
            query = query.where(Transaction.category == category)
        if date_from:
            query = query.where(Transaction.date >= date_from)
        if date_to:
            query = query.where(Transaction.date <= date_to)
        if search:
            query = query.where(Transaction.description.ilike(f"%{search}%"))

        # Count total before pagination
        from sqlalchemy import func
        count_query = select(func.count()).select_from(query.subquery())
        total = session.exec(count_query).one()

        results = session.exec(
            query.order_by(Transaction.date.desc()).offset(offset).limit(limit)
        ).all()

        # Get account names for mapping
        account_ids = list(set(tx.account_id for tx in results if tx.account_id))
        accounts = {}
        if account_ids:
            accs = session.exec(select(Account).where(Account.id.in_(account_ids))).all()
            accounts = {a.id: a.name for a in accs}

        return {
            "transactions": [
                {
                    "id": tx.id,
                    "date": tx.date,
                    "amount": float(tx.amount),
                    "description": tx.description,
                    "category": tx.category,
                    "account_id": tx.account_id,
                    "account_name": accounts.get(tx.account_id, "Unknown"),
                }
                for tx in results
            ],
            "total": total,
            "limit": limit,
            "offset": offset,
        }


# ── PLAID SYNC (kept here with transactions) ──────────────────

from pydantic import BaseModel

class PlaidPublicToken(BaseModel):
    public_token: str

class PlaidAccessToken(BaseModel):
    access_token: str

# In-memory token storage (production: persist to DB)
plaid_tokens: dict = {}


@router.get("/plaid/create_link_token")
def api_create_link_token():
    """Create a Plaid Link token for the frontend."""
    try:
        from plaid_service import create_link_token
        result = create_link_token()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plaid/exchange_public_token")
def api_exchange_public_token(data: PlaidPublicToken):
    """Exchange public token for access token after user links bank."""
    try:
        from plaid_service import exchange_public_token
        result = exchange_public_token(data.public_token)
        plaid_tokens["current"] = result["access_token"]
        return {"success": True, "item_id": result["item_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plaid/accounts")
def api_get_plaid_accounts():
    """Fetch accounts from Plaid using stored access token."""
    access_token = plaid_tokens.get("current")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")
    try:
        from plaid_service import get_accounts as plaid_get_accounts
        accounts = plaid_get_accounts(access_token)
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plaid/import_accounts")
async def api_import_plaid_accounts(user_id: str = Depends(get_current_user_id)):
    """Import Plaid accounts into database."""
    access_token = plaid_tokens.get("current")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")

    try:
        from plaid_service import get_accounts as plaid_get_accounts
        plaid_accounts = plaid_get_accounts(access_token)
        imported = []

        with Session(engine) as session:
            for acc in plaid_accounts:
                existing_account = session.exec(
                    select(Account).where(Account.plaid_account_id == acc["plaid_account_id"], Account.user_id == user_id)
                ).first()

                if existing_account:
                    existing_account.balance = Decimal(str(abs(acc["balance"])))
                    existing_account.name = f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name']
                    continue

                korex_type = "checking"
                if acc["type"] == "credit":
                    korex_type = "debt"
                elif acc["type"] == "depository":
                    korex_type = "checking" if acc["subtype"] in ["checking", None] else "savings"

                new_account = Account(
                    name=f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name'],
                    type=korex_type,
                    balance=Decimal(str(abs(acc["balance"]))),
                    interest_rate=Decimal("0"),
                    min_payment=Decimal("0"),
                    payment_frequency="monthly",
                    plaid_account_id=acc["plaid_account_id"],
                    user_id=user_id,
                )
                session.add(new_account)
                imported.append(new_account.name)

            with bypass_fk(session):
                session.commit()

        return {"success": True, "imported": imported, "count": len(imported)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/plaid/sync_transactions")
async def api_sync_transactions(data: PlaidAccessToken, user_id: str = Depends(get_current_user_id)):
    """Sync transactions from Plaid and persist to DB."""
    try:
        from plaid_service import sync_transactions
        result = sync_transactions(data.access_token)
        counts = {"added": 0, "skipped": 0}

        with Session(engine) as session:
            accounts = session.exec(
                select(Account).where(Account.plaid_account_id != None, Account.user_id == user_id)
            ).all()
            account_map = {acc.plaid_account_id: acc.id for acc in accounts}

            for tx in result.get("added", []):
                local_account_id = account_map.get(tx["plaid_account_id"])
                if not local_account_id:
                    counts["skipped"] += 1
                    continue

                existing = session.exec(
                    select(Transaction).where(Transaction.plaid_transaction_id == tx["plaid_transaction_id"])
                ).first()
                if existing:
                    counts["skipped"] += 1
                    continue

                plaid_amount = Decimal(str(tx["amount"]))
                classification = classify_transaction(
                    amount=plaid_amount,
                    name=tx["name"],
                    merchant_name=tx.get("merchant_name"),
                    category=tx.get("category"),
                )

                smart_category = f"{classification['tag'].title()}: {tx['category']}"
                korex_amount = plaid_amount * Decimal("-1")

                new_tx = Transaction(
                    account_id=local_account_id,
                    date=tx["date"],
                    amount=korex_amount,
                    description=tx["name"],
                    category=smart_category,
                    plaid_transaction_id=tx["plaid_transaction_id"],
                    user_id=user_id,
                )
                session.add(new_tx)
                counts["added"] += 1

            with bypass_fk(session):
                session.commit()

            # --- AUTO-VERIFICATION LOGIC ---
            pending_logs = session.exec(
                select(MovementLog).where(MovementLog.status == "executed", MovementLog.user_id == user_id)
            ).all()
            for log in pending_logs:
                log_date = date.fromisoformat(log.date_executed)
                start_window = (log_date - timedelta(days=3)).isoformat()
                end_window = (log_date + timedelta(days=3)).isoformat()

                match = session.exec(
                    select(Transaction).where(
                        Transaction.amount == log.amount,
                        Transaction.date >= start_window,
                        Transaction.date <= end_window,
                    )
                ).first()

                if match:
                    log.status = "verified"
                    log.verified_transaction_id = match.id
                    session.add(log)

            with bypass_fk(session):
                session.commit()

        return {
            "success": True,
            "added": counts["added"],
            "skipped": counts["skipped"],
            "has_more": result.get("has_more", False),
            "next_cursor": result.get("next_cursor"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

