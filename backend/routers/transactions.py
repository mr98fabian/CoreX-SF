"""
Transactions Router — Create and list transactions (in-app Plaid is disabled).
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from typing import List
import uuid

from database import engine
from database import request_session
from models import Account, Transaction, TransactionCreate
from helpers import bypass_fk, update_account_balance
from auth import get_current_user_id
from api_tokens import require_scope, audit_summary
import audit_text

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

from routers.engagement import award_once

from velocity_engine import payment_impact
from helpers import is_payment_category

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
    if (tx.category or "").lower() in ("payment", "debt payment") and Decimal(str(tx.amount)) > 0:
        award_once(session, user_id, "payment", f"tx:{db_tx.id}")  # habit points, never by amount
        session.commit()
    if funding is not None:
        audit_summary(audit_text.transaction_recorded(applied, tx.category, account.name, funding.name))
    else:
        audit_summary(audit_text.transaction_recorded(tx.amount, tx.category, account.name))
    return {**db_tx.model_dump(), "funding_applied": funding is not None}


@router.post("/transactions")
def create_transaction(tx: TransactionCreate, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        return _create_tx_record(session, tx, user_id)


@router.post("/transactions/manual")
def create_manual_transaction(tx: TransactionCreate, user_id: str = Depends(require_scope("write:payments"))):
    with request_session() as session:
        return _create_tx_record(session, tx, user_id, manual=True)


# ── Transaction Queries ──────────────────────────────────────

@router.get("/accounts/{account_id}/transactions", response_model=List[Transaction])
def get_account_transactions(account_id: int, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        if not session.exec(select(Account).where(Account.id == account_id, Account.user_id == user_id)).first():
            raise HTTPException(status_code=404, detail="Account not found")
        return session.exec(
            select(Transaction).where(Transaction.account_id == account_id, Transaction.user_id == user_id)
            .order_by(Transaction.date.desc())
        ).all()


@router.get("/transactions/recent", response_model=List[Transaction])
def get_recent_transactions(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        return session.exec(
            select(Transaction).where(Transaction.user_id == user_id)
            .order_by(Transaction.date.desc()).limit(limit)
        ).all()


@router.get("/transactions/all")
def get_all_transactions(
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

        rows = {a.id: a for a in session.exec(
            select(Account).where(Account.id.in_({tx.account_id for tx in results if tx.account_id}))
        ).all()} if results else {}

        def impact(tx):
            # A payment to a debt: what it stops costing (engine, estimate). The client never computes it.
            a = rows.get(tx.account_id)
            if a is None or a.type != "debt" or not is_payment_category(tx.category) or Decimal(str(tx.amount)) <= 0:
                return None
            return payment_impact(abs(Decimal(str(tx.amount))), a.interest_rate)

        return {
            "transactions": [
                {"id": tx.id, "date": tx.date, "amount": float(tx.amount),
                 "description": tx.description, "category": tx.category,
                 "account_id": tx.account_id, "account_name": rows[tx.account_id].name if tx.account_id in rows else "Unknown",
                 "impacto": impact(tx)}
                for tx in results
            ],
            "total": total, "limit": limit, "offset": offset,
        }


# ── Plaid (disabled) ─────────────────────────────────────────
# Plaid inside the app is disabled by product decision (2026-11-09): bank connections
# live in the user's own AI (via MCP). Mission 20 (H-01) removed the /api/plaid/* routes,
# which skipped auth and shared one process-global access token across users.
# Turning this on requires per-user token storage (S-05) and Fabian's yes; until then
# there are no routes to mount, so flipping the switch fails at import time.
PLAID_IN_APP_ENABLED = False
if PLAID_IN_APP_ENABLED:
    raise RuntimeError("Plaid in-app needs per-user token storage (S-05) first; see Mission 20.")
