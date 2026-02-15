"""
Shared Pydantic schemas used across multiple routers.
Keeps request/response models in one place to avoid circular imports.
"""
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
