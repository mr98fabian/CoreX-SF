from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from sqlmodel import Field, SQLModel, Relationship, Column, JSON
from sqlalchemy import Text
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
    
    # Credit Card / Revolving Specific
    credit_limit: Optional[Decimal] = Field(default=None, max_digits=14, decimal_places=2, description="Credit limit for revolving accounts (credit cards, HELOCs)")
    apy: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2, description="Annual Percentage Yield for savings/checking accounts")
    logo_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))  # official logo (Plaid): https or data:image base64
    
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

    # Auto-execute support
    account_id: Optional[int] = Field(default=None, foreign_key="accounts.id")
    is_income: bool = Field(default=False)
    last_executed_date: Optional[str] = Field(default=None, description="ISO date of last auto-execution")
    snooze_until: Optional[str] = Field(default=None, description="ISO datetime until which this item's confirmation is snoozed")

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

class Subscription(SQLModel, table=True):
    __tablename__ = "subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False, unique=True))
    plan: str = Field(default="starter", description="starter, velocity, accelerator, freedom")
    status: str = Field(default="active", description="active, cancelled, past_due, expired, paused")
    ls_subscription_id: Optional[str] = Field(default=None, index=True)
    ls_customer_id: Optional[str] = Field(default=None)
    current_period_end: Optional[str] = Field(default=None, description="ISO 8601 datetime")
    update_payment_method_url: Optional[str] = Field(default=None)
    customer_portal_url: Optional[str] = Field(default=None)
    created_at: Optional[str] = Field(default=None)
    updated_at: Optional[str] = Field(default=None)

class UserSettings(SQLModel, table=True):
    __tablename__ = "user_settings"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False, unique=True))
    onboarding_complete: bool = Field(default=False)
    shield_target: Decimal = Field(default=Decimal("1000.00"), max_digits=14, decimal_places=2)
    attack_percentage: Decimal = Field(default=Decimal("20"), max_digits=5, decimal_places=2)


class TransactionCreate(SQLModel):
    account_id: int
    amount: Decimal
    description: str
    category: str
    date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    # Two-sided payment: the non-debt account the money leaves from (optional, legacy = None)
    funding_account_id: Optional[int] = None



class ApiToken(SQLModel, table=True):
    """Personal API token. Only the SHA-256 of the token is stored; the plain
    value is shown once at creation and never persisted or logged."""
    __tablename__ = "api_tokens"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    name: str
    token_hash: str = Field(index=True, unique=True, max_length=64)
    scopes: List[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: Optional[datetime] = Field(default=None)
    revoked_at: Optional[datetime] = Field(default=None)


class ApiTokenAudit(SQLModel, table=True):
    """Every write performed with an API token (who, which token, what, when)."""
    __tablename__ = "api_token_audit"
    id: Optional[int] = Field(default=None, primary_key=True)
    token_id: int = Field(index=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    action: str
    detail: Optional[str] = Field(default=None)   # the scope used (e.g. write:accounts)
    summary: Optional[str] = Field(default=None)  # what changed, in plain words (set by the handler)
    note: Optional[str] = Field(default=None, max_length=140)  # the AI's "why" (X-Korex-Note header)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SyncState(SQLModel, table=True):
    """When the user's bank data was last synced (one row per user). Written only
    by POST /api/sync/mark; GET /api/sync/status never invents a time."""
    __tablename__ = "sync_state"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False, unique=True))
    last_sync_at: Optional[datetime] = Field(default=None)   # UTC, naive
    last_source: Optional[str] = Field(default=None, max_length=40)


class RecurringSubscription(SQLModel, table=True):
    """A recurring charge the user pays (Netflix, gym…). Not to be confused with
    `Subscription` (the user's KoreX plan). Cancelling is soft (status), so the
    history shows what the user no longer pays."""
    __tablename__ = "recurring_subscriptions"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    name: str = Field(max_length=80)
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    frequency: str = Field(default="monthly", max_length=10)  # monthly | annual | weekly
    next_charge_date: Optional[str] = Field(default=None, max_length=10)  # YYYY-MM-DD
    account_id: Optional[int] = Field(default=None)
    logo_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(default="active", max_length=10)  # active | cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WebAuthnCredential(SQLModel, table=True):
    """A platform authenticator (fingerprint/face) registered for the local app
    lock. Public key only: the private key never leaves the device."""
    __tablename__ = "webauthn_credentials"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    credential_id: str = Field(max_length=512, unique=True, index=True)  # base64url
    public_key: str = Field(sa_column=Column(Text, nullable=False))      # base64url COSE key
    sign_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WebAuthnChallenge(SQLModel, table=True):
    """One pending challenge per user and purpose, consumed on verify (works across workers)."""
    __tablename__ = "webauthn_challenges"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False))
    purpose: str = Field(max_length=10)  # "register" | "auth"
    challenge: str = Field(max_length=128)  # base64url
    expires_at: datetime


class CoachProfile(SQLModel, table=True):
    """How the user's own AI (via MCP) coaches them: tone, the name the user gave
    it, and payday weekday (weekly review). One row per user, created on first read."""
    __tablename__ = "coach_profiles"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[str] = Field(default=None, sa_column=Column(PG_UUID(as_uuid=False), index=True, nullable=False, unique=True))
    tone: str = Field(default="calido", max_length=10)          # calido | directo | pesado
    ai_name: Optional[str] = Field(default=None, max_length=40)
    payday_weekday: Optional[int] = Field(default=None)         # 0=lunes … 6=domingo
    updated_at: datetime = Field(default_factory=datetime.utcnow)
