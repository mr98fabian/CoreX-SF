"""
Suscripciones — the user's recurring charges (Netflix, gym…), not the KoreX
plan (that is routers/subscriptions.py, same /api/subscriptions prefix but
other paths). Session or kx_ token: read with read:accounts, writes with
write:accounts (token writes leave an audit summary). DELETE is soft
(status=cancelled) so the history keeps "Ya no pagas".
Totals are computed here, active only, normalised to a month.
"""
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from database import request_session
from api_tokens import require_scope, audit_summary
from logos import clean_logo
from models import Account, RecurringSubscription
from velocity_engine import monthly_amount

router = APIRouter(prefix="/api/subscriptions", tags=["recurring-subscriptions"])

Freq = Literal["monthly", "annual", "weekly"]
CENT = Decimal("0.01")


class SubCreate(BaseModel):
    name: str = PField(min_length=1, max_length=80)
    amount: Decimal = PField(gt=0, max_digits=14, decimal_places=2)
    frequency: Freq = "monthly"
    next_charge_date: Optional[date] = None
    account_id: Optional[int] = None
    logo_url: Optional[str] = None


class SubUpdate(BaseModel):
    name: Optional[str] = PField(default=None, min_length=1, max_length=80)
    amount: Optional[Decimal] = PField(default=None, gt=0, max_digits=14, decimal_places=2)
    frequency: Optional[Freq] = None
    next_charge_date: Optional[date] = None
    account_id: Optional[int] = None
    logo_url: Optional[str] = None
    status: Optional[Literal["active", "cancelled"]] = None


def monthly_equivalent(amount: Decimal, frequency: str) -> Decimal:
    """Same table as cashflow (velocity_engine.monthly_amount)."""
    return monthly_amount(amount, frequency)


def summarize(items) -> dict:
    monthly = sum((monthly_equivalent(s.amount, s.frequency) for s in items if s.status == "active"), Decimal("0"))
    return {"monthly_total": str(monthly.quantize(CENT)), "annual_total": str((monthly * 12).quantize(CENT))}


def _sort_key(s: RecurringSubscription):
    return (s.status != "active", s.next_charge_date is None, s.next_charge_date or "", s.name.lower())


def _owned_account(session, user_id: str, account_id: Optional[int]) -> Optional[Account]:
    if account_id is None:
        return None
    acc = session.exec(select(Account).where(Account.id == account_id, Account.user_id == user_id)).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    return acc


def _public(s: RecurringSubscription, accounts: dict) -> dict:
    return {
        "id": s.id, "name": s.name, "amount": str(s.amount), "frequency": s.frequency,
        "monthly_equivalent": str(monthly_equivalent(s.amount, s.frequency).quantize(CENT)),
        "next_charge_date": s.next_charge_date, "account_id": s.account_id,
        "account_name": accounts.get(s.account_id), "logo_url": s.logo_url, "status": s.status,
    }


def _get(session, user_id: str, sub_id: int) -> RecurringSubscription:
    row = session.exec(select(RecurringSubscription).where(
        RecurringSubscription.id == sub_id, RecurringSubscription.user_id == user_id)).first()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return row


def _accounts(session, user_id: str) -> dict:
    return {a.id: a.name for a in session.exec(select(Account).where(Account.user_id == user_id)).all()}


@router.get("")
def list_subscriptions(user_id: str = Depends(require_scope("read:accounts"))):
    with request_session() as session:
        rows = sorted(session.exec(select(RecurringSubscription).where(RecurringSubscription.user_id == user_id)).all(), key=_sort_key)
        accounts = _accounts(session, user_id)
        return {"items": [_public(s, accounts) for s in rows], **summarize(rows)}


@router.post("")
def create_subscription(body: SubCreate, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        _owned_account(session, user_id, body.account_id)
        row = RecurringSubscription(
            user_id=user_id, name=body.name.strip(), amount=body.amount, frequency=body.frequency,
            next_charge_date=body.next_charge_date.isoformat() if body.next_charge_date else None,
            account_id=body.account_id, logo_url=clean_logo(body.logo_url))
        session.add(row)
        session.commit()
        session.refresh(row)
        audit_summary(f"Agregó la suscripción {row.name} · ${row.amount:,.2f} {row.frequency}")
        return _public(row, _accounts(session, user_id))


@router.patch("/{sub_id:int}")
def update_subscription(sub_id: int, body: SubUpdate, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        row = _get(session, user_id, sub_id)
        changes = body.model_dump(exclude_unset=True)
        if "account_id" in changes:
            _owned_account(session, user_id, changes["account_id"])
        for field, value in changes.items():
            if field == "logo_url":
                value = clean_logo(value)
            elif field == "next_charge_date" and value is not None:
                value = value.isoformat()
            elif field == "name" and value is not None:
                value = value.strip()
            if value is None and field in ("name", "amount", "frequency", "status"):
                continue
            setattr(row, field, value)
        session.add(row)
        session.commit()
        session.refresh(row)
        audit_summary(f"{row.name} · editó {', '.join(sorted(changes)) or 'nada'}")
        return _public(row, _accounts(session, user_id))


@router.delete("/{sub_id:int}")
def cancel_subscription(sub_id: int, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        row = _get(session, user_id, sub_id)
        row.status = "cancelled"
        session.add(row)
        session.commit()
        session.refresh(row)
        audit_summary(f"Canceló la suscripción {row.name}")
        return _public(row, _accounts(session, user_id))
