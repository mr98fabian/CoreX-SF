"""
Accounts Router — CRUD operations for financial accounts.
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from decimal import Decimal
from typing import List

from database import engine
from database import request_session
from models import Account, Transaction, MovementLog, CashflowItem, UserSettings, CutHistory
from schemas import BalanceUpdate, AccountUpdate
from helpers import bypass_fk, filter_active_debt_accounts
from plan_guard import scoped_plan_limit
from velocity_engine import credit_panel, utilization_band
from auth import get_current_user_id
from api_tokens import require_scope, audit_summary
import audit_text
from logos import clean_logo

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

router = APIRouter(prefix="/api", tags=["accounts"])


@router.get("/accounts", response_model=List[Account])
async def get_accounts(user_id: str = Depends(require_scope("read:accounts"))):
    with request_session() as session:
        return session.exec(select(Account).where(Account.user_id == user_id)).all()


def _pct(x):
    return None if x is None else float(x.quantize(Decimal("0.1")))


def _money(x):
    return float(x.quantize(Decimal("0.01")))


@router.get("/accounts/credit-panel")
async def get_credit_panel(user_id: str = Depends(require_scope("read:accounts")),
                           plan_limit: int | None = Depends(scoped_plan_limit)):
    """Panel de crédito: totals and utilization of the user's credit cards.
    Only debt_subtype='credit_card'; plan-locked cards (same set the engine
    drops) are out. The math lives in velocity_engine.credit_panel."""
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    active = {a.id for a in filter_active_debt_accounts(accounts, plan_limit)}
    cards = [a for a in accounts if a.type == "debt" and (a.debt_subtype or "") == "credit_card"
             and not (a.balance > 0 and a.id not in active)]
    p = credit_panel((a.id, a.balance, a.credit_limit) for a in cards)
    g = p["utilizacion_global"]
    return {
        "active": bool(p["por_tarjeta"]),
        "limite_total": _money(p["limite_total"]), "usado": _money(p["usado"]), "disponible": _money(p["disponible"]),
        "utilizacion_global": _pct(g), "banda_global": utilization_band(g),
        "por_tarjeta": {str(k): {"pct": _pct(v), "banda": utilization_band(v)} for k, v in p["por_tarjeta"].items()},
        "sin_limite": p["sin_limite"],
        "etiqueta": "estimado",
        "nota": "Utilización actual estimada; el buró ve el saldo que tu tarjeta reporta, normalmente el del corte.",
    }


@router.post("/accounts", response_model=Account)
async def create_account(account: Account, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        account.user_id = user_id
        account.id = None  # never let the client pick (or collide with) a primary key
        account.logo_url = clean_logo(account.logo_url)
        if account.type == "debt":
            if account.min_payment is None or account.min_payment == 0:
                account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        audit_summary(audit_text.account_created(account))  # no-op unless written by the user's AI
        return account


DECIMAL_FIELDS = {"balance", "interest_rate", "min_payment", "credit_limit"}


@router.put("/accounts/{id}", response_model=Account)
async def update_account(id: int, data: AccountUpdate, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        # Ownership checked in the query: someone else's account is a plain 404
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        before = audit_text.snapshot(account)
        for field, value in data.model_dump(exclude_unset=True).items():
            if field in DECIMAL_FIELDS and value is not None:
                value = Decimal(str(value))
            if field == "logo_url":
                value = clean_logo(value)
            setattr(account, field, value)

        if account.type == "debt" and (account.min_payment is None or account.min_payment == 0):
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        audit_summary(audit_text.account_updated(before, account))
        return account


@router.patch("/accounts/{id}/balance", response_model=Account)
async def update_account_balance(id: int, data: BalanceUpdate, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
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
    with request_session() as session:
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
        for cut in session.exec(select(CutHistory).where(CutHistory.account_id == id, CutHistory.user_id == user_id)).all():
            session.delete(cut)
        item_name = item.name
        session.delete(item)
        session.commit()
        audit_summary(audit_text.account_deleted(item_name, len(tx_ids)))
        return {"ok": True, "deleted_account_id": id, "deleted_transactions": len(tx_ids)}


@router.delete("/accounts")
async def delete_all_accounts(user_id: str = Depends(get_current_user_id)):
    """HARD RESET: Wipe all user's financial data for a fresh start.

    Clears: accounts, transactions, movement logs, cashflow items, onboarding state.
    PRESERVES: subscription (a paying customer keeps their plan).
    """
    try:
        with request_session() as session:
            # 1. Movement logs (references transactions via FK)
            logs = session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()
            for log in logs:
                session.delete(log)

            # 2. Transactions (references accounts via FK)
            transactions = session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
            for tx in transactions:
                session.delete(tx)

            # 3. Cashflow items (references accounts via FK)
            cashflows = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
            for cf in cashflows:
                session.delete(cf)

            # 4. Accounts
            accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
            for acc in accounts:
                session.delete(acc)

            # 5. Reset onboarding so user goes through setup again
            settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
            if settings:
                settings.onboarding_complete = False
                session.add(settings)

            # NOTE: Subscription is intentionally NOT touched.
            # A paying customer keeps their plan after reset.

            session.commit()
        return {"ok": True, "message": "System Hard Reset Complete"}
    except Exception:
        logging.getLogger("korex.accounts").exception("Hard reset failed")
        raise HTTPException(status_code=500, detail="Reset failed. Please try again.")
