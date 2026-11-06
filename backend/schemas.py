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
    logo_url: Optional[str] = None


class CashflowUpdate(BaseModel):
    """Partial cashflow update (income/expense item); id and user_id are not editable."""
    name: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    frequency: Optional[str] = None
    is_variable: Optional[bool] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None
    date_specific_1: Optional[int] = None
    date_specific_2: Optional[int] = None
    month_of_year: Optional[int] = None
    account_id: Optional[int] = None
    is_income: Optional[bool] = None
