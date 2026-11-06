"""
Transactions Router — Create, list, sync, and Plaid integration.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from datetime import date, timedelta
from typing import List
import uuid

from database import engine
from database import request_session
from models import Account, Transaction, TransactionCreate, MovementLog
from helpers import bypass_fk, update_account_balance
from auth import get_current_user_id
from api_tokens import require_scope, audit_summary
import audit_text

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment
from transaction_classifier import classify_transaction

router = APIRouter(prefix="/api", tags=["transactions"])


# ── Core Transaction Creation ────────────────────────────────

def _create_tx_record(session, tx: TransactionCreate, user_id: str, manual: bool = False) -> dict:
    """Create transaction + update account balance(s). Returns the transaction plus
    `funding_applied`.

    Two-sided payment (2026-11-06): a payment with `funding_account_id` lowers the
    debt AND the non-debt account the money left from, by the SAME applied amount
    (capped at the debt balance). Everything is validated before any mutation, and
    both sides commit in one session: all or nothing. Without it, legacy behaviour."""
    account = session.exec(
        select(Account).where(Account.id == tx.account_id, Account.user_id == user_id)
    ).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    funding = None
    if tx.category == "payment" and tx.funding_account_id is not None:
        if tx.funding_account_id == tx.account_id:
            raise HTTPException(status_code=400, detail="La cuenta de origen no puede ser la misma que la de destino.")
        funding = session.exec(
            select(Account).where(Account.id == tx.funding_account_id, Account.user_id == user_id)
        ).first()
        if not funding:
            raise HTTPException(status_code=404, detail="Funding account not found")
        if funding.type == "debt":
            raise HTTPException(status_code=400, detail="La cuenta de origen debe ser una cuenta de dinero, no una deuda.")
        requested = abs(Decimal(str(tx.amount)))
        applied = min(requested, account.balance) if account.type == "debt" else requested
        if funding.balance < applied:
            raise HTTPException(status_code=400, detail={
                "code": "INSUFFICIENT_FUNDS",
                "message": f"Fondos insuficientes. {funding.name} tiene ${funding.balance:,.2f}; el pago aplicado es ${applied:,.2f}.",
                "account_name": funding.name,
            })

    db_tx = Transaction(
        account_id=tx.account_id, amount=tx.amount, description=tx.description,
        category=tx.category, date=tx.date, user_id=user_id,
        plaid_transaction_id=f"manual-{uuid.uuid4()}" if manual else None,
    )
    session.add(db_tx)
    applied = update_account_balance(account, Decimal(str(tx.amount)), tx.category)
    if funding is not None:
        funding.balance -= applied
        session.add(funding)
    # Revolving debt: the minimum moves with the balance. Fixed loans keep their
    # contractual installment. (The deployed core_engine takes (balance, apr) only;
    # the old 4-arg call raised TypeError, so every payment to a debt returned 500.)
    if account.type == "debt" and account.interest_type != "fixed":
        account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
    session.add(account)
    with bypass_fk(session):
        session.commit()
    session.refresh(db_tx)
    if funding is not None:
        audit_summary(audit_text.transaction_recorded(applied, tx.category, account.name, funding.name))
    else:
        audit_summary(audit_text.transaction_recorded(tx.amount, tx.category, account.name))
    return {**db_tx.model_dump(), "funding_applied": funding is not None}


@router.post("/transactions")
async def create_transaction(tx: TransactionCreate, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        return _create_tx_record(session, tx, user_id)


@router.post("/transactions/manual")
async def create_manual_transaction(tx: TransactionCreate, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        return _create_tx_record(session, tx, user_id, manual=True)


# ── Transaction Queries ──────────────────────────────────────

@router.get("/accounts/{account_id}/transactions", response_model=List[Transaction])
async def get_account_transactions(account_id: int, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        if not session.exec(select(Account).where(Account.id == account_id, Account.user_id == user_id)).first():
            raise HTTPException(status_code=404, detail="Account not found")
        return session.exec(
            select(Transaction).where(Transaction.account_id == account_id, Transaction.user_id == user_id)
            .order_by(Transaction.date.desc())
        ).all()


@router.get("/transactions/recent", response_model=List[Transaction])
async def get_recent_transactions(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        return session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
            .order_by(Transaction.date.desc()).limit(limit)
        ).all()


@router.get("/transactions/all")
async def get_all_transactions(
    account_id: int = None, category: str = None, date_from: str = None,
    date_to: str = None, search: str = None, limit: int = 100, offset: int = 0,
    user_id: str = Depends(get_current_user_id),
):
    with request_session() as session:
        query = select(Transaction).where(Transaction.user_id == user_id)
        if account_id: query = query.where(Transaction.account_id == account_id)
        if category:   query = query.where(Transaction.category == category)
        if date_from:  query = query.where(Transaction.date >= date_from)
        if date_to:    query = query.where(Transaction.date <= date_to)
        if search:     query = query.where(Transaction.description.ilike(f"%{search}%"))

        from sqlalchemy import func
        total = session.exec(select(func.count()).select_from(query.subquery())).one()
        results = session.exec(query.order_by(Transaction.date.desc()).offset(offset).limit(limit)).all()

        accs = {a.id: a.name for a in session.exec(
            select(Account).where(Account.id.in_({tx.account_id for tx in results if tx.account_id}))
        ).all()} if results else {}

        return {
            "transactions": [
                {"id": tx.id, "date": tx.date, "amount": float(tx.amount),
                 "description": tx.description, "category": tx.category,
                 "account_id": tx.account_id, "account_name": accs.get(tx.account_id, "Unknown")}
                for tx in results
            ],
            "total": total, "limit": limit, "offset": offset,
        }


# ── Plaid Integration ────────────────────────────────────────

from pydantic import BaseModel

class PlaidPublicToken(BaseModel): public_token: str
class PlaidAccessToken(BaseModel): access_token: str

plaid_tokens: dict = {}


def _plaid_call(fn_name: str, *args, fallback_msg: str = "Plaid service error"):
    try:
        from plaid_service import create_link_token, exchange_public_token, get_accounts, sync_transactions
        return {"create_link_token": create_link_token, "exchange_public_token": exchange_public_token,
                "get_accounts": get_accounts, "sync_transactions": sync_transactions}[fn_name](*args)
    except Exception:
        logging.getLogger("korex.transactions").exception("Plaid call %s failed", fn_name)
        raise HTTPException(status_code=500, detail=fallback_msg)


@router.get("/plaid/create_link_token")
def api_create_link_token():
    return _plaid_call("create_link_token")


@router.post("/plaid/exchange_public_token")
def api_exchange_public_token(data: PlaidPublicToken):
    result = _plaid_call("exchange_public_token", data.public_token)
    plaid_tokens["current"] = result["access_token"]
    return {"success": True, "item_id": result["item_id"]}


@router.get("/plaid/accounts")
def api_get_plaid_accounts():
    token = plaid_tokens.get("current")
    if not token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")
    return {"accounts": _plaid_call("get_accounts", token)}


@router.post("/plaid/import_accounts")
async def api_import_plaid_accounts(user_id: str = Depends(get_current_user_id)):
    token = plaid_tokens.get("current")
    if not token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")

    plaid_accounts = _plaid_call("get_accounts", token)
    imported = []

    with request_session() as session:
        for acc in plaid_accounts:
            existing = session.exec(
                select(Account).where(Account.plaid_account_id == acc["plaid_account_id"], Account.user_id == user_id)
            ).first()
            name = f"{acc['name']} (...{acc['mask']})" if acc.get('mask') else acc['name']
            if existing:
                existing.balance = Decimal(str(abs(acc["balance"])))
                existing.name = name
                continue

            korex_type = "debt" if acc["type"] == "credit" else (
                "checking" if acc.get("subtype") in ["checking", None] else "savings"
            )
            session.add(Account(
                name=name, type=korex_type, balance=Decimal(str(abs(acc["balance"]))),
                interest_rate=Decimal("0"), min_payment=Decimal("0"), payment_frequency="monthly",
                plaid_account_id=acc["plaid_account_id"], user_id=user_id,
            ))
            imported.append(name)

        with bypass_fk(session):
            session.commit()
    return {"success": True, "imported": imported, "count": len(imported)}


@router.post("/plaid/sync_transactions")
async def api_sync_transactions(data: PlaidAccessToken, user_id: str = Depends(get_current_user_id)):
    result = _plaid_call("sync_transactions", data.access_token)
    counts = {"added": 0, "skipped": 0}

    with request_session() as session:
        accounts = session.exec(
            select(Account).where(Account.plaid_account_id != None, Account.user_id == user_id)
        ).all()
        account_map = {acc.plaid_account_id: acc.id for acc in accounts}

        for tx in result.get("added", []):
            local_id = account_map.get(tx["plaid_account_id"])
            if not local_id:
                counts["skipped"] += 1; continue
            if session.exec(select(Transaction).where(Transaction.plaid_transaction_id == tx["plaid_transaction_id"])).first():
                counts["skipped"] += 1; continue

            classification = classify_transaction(
                amount=Decimal(str(tx["amount"])), name=tx["name"],
                merchant_name=tx.get("merchant_name"), category=tx.get("category"),
            )
            session.add(Transaction(
                account_id=local_id, date=tx["date"],
                amount=Decimal(str(tx["amount"])) * Decimal("-1"),
                description=tx["name"],
                category=f"{classification['tag'].title()}: {tx['category']}",
                plaid_transaction_id=tx["plaid_transaction_id"], user_id=user_id,
            ))
            counts["added"] += 1

        with bypass_fk(session):
            session.commit()

        # Auto-verify pending movement logs
        for log in session.exec(select(MovementLog).where(MovementLog.status == "executed", MovementLog.user_id == user_id)).all():
            match = session.exec(
                select(Transaction).where(
                    Transaction.amount == log.amount,
                    Transaction.date >= (date.fromisoformat(log.date_executed) - timedelta(days=3)).isoformat(),
                    Transaction.date <= (date.fromisoformat(log.date_executed) + timedelta(days=3)).isoformat(),
                )
            ).first()
            if match:
                log.status = "verified"
                log.verified_transaction_id = match.id
                session.add(log)
        with bypass_fk(session):
            session.commit()

    return {
        "success": True, "added": counts["added"], "skipped": counts["skipped"],
        "has_more": result.get("has_more", False), "next_cursor": result.get("next_cursor"),
    }
