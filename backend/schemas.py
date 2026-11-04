"""
Shared Pydantic schemas used across multiple routers.
Keeps request/response models in one place to avoid circular imports.
"""
from typing import Optional
from pydantic import BaseModel


class BalanceUpdate(BaseModel):
    balance: float


class ShieldUpdate(BaseModel):
    target: float


class MovementExecute(BaseModel):
    movement_key: str
    title: str
    amount: float
    date_planned: str
    source: str
    destination: str


class SimulatorRequest(BaseModel):
    amount: float


class AccountUpdate(BaseModel):
    """Partial account update: only fields present in the body change. id and
    user_id are not part of the schema, so a client can never move or re-key
    an account (extra keys are ignored)."""
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[float] = None
    interest_rate: Optional[float] = None
    min_payment: Optional[float] = None
    credit_limit: Optional[float] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None
    interest_type: Optional[str] = None
    payment_frequency: Optional[str] = None
    debt_subtype: Optional[str] = None
