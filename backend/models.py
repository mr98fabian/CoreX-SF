from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from sqlmodel import Field, SQLModel, Relationship, Column
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
import uuid

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    shield_target: Decimal = Field(default=1000.00, max_digits=14, decimal_places=2)

class Account(SQLModel, table=True):
    __tablename__ = "accounts"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    name: str
    type: str = Field(description="debt, checking, savings")
    balance: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    interest_rate: Decimal = Field(default=0, max_digits=5, decimal_places=2)
    min_payment: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    payment_frequency: str = Field(default="monthly", description="monthly, biweekly, weekly")
    due_day: Optional[int] = Field(default=None, description="Day of the month the payment is due")
    closing_day: Optional[int] = Field(default=None, description="Day of the month the statement closes")
    is_velocity_target: bool = Field(default=False)
    plaid_account_id: Optional[str] = Field(default=None, index=True)
    
    # Loan Classification Fields
    interest_type: str = Field(default="revolving", description="fixed (amortized) or revolving (daily balance)")
    debt_subtype: str = Field(default="credit_card", description="credit_card, heloc, auto_loan, mortgage, personal_loan, student_loan")
    
    # Fixed-Loan Only Fields (Amortization)
    original_amount: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2, description="Original loan principal")
    loan_term_months: Optional[int] = Field(default=None, description="Total loan term in months")
    remaining_months: Optional[int] = Field(default=None, description="Months remaining on the loan")
    
    transactions: List["Transaction"] = Relationship(back_populates="account")

class CashflowItem(SQLModel, table=True):
    __tablename__ = "cashflow_items"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    name: str
    amount: Decimal = Field(default=0, max_digits=14, decimal_places=2)
    category: str  # "income" or "expense"
    frequency: str = Field(default="monthly") # weekly, biweekly, monthly, annually
    is_variable: bool = Field(default=False)
    
    # Advanced Recurring Fields
    day_of_month: int = Field(default=1) # Default for monthly
    day_of_week: Optional[int] = Field(default=None) # 0=Monday, 6=Sunday
    date_specific_1: Optional[int] = Field(default=None) # e.g. 15
    date_specific_2: Optional[int] = Field(default=None) # e.g. 30
    month_of_year: Optional[int] = Field(default=None) # 1-12 for annual

class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    account_id: Optional[int] = Field(default=None, foreign_key="accounts.id")
    date: str # ISO format YYYY-MM-DD
    amount: Decimal = Field(default=0, max_digits=14, decimal_places=2) # Positivo = Ingreso/Pago a Deuda, Negativo = Gasto
    description: str
    category: str # salary, food, rent, payment, etc.
    plaid_transaction_id: Optional[str] = Field(default=None, unique=True, index=True)
    
    account: Optional[Account] = Relationship(back_populates="transactions")

class MovementLog(SQLModel, table=True):
    __tablename__ = "movement_log"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    movement_key: str = Field(index=True) # Unique key for the movement (e.g., "pump-salary-2024-02-01")
    title: str
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    date_planned: str # ISO format
    date_executed: str # ISO format
    status: str = Field(default="executed") # executed, verified
    verified_transaction_id: Optional[int] = Field(default=None, foreign_key="transactions.id")

class TransactionCreate(SQLModel):
    account_id: int
    amount: Decimal
    description: str
    category: str
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))

