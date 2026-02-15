from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, SQLModel, Field
from typing import List, Optional
from database import create_db_and_tables, engine, seed_data, get_session
from models import Account, CashflowItem, Transaction, TransactionCreate, User, MovementLog
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timedelta
from velocity_engine import (
    get_projections, DebtAccount, generate_tactical_schedule, CashflowTactical,
    get_peace_shield_status, calculate_purchase_time_cost, DEFAULT_PEACE_SHIELD,
    calculate_minimum_payment, calculate_safe_attack_equity, Movement,
    simulate_freedom_path, get_velocity_target, generate_action_plan
)
from transaction_classifier import classify_batch, get_cashflow_summary, classify_transaction
import uuid
import os
import httpx

# --- AUTH MIDDLEWARE ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://stvjvmnlhknzyrbbntcp.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate user_id from Supabase JWT via /auth/v1/user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    # ── Demo Mode Bypass (dev/testing only) ──────────────────
    DEMO_TOKEN = "demo-stress-test-token"
    DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"
    if token == DEMO_TOKEN:
        return DEMO_USER_ID
    
    # Supabase /auth/v1/user requires a valid 'apikey' header (anon key or service key).
    # Fall back to the JWT itself only if no key is configured.
    api_key = SUPABASE_ANON_KEY or token
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": api_key,
                }
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            user_data = resp.json()
            uid = user_data.get("id")
            if not uid:
                raise HTTPException(status_code=401, detail="No user id in token")
            return uid
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="Auth service unreachable")


# --- UTILITY: Minimum Payment Calculator ---
def calculate_minimum_payment(
    balance: Decimal,
    apr: Decimal,
    interest_type: str = "revolving",
    remaining_months: int | None = None,
) -> Decimal:
    """
    Dual-formula minimum payment calculator.
    
    REVOLVING (Credit Cards / HELOC):
        min_payment = max(1% of balance, $25) + monthly_interest
        
    FIXED (Auto Loan / Mortgage / Personal):
        Standard amortization: P × r(1+r)^n / ((1+r)^n - 1)
        Falls back to revolving formula if remaining_months is missing.
    """
    if balance <= 0:
        return Decimal("0")
    
    monthly_rate = apr / Decimal("100") / Decimal("12")
    
    if interest_type == "fixed" and remaining_months and remaining_months > 0:
        # Amortization formula: P × r(1+r)^n / ((1+r)^n - 1)
        if monthly_rate > 0:
            factor = (1 + monthly_rate) ** remaining_months
            payment = balance * (monthly_rate * factor) / (factor - 1)
        else:
            # 0% APR — straight division
            payment = balance / Decimal(str(remaining_months))
        return min(payment, balance).quantize(Decimal("0.01"))
    
    # REVOLVING: max(1% of balance, $25) + monthly_interest
    monthly_interest = balance * monthly_rate
    one_percent = balance * Decimal("0.01")
    base = max(one_percent, Decimal("25"))
    minimum = base + monthly_interest
    return min(minimum, balance).quantize(Decimal("0.01"))


# ── Helper: bypass FK constraints for sessions that reference auth.users ──
from contextlib import contextmanager
from sqlalchemy import text

DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"

@contextmanager
def _bypass_fk(session):
    """Temporarily disable FK constraint checks.
    Needed because cashflow_items, accounts, etc. have FK to auth.users,
    but demo/test users don't exist in that Supabase-managed table."""
    session.execute(text("SET session_replication_role = 'replica'"))
    try:
        yield
    finally:
        session.execute(text("SET session_replication_role = 'origin'"))


# --- APP ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    seed_data()

@app.get("/health")
async def health_check():
    """Lightweight health endpoint for Railway / monitoring."""
    return {"status": "ok"}

# --- RUTAS ACCOUNTS ---
@app.get("/api/accounts", response_model=List[Account])
async def get_accounts(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        return session.exec(select(Account).where(Account.user_id == user_id)).all()

@app.post("/api/accounts", response_model=Account)
async def create_account(account: Account, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account.user_id = user_id
        # Auto-calculate min_payment if it's a debt account AND user didn't provide one
        if account.type == "debt":
            if account.min_payment is None or account.min_payment == 0:
                account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
            
        with _bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        return account

@app.put("/api/accounts/{id}", response_model=Account)
async def update_account(id: int, account_data: Account, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        account.name = account_data.name
        account.balance = account_data.balance
        account.interest_rate = account_data.interest_rate
        account.type = account_data.type
        account.min_payment = account_data.min_payment
        account.due_day = account_data.due_day
        account.closing_day = account_data.closing_day
        
        # Recalculate if 0, otherwise trust user
        if account.type == "debt" and (account.min_payment is None or account.min_payment == 0):
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)

        with _bypass_fk(session):
            session.add(account)
            session.commit()
        session.refresh(account)
        return account

class BalanceUpdate(BaseModel):
    balance: float

@app.patch("/api/accounts/{id}/balance", response_model=Account)
async def update_account_balance(id: int, data: BalanceUpdate, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        account.balance = Decimal(str(data.balance))
        
        # Auto-update Min Payment
        if account.type == "debt":
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
            
        session.add(account)
        with _bypass_fk(session):
            session.commit()
        session.refresh(account)
        return account


@app.delete("/api/accounts/{id}")
async def delete_account(id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item = session.exec(select(Account).where(Account.id == id, Account.user_id == user_id)).first()
        if item:
            # 1. Get transactions for this account
            transactions = session.exec(select(Transaction).where(Transaction.account_id == id, Transaction.user_id == user_id)).all()
            tx_ids = [tx.id for tx in transactions]
            
            # 2. Unlink MovementLogs that reference these transactions
            if tx_ids:
                logs = session.exec(select(MovementLog).where(MovementLog.verified_transaction_id.in_(tx_ids), MovementLog.user_id == user_id)).all()
                for log in logs:
                    log.verified_transaction_id = None
                    log.status = "executed"
                    session.add(log)
            
            # 3. Delete transactions
            for tx in transactions:
                session.delete(tx)
            
            # 4. Delete account
            session.delete(item)
            session.commit()
        return {"ok": True}

@app.delete("/api/accounts")
async def delete_all_accounts(user_id: str = Depends(get_current_user_id)):
    """HARD RESET: Wipe all user's accounts, transactions, and movement logs."""
    try:
        with Session(engine) as session:
            # 1. Delete user's MovementLogs
            logs = session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()
            for log in logs:
                session.delete(log)
            
            # 2. Delete user's transactions
            transactions = session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
            for tx in transactions:
                session.delete(tx)
            
            # 3. Delete user's accounts
            accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
            for acc in accounts:
                session.delete(acc)
                
            session.commit()
        return {"ok": True, "message": "System Hard Reset Complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- RUTAS CASHFLOW ---
@app.get("/api/cashflow")
async def get_cashflow(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        # 1. Real cashflow items
        real_items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        result = [item.model_dump() for item in real_items]
        
        # 2. Virtual debt items — active debts become recurring expenses automatically
        debt_accounts = session.exec(
            select(Account).where(Account.user_id == user_id, Account.type == "debt", Account.balance > 0)
        ).all()
        
        for acc in debt_accounts:
            min_pay = float(acc.min_payment) if acc.min_payment and acc.min_payment > 0 else 50.0
            result.append({
                "id": -acc.id,                          # Negative ID = virtual item
                "user_id": user_id,
                "name": f"Deuda: {acc.name}",
                "amount": min_pay,
                "category": "expense",
                "frequency": "monthly",
                "day_of_month": acc.due_day or 15,
                "day_of_week": None,
                "date_specific_1": None,
                "date_specific_2": None,
                "month_of_year": None,
                "is_variable": False,
                "is_debt_virtual": True,                # Frontend flag
                "source_account_id": acc.id,
                "debt_balance": float(acc.balance),
                "interest_rate": float(acc.interest_rate),
            })
        
        return result

@app.post("/api/cashflow", response_model=CashflowItem)
async def create_cashflow(item: CashflowItem, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item.user_id = user_id
        with _bypass_fk(session):
            session.add(item)
            session.commit()
        session.refresh(item)
        return item

@app.delete("/api/cashflow/{id}")
async def delete_cashflow(id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        item = session.exec(select(CashflowItem).where(CashflowItem.id == id, CashflowItem.user_id == user_id)).first()
        if item:
            session.delete(item)
            session.commit()
        return {"ok": True}

@app.get("/api/cashflow/projection")
async def get_cashflow_projection(months: int = 3, user_id: str = Depends(get_current_user_id)):
    """
    Projects daily running balance using recurring CashflowItems.
    Walks day-by-day from start of current month for N months,
    applying income/expense rules to produce a cashflow map.
    """
    if months < 1:
        months = 1
    if months > 12:
        months = 12

    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()

        # Starting balance = sum of non-debt accounts
        liquid_cash = float(sum(acc.balance for acc in accounts if acc.type != "debt"))
        today = date.today()

        # Project from 1st of current month so we see the full picture
        start_date = date(today.year, today.month, 1)

        # Calculate end date
        end_month = today.month + months
        end_year = today.year + (end_month - 1) // 12
        end_month = ((end_month - 1) % 12) + 1
        end_date = date(end_year, end_month, 1)

        total_days = (end_date - start_date).days

        # --- Helper: check if a CashflowItem triggers on a given date ---
        def item_triggers_on(item: CashflowItem, d: date) -> bool:
            freq = item.frequency

            if freq == "monthly":
                dom = int(item.day_of_month) if item.day_of_month else 1
                # Clamp to last day of month for months with fewer days
                import calendar
                last_day = calendar.monthrange(d.year, d.month)[1]
                return d.day == min(dom, last_day)

            elif freq == "semi_monthly":
                d1 = int(item.date_specific_1) if item.date_specific_1 else 15
                d2 = int(item.date_specific_2) if item.date_specific_2 else 30
                import calendar
                last_day = calendar.monthrange(d.year, d.month)[1]
                return d.day == min(d1, last_day) or d.day == min(d2, last_day)

            elif freq == "weekly":
                dow = int(item.day_of_week) if item.day_of_week is not None else 0
                return d.weekday() == dow

            elif freq == "biweekly":
                dow = int(item.day_of_week) if item.day_of_week is not None else 0
                if d.weekday() != dow:
                    return False
                # Check if this is an even-numbered week from start_date
                week_num = (d - start_date).days // 7
                return week_num % 2 == 0

            elif freq == "annually":
                target_month = int(item.month_of_year) if item.month_of_year else 1
                dom = int(item.day_of_month) if item.day_of_month else 1
                return d.month == target_month and d.day == dom

            return False

        # --- Walk day-by-day ---
        # We need to reconstruct what balance "was" on day 1 of the month
        # by reverse-applying events between start_date and today.
        # Simpler approach: start from liquid_cash as today's balance,
        # then backfill past days and forward-fill future days.

        # Step 1: Calculate events for each day
        daily_events: dict[str, list] = {}
        for day_offset in range(total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            daily_events[d_str] = []
            for item in items:
                if item_triggers_on(item, d):
                    amt = float(item.amount)
                    signed_amt = amt if item.category == "income" else -amt
                    daily_events[d_str].append({
                        "name": item.name,
                        "amount": signed_amt,
                        "category": item.category,
                    })
            
            # Inject debt min_payments as monthly expense events
            import calendar
            last_day_of_month = calendar.monthrange(d.year, d.month)[1]
            for acc in accounts:
                if acc.type == "debt" and acc.balance > 0:
                    due = acc.due_day or 15
                    clamped_due = min(due, last_day_of_month)
                    if d.day == clamped_due:
                        min_pay = float(acc.min_payment) if acc.min_payment and acc.min_payment > 0 else 50.0
                        daily_events[d_str].append({
                            "name": f"Deuda: {acc.name}",
                            "amount": -min_pay,
                            "category": "debt_payment",
                        })

        # Step 2: Build running balance
        # Start from today's liquid_cash, walk backward to fill past,
        # then walk forward for future.
        today_str = today.isoformat()
        today_offset = (today - start_date).days

        # Forward pass from today
        balances: dict[str, float] = {}
        bal = liquid_cash
        balances[today_str] = round(bal, 2)

        for day_offset in range(today_offset + 1, total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            day_delta = sum(ev["amount"] for ev in daily_events.get(d_str, []))
            bal += day_delta
            balances[d_str] = round(bal, 2)

        # Backward pass from today
        bal = liquid_cash
        for day_offset in range(today_offset - 1, -1, -1):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()
            # Reverse: subtract today's events to get yesterday's balance
            next_d = start_date + timedelta(days=day_offset + 1)
            next_str = next_d.isoformat()
            next_delta = sum(ev["amount"] for ev in daily_events.get(next_str, []))
            bal -= next_delta
            balances[d_str] = round(bal, 2)

        # Step 3: Assemble response
        days_list = []
        for day_offset in range(total_days):
            d = start_date + timedelta(days=day_offset)
            d_str = d.isoformat()

            if d < today:
                zone = "past"
            elif d == today:
                zone = "today"
            else:
                zone = "future"

            days_list.append({
                "date": d_str,
                "balance": balances.get(d_str, liquid_cash),
                "events": daily_events.get(d_str, []),
                "is_today": d == today,
                "zone": zone,
                "day_label": d.strftime("%a"),
                "day_num": d.day,
            })

        return {
            "start_balance": round(liquid_cash, 2),
            "today": today_str,
            "total_days": total_days,
            "days": days_list,
        }

# --- RUTAS DASHBOARD ---
@app.get("/api/dashboard")
async def get_dashboard_metrics(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD
        
        total_debt = sum(acc.balance for acc in accounts if acc.type == "debt")
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        
        # Calculate Chase Balance (or primary checking)
        # Try to find "Chase" or fall back to first checking
        chase_acc = next((acc for acc in accounts if "chase" in acc.name.lower() and acc.type == "checking"), None)
        if not chase_acc:
             chase_acc = next((acc for acc in accounts if acc.type == "checking"), None)
        
        chase_balance = chase_acc.balance if chase_acc else Decimal('0')
        
        # --- ATTACK EQUITY & SAFETY PROTOCOL ---
        # 1. Convert accounts to DebtAccount list for logic
        debt_objects = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        # 1b. Fetch REAL cashflow items for accurate projection
        cashflow_items = session.exec(
            select(CashflowItem).where(CashflowItem.user_id == user_id)
        ).all()
        
        # Build recurring incomes list from actual DB data
        real_incomes = [
            {
                "name": item.name,
                "amount": Decimal(str(item.amount)),
                "day": item.day_of_month or 1
            }
            for item in cashflow_items
            if item.category == "income" and item.frequency == "monthly"
        ]
        
        # Build recurring expenses list (non-debt bills: rent, utilities, etc.)
        real_expenses = [
            {
                "name": item.name,
                "amount": Decimal(str(item.amount)),
                "day": item.day_of_month or 1
            }
            for item in cashflow_items
            if item.category == "expense" and item.frequency == "monthly"
        ]
        
        # 2. Calculate Safe Attack Equity with REAL data
        safety_data = calculate_safe_attack_equity(
            liquid_cash, shield_target, debt_objects,
            recurring_incomes=real_incomes if real_incomes else None,
            recurring_expenses=real_expenses if real_expenses else None
        )
        
        attack_equity = safety_data["safe_equity"]
        reserved_for_bills = safety_data["reserved_for_bills"]
        
        # Velocity Target (Highest Interest Debt)
        debts = [acc for acc in accounts if acc.type == "debt" and acc.balance > 0]
        velocity_target = None
        
        if debts:
            target_account = max(debts, key=lambda x: x.interest_rate)
            
            # --- SMART ADVICE LOGIC ---
            today = date.today()
            
            # 1. Find Next Payday (from Cashflow Items)
            cashflow_items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
            incomes = [cf for cf in cashflow_items if cf.amount > 0]
            next_payday = today + timedelta(days=30) # Default backup
            
            if incomes:
                candidates = []
                for inc in incomes:
                    # Find next occurrence of this day_of_month
                    try:
                        # If day > 28, handle simpler (just simple logic for now or stick to valid days)
                        # Assuming day_of_month is valid 1-31
                        d = int(inc.day_of_month)
                        candidate_date = date(today.year, today.month, d)
                        if candidate_date < today:
                            # Move to next month
                            if today.month == 12:
                                candidate_date = date(today.year + 1, 1, d)
                            else:
                                candidate_date = date(today.year, today.month + 1, d)
                        candidates.append(candidate_date)
                    except:
                        pass # specific day might be invalid for this month (e.g. Feb 30), skip for simplicity optimization
                
                if candidates:
                    next_payday = min(candidates)

            # 2. Determine Action Date
            # If we have equity, ACT NOW. If not, Wait for Payday.
            has_surplus = attack_equity > 0
            action_date = today if has_surplus else next_payday
            
            # 3. Calculate Financials
            b = target_account.balance
            r = target_account.interest_rate
            daily_interest = b * (r / Decimal("100")) / Decimal("365")
            
            # Min Payment Breakdown (Estimated)
            # We know Min Payment = (Bal * Rate/12) + (Bal * 1%)
            # So Interest Part ~ Bal * Rate/12
            monthly_interest_cost = b * (r / Decimal("100")) / Decimal("12")
            principal_part = max(Decimal("0"), target_account.min_payment - monthly_interest_cost)

            # 4. English/Spanish Justification
            if has_surplus:
                why_text = (
                    f"Tienes un excedente SEGURO de ${float(attack_equity):,.2f}. "
                    f"(Ya reservamos ${float(reserved_for_bills):,.2f} para facturas próximas). "
                    f"Ataca hoy para eliminar interés diario."
                )
            else:
                if reserved_for_bills > 0:
                     why_text = (
                        f"Tu ataque está pausado por Seguridad. "
                        f"Reservando ${float(reserved_for_bills):,.2f} para pagos mínimos próximos. "
                        f"La prioridad es sobrevivir este mes."
                    )
                else:
                    why_text = "Tu ataque está recargando. Esperando ingresos."

            velocity_target = {
                "name": target_account.name,
                "balance": float(target_account.balance),
                "interest_rate": float(target_account.interest_rate),
                "min_payment": float(target_account.min_payment),
                "action_date": action_date.strftime("%Y-%m-%d"),
                "priority_reason": f"Atacamos {target_account.name} (APR {float(r)}%) tras asegurar tus facturas.",
                "justification": why_text,
                "shield_note": f"🛡️ Shield: ${float(shield_target):,.0f} | 📅 Bills: ${float(reserved_for_bills):,.0f}",
                "daily_interest_saved": float(daily_interest),
                "next_payday": next_payday.strftime("%Y-%m-%d")
            }
            
        return {
            "total_debt": total_debt,
            "liquid_cash": liquid_cash,
            "chase_balance": chase_balance,
            "shield_target": shield_target,
            "attack_equity": attack_equity,
            "reserved_for_bills": float(reserved_for_bills),
            "safety_breakdown": safety_data["breakdown"],
            "calendar": safety_data.get("projection_data", []), # New Field
            "velocity_target": velocity_target
        }

@app.get("/api/dashboard/cashflow_monitor")
async def get_dashboard_monitor(timeframe: str = "monthly", type: str = "income", user_id: str = Depends(get_current_user_id)):
    """
    Calculate total cashflow (Income or Expense) for a specific timeframe.
    Timeframes: 'daily' (Today), 'weekly' (7d), 'monthly' (30d), 'annual' (365d).
    Type: 'income' (Inflows), 'expense' (Outflows).
    """
    with Session(engine) as session:
        today = date.today()
        start_date = today
        
        if timeframe == "weekly":
            start_date = today - timedelta(days=7)
        elif timeframe == "monthly":
            start_date = today - timedelta(days=30)
        elif timeframe == "annual":
            start_date = today - timedelta(days=365)
        # timeframe == "daily" uses start_date = today

        # Base Query: Filter by date and user
        query = select(Transaction).where(Transaction.date >= start_date, Transaction.user_id == user_id)
        
        # Filter by Type (Income vs Expense)
        # Income: Amount > 0. We currently don't strictly enforce "Category has Income" for flexibility,
        # but to be precise we should rely on the sign.
        # Expense: Amount < 0.
        
        all_txs_in_window = session.exec(query).all()
        
        if type == "income":
            # Sum positive amounts
            filtered_txs = [tx for tx in all_txs_in_window if tx.amount > 0]
            # Use abs() just in case, though logic says > 0
            total_amount = sum(tx.amount for tx in filtered_txs)
        else: # type == "expense"
            # Sum negative amounts
            filtered_txs = [tx for tx in all_txs_in_window if tx.amount < 0]
            # Return absolute value for display (e.g. "Total Expense: $500", not "-$500")
            total_amount = sum(abs(tx.amount) for tx in filtered_txs)
        
        return {
            "timeframe": timeframe,
            "type": type,
            "total_amount": total_amount,
            "transaction_count": len(filtered_txs)
        }


# --- RUTAS PEACE SHIELD ---
@app.get("/api/peace-shield")
async def get_peace_shield_data(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        # Calculate liquid cash (Checking + Savings)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type in ["checking", "savings"])
        
        return get_peace_shield_status(Decimal(str(liquid_cash)), shield_target)

class ShieldUpdate(BaseModel):
    target: float

@app.put("/api/user/me/shield")
def update_shield_target(data: ShieldUpdate):
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        if not user:
            # Should exist from seed, but graceful handling
            user = User(email="user@corex.io", shield_target=Decimal(str(data.target)))
            session.add(user)
        else:
            user.shield_target = Decimal(str(data.target))
            session.add(user)
        session.commit()
        return {"ok": True}

@app.get("/api/velocity/projections")
async def get_velocity_projections(user_id: str = Depends(get_current_user_id)):
    """Calculate real velocity banking projections from account data."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        
        # Convert debt accounts to DebtAccount dataclass
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        # Calculate liquid cash
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        
        # Get velocity projections
        projections = get_projections(debts, Decimal(str(liquid_cash)))
        
        return projections

@app.get("/api/velocity/freedom-path")
async def get_freedom_path(user_id: str = Depends(get_current_user_id)):
    """Get the month-by-month freedom path simulation."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        # Default Velocity: 20% of liquid cash
        velocity_amount = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        simulation = simulate_freedom_path(debts, velocity_amount)
        return simulation

@app.get("/api/velocity/simulate")
async def get_simulation(extra_cash: float, user_id: str = Depends(get_current_user_id)):
    """Simulate payoff with custom extra monthly cash."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        # Base Velocity + User Extra
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        base_velocity = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        total_monthly_power = base_velocity + Decimal(str(extra_cash))
        
        simulation = simulate_freedom_path(debts, total_monthly_power)
        return simulation

@app.get("/api/strategy/tactical-gps")
async def get_tactical_gps(user_id: str = Depends(get_current_user_id)):
    """Generate a 2-month action plan with impact metrics."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        cashflows = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        
        cf_tactical = [
            CashflowTactical(
                name=cf.name,
                amount=cf.amount,
                day_of_month=cf.day_of_month,
                category=cf.category
            )
            for cf in cashflows
        ]
        
        checking_balance = sum(acc.balance for acc in accounts if acc.type == "checking")
        
        # Dynamic Funding Source Selection
        asset_accounts = [acc for acc in accounts if acc.type in ["checking", "savings"] and acc.balance > 0]
        asset_accounts.sort(key=lambda x: x.balance, reverse=True)
        funding_name = asset_accounts[0].name if asset_accounts else "Checking"
        
        # Get User Shield Target
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        # Generate 2-month action plan with impact metrics
        return generate_action_plan(debts, cf_tactical, checking_balance, funding_name, shield_target)

# (All imports consolidated at top of file)


class MovementExecute(BaseModel):
    movement_key: str
    title: str
    amount: float
    date_planned: str
    source: str
    destination: str

@app.post("/api/strategy/execute")
async def execute_movement(data: MovementExecute, user_id: str = Depends(get_current_user_id)):
    """
    Executes a tactical movement by creating a transaction and UPDATING BALANCES.
    """
    with Session(engine) as session:
        amount = Decimal(str(data.amount))
        
        # 1. Find Source Account (e.g. Chase) — scoped to user
        source_acc = session.exec(select(Account).where(Account.name == data.source, Account.user_id == user_id)).first()
        
        if source_acc:
            source_acc.balance -= amount
            session.add(source_acc)
            
        # 2. Find Destination Account (e.g. Credit Card) — scoped to user
        dest_acc = session.exec(select(Account).where(Account.name == data.destination, Account.user_id == user_id)).first()
        if dest_acc:
            dest_acc.balance -= amount
            
            # Auto-update Min Payment
            if dest_acc.type == "debt":
                dest_acc.min_payment = calculate_minimum_payment(dest_acc.balance, dest_acc.interest_rate)
                 
            session.add(dest_acc)
        
        # 3. Record Transaction
        primary_account_id = source_acc.id if source_acc else (dest_acc.id if dest_acc else None)
        
        if not primary_account_id:
            raise HTTPException(status_code=400, detail="Execution Failed: Source nor Destination account found in DB.")

        try:
            tx = Transaction(
                date=date.today().isoformat(),
                amount=amount,
                description=f"Velocity Execution: {data.title}",
                category="Debt Payment" if dest_acc else "Transfer",
                account_id=primary_account_id,
                user_id=user_id,
                is_manual=False
            )
            session.add(tx)
            with _bypass_fk(session):
                session.commit()
            return {
                "status": "executed", 
                "new_balance_source": source_acc.balance if source_acc else "N/A",
                "source_found": bool(source_acc),
                "dest_found": bool(dest_acc)
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Execution Failed: {str(e)}")

@app.get("/api/debug/accounts")
async def debug_list_accounts(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        return session.exec(select(Account).where(Account.user_id == user_id)).all()

@app.get("/api/strategy/executed-logs")
async def get_executed_logs(user_id: str = Depends(get_current_user_id)):
    """Retrieve all logged strategic movements for current user."""
    with Session(engine) as session:
        return session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()

# --- RUTAS TRANSACCIONES ---
@app.post("/api/transactions", response_model=Transaction)
async def create_transaction(tx: TransactionCreate, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        # Verify account belongs to user
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
            user_id=user_id
        )
        session.add(db_tx)
        
        # 2. Update Account Balance
        amount_decimal = Decimal(str(tx.amount))
        abs_amount = abs(amount_decimal)
        
        if account.type == "debt":
            if tx.category == "payment":
                account.balance -= abs_amount  # Payment REDUCES debt
            else:
                account.balance += abs_amount  # New charge INCREASES debt
            # Recalculate minimum payment based on new balance
            account.min_payment = calculate_minimum_payment(
                account.balance, account.interest_rate,
                account.interest_type, account.remaining_months
            )
        else:
            account.balance += amount_decimal
                
        session.add(account)
        with _bypass_fk(session):
            session.commit()
        session.refresh(db_tx)
        return db_tx

@app.get("/api/accounts/{account_id}/transactions", response_model=List[Transaction])
async def get_account_transactions(account_id: int, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        # Verify account belongs to user
        account = session.exec(select(Account).where(Account.id == account_id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        return session.exec(select(Transaction).where(Transaction.account_id == account_id, Transaction.user_id == user_id).order_by(Transaction.date.desc())).all()

# --- RUTAS PLAID ---
from plaid_service import create_link_token, exchange_public_token, get_accounts as plaid_get_accounts, sync_transactions

class PlaidPublicToken(BaseModel):
    public_token: str

class PlaidAccessToken(BaseModel):
    access_token: str

# Store access tokens in memory (in production, save to DB)
plaid_tokens: dict = {}

@app.get("/api/plaid/create_link_token")
def api_create_link_token():
    """Create a Plaid Link token for the frontend."""
    try:
        result = create_link_token()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/exchange_public_token")
def api_exchange_public_token(data: PlaidPublicToken):
    """Exchange public token for access token after user links bank."""
    try:
        result = exchange_public_token(data.public_token)
        # Store access token (in production, save to DB with user_id)
        plaid_tokens["current"] = result["access_token"]
        return {"success": True, "item_id": result["item_id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/plaid/accounts")
def api_get_plaid_accounts():
    """Fetch accounts from Plaid using stored access token."""
    access_token = plaid_tokens.get("current")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")
    
    try:
        accounts = plaid_get_accounts(access_token)
        return {"accounts": accounts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/plaid/import_accounts")
async def api_import_plaid_accounts(user_id: str = Depends(get_current_user_id)):
    """Import Plaid accounts into database."""
    access_token = plaid_tokens.get("current")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")
    
    try:
        plaid_accounts = plaid_get_accounts(access_token)
        imported = []
        
        with Session(engine) as session:
            for acc in plaid_accounts:
                # Check if account already exists by plaid_account_id
                existing_account = session.exec(select(Account).where(Account.plaid_account_id == acc["plaid_account_id"], Account.user_id == user_id)).first()
                
                if existing_account:
                    existing_account.balance = Decimal(str(abs(acc["balance"])))
                    existing_account.name = f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name']
                    continue

                # Map Plaid types
                corex_type = "checking"
                if acc["type"] == "credit":
                    corex_type = "debt"
                elif acc["type"] == "depository":
                    corex_type = "checking" if acc["subtype"] in ["checking", None] else "savings"
                
                new_account = Account(
                    name=f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name'],
                    type=corex_type,
                    balance=Decimal(str(abs(acc["balance"]))),
                    interest_rate=Decimal("0"),
                    min_payment=Decimal("0"),
                    payment_frequency="monthly",
                    plaid_account_id=acc["plaid_account_id"],
                    user_id=user_id
                )
                session.add(new_account)
                imported.append(new_account.name)
            
            with _bypass_fk(session):
                session.commit()
        
        return {"success": True, "imported": imported, "count": len(imported)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/plaid/sync_transactions")
async def api_sync_transactions(data: PlaidAccessToken, user_id: str = Depends(get_current_user_id)):
    """Sync transactions from Plaid and persist to DB."""
    try:
        result = sync_transactions(data.access_token)
        
        counts = {"added": 0, "skipped": 0}
        
        with Session(engine) as session:
            # Get all accounts that have a plaid_account_id for this user
            accounts = session.exec(select(Account).where(Account.plaid_account_id != None, Account.user_id == user_id)).all()
            account_map = {acc.plaid_account_id: acc.id for acc in accounts}
            
            for tx in result.get("added", []):
                local_account_id = account_map.get(tx["plaid_account_id"])
                if not local_account_id:
                    counts["skipped"] += 1
                    continue
                
                existing = session.exec(select(Transaction).where(Transaction.plaid_transaction_id == tx["plaid_transaction_id"])).first()
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
                corex_amount = plaid_amount * Decimal("-1")
                
                new_tx = Transaction(
                    account_id=local_account_id,
                    date=tx["date"],
                    amount=corex_amount,
                    description=tx["name"],
                    category=smart_category,
                    plaid_transaction_id=tx["plaid_transaction_id"],
                    user_id=user_id
                )
                session.add(new_tx)
                counts["added"] += 1
            
            with _bypass_fk(session):
                session.commit()
            
            # --- AUTO-VERIFICATION LOGIC ---
            pending_logs = session.exec(select(MovementLog).where(MovementLog.status == "executed", MovementLog.user_id == user_id)).all()
            for log in pending_logs:
                # Search for a transaction with the same amount (within 1% or exact)
                # and within +/- 3 days of execution
                log_date = date.fromisoformat(log.date_executed)
                start_window = (log_date - timedelta(days=3)).isoformat()
                end_window = (log_date + timedelta(days=3)).isoformat()
                
                match = session.exec(
                    select(Transaction).where(
                        Transaction.amount == log.amount,
                        Transaction.date >= start_window,
                        Transaction.date <= end_window
                    )
                ).first()
                
                if match:
                    log.status = "verified"
                    log.verified_transaction_id = match.id
                    session.add(log)
            
            with _bypass_fk(session):
                session.commit()
            
        return {
            "success": True, 
            "added": counts["added"], 
            "skipped": counts["skipped"],
            "has_more": result.get("has_more", False),
            "next_cursor": result.get("next_cursor")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transactions/manual")
async def create_manual_transaction(tx: TransactionCreate, user_id: str = Depends(get_current_user_id)):
    """Manually create a transaction and update account balance."""
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.id == tx.account_id, Account.user_id == user_id)).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Create transaction
        new_tx = Transaction(
            account_id=tx.account_id,
            amount=tx.amount,
            description=tx.description,
            category=tx.category,
            date=tx.date,
            plaid_transaction_id=f"manual-{uuid.uuid4()}",
            user_id=user_id
        )
        session.add(new_tx)
        
        # Update Account Balance
        abs_amount = abs(Decimal(str(tx.amount)))
        if account.type == "debt":
            if tx.category == "payment":
                account.balance -= abs_amount  # Payment REDUCES debt
            else:
                account.balance += abs_amount  # New charge INCREASES debt
            account.min_payment = calculate_minimum_payment(
                account.balance, account.interest_rate,
                account.interest_type, account.remaining_months
            )
        else:
            account.balance += Decimal(str(tx.amount))
            
        session.add(account)
        with _bypass_fk(session):
            session.commit()
        session.refresh(new_tx)
        return new_tx

@app.get("/api/transactions/recent", response_model=List[Transaction])
async def get_recent_transactions(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    """Fetch most recent transactions for current user."""
    with Session(engine) as session:
        return session.exec(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(limit)
        ).all()



# ================================================================
# PURCHASE SIMULATOR — Time-Cost Calculator
# ================================================================

class SimulatorRequest(BaseModel):
    amount: float

@app.post("/api/simulator/time-cost")
async def simulate_purchase_cost(req: SimulatorRequest, user_id: str = Depends(get_current_user_id)):
    """Calculate how many days a purchase delays freedom."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        extra_monthly = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(
            Decimal('0.01')
        )
        return calculate_purchase_time_cost(
            Decimal(str(req.amount)), debts, extra_monthly
        )


# ================================================================
# TRANSACTION CLASSIFIER — Smart Categorization
# ================================================================

@app.get("/api/transactions/classified")
async def get_classified_transactions(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    """Return transactions with smart tags (income/debt/life)."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(limit)
        ).all()
        raw = [
            {
                "id": tx.id,
                "account_id": tx.account_id,
                "amount": float(tx.amount),
                "date": tx.date,
                "name": tx.description,
                "category": tx.category,
            }
            for tx in txs
        ]
        return classify_batch(raw)


@app.get("/api/cashflow/summary")
async def get_cashflow_intelligence(user_id: str = Depends(get_current_user_id)):
    """Return the AI-classified cashflow summary."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(100)
        ).all()
        raw = [
            {
                "amount": float(tx.amount),
                "name": tx.description,
                "category": tx.category,
            }
            for tx in txs
        ]
        classified = classify_batch(raw)
        return get_cashflow_summary(classified)


# ================================================================
# STRATEGY COMMAND CENTER — Attack Intelligence
# ================================================================

@app.get("/api/strategy/command-center")
async def get_strategy_command_center(user_id: str = Depends(get_current_user_id)):
    """
    Consolidated Strategy Intelligence endpoint.
    Returns morning briefing, confidence meter, freedom counter,
    and attack streak — all in one call.
    """
    with Session(engine) as session:
        # --- 1. Load all user accounts ---
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        debt_accounts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=acc.min_payment if acc.min_payment else Decimal('50'),
                due_day=acc.due_day if acc.due_day else 15
            )
            for acc in accounts if acc.type == "debt" and acc.balance > 0
        ]

        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        liquid_cash_dec = Decimal(str(liquid_cash))

        # --- 2. Shield status ---
        shield = get_peace_shield_status(liquid_cash_dec, shield_target)

        # --- 3. Safe Attack Equity ---
        safety_data = calculate_safe_attack_equity(
            liquid_cash_dec, shield_target, debt_accounts
        )
        attack_amount = safety_data["safe_equity"]

        # --- 4. Velocity Target (Avalanche) ---
        target = get_velocity_target(debt_accounts)

        # --- 5. Morning Briefing ---
        morning_briefing = None
        if target and attack_amount > 0:
            # Daily interest cost of the target debt
            daily_interest = (
                target.balance * (target.interest_rate / Decimal('100'))
            ) / Decimal('365')
            daily_interest = daily_interest.quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )

            # Monthly interest saved if we apply the attack now
            interest_saved_monthly = (
                attack_amount * (target.interest_rate / Decimal('100'))
            ) / Decimal('12')
            interest_saved_monthly = interest_saved_monthly.quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )

            # Days accelerated: approximate months shortened * 30
            # Simple: (attack_amount / target.min_payment) * 30
            days_accelerated = 0
            if target.min_payment > 0:
                months_saved = attack_amount / target.min_payment
                days_accelerated = int(
                    (months_saved * Decimal('30')).quantize(Decimal('1'))
                )

            # "Freedom Hours" = (interest_saved * 12) / hourly_equiv
            # Approximate: assume user earns ~$25/hr net for translation
            hourly_rate = Decimal('25')
            annual_interest_saved = interest_saved_monthly * Decimal('12')
            freedom_hours = (annual_interest_saved / hourly_rate).quantize(
                Decimal('0.1'), rounding=ROUND_HALF_UP
            )

            morning_briefing = {
                "available_cash": float(liquid_cash_dec),
                "attack_amount": float(attack_amount),
                "shield_status": {
                    "percentage": shield.get("fill_percentage", 0),
                    "is_active": shield.get("is_active", False),
                    "health": shield.get("health", "unknown"),
                },
                "recommended_action": {
                    "amount": float(attack_amount),
                    "destination": target.name,
                    "destination_apr": float(target.interest_rate),
                    "destination_balance": float(target.balance),
                    "daily_cost": float(daily_interest),
                    "reason": (
                        f"Highest APR at {float(target.interest_rate)}% — "
                        f"costs ${float(daily_interest)}/day in interest"
                    ),
                },
                "impact": {
                    "days_accelerated": days_accelerated,
                    "interest_saved_monthly": float(interest_saved_monthly),
                    "freedom_hours_earned": float(freedom_hours),
                },
            }

        # --- 6. Confidence Meter (all debts ranked) ---
        confidence_meter = {
            "debts_ranked": [],
            "strategy": "avalanche",
            "explanation": "",
        }
        if debt_accounts:
            ranked = sorted(
                debt_accounts, key=lambda d: d.interest_rate, reverse=True
            )
            confidence_meter["debts_ranked"] = [
                {
                    "name": d.name,
                    "apr": float(d.interest_rate),
                    "balance": float(d.balance),
                    "daily_cost": float(
                        (d.balance * (d.interest_rate / Decimal('100')))
                        / Decimal('365')
                    ),
                    "is_target": (target and d.name == target.name),
                }
                for d in ranked
            ]
            if len(ranked) >= 2:
                top = ranked[0]
                second = ranked[1]
                confidence_meter["explanation"] = (
                    f"Every $100 to {top.name} saves "
                    f"${float(top.interest_rate)}/yr vs "
                    f"${float(second.interest_rate)}/yr to {second.name}"
                )

        # --- 7. Freedom Counter ---
        projections = get_projections(debt_accounts, liquid_cash_dec)

        freedom_counter = {
            "current_freedom_date": projections.get(
                "velocity_debt_free_date", "N/A"
            ),
            "standard_freedom_date": projections.get(
                "standard_debt_free_date", "N/A"
            ),
            "months_saved": projections.get("months_saved", 0),
            "interest_saved": projections.get("interest_saved", 0),
            "total_days_recovered": projections.get("months_saved", 0) * 30,
            "velocity_power": projections.get("velocity_power", 0),
        }

        # --- 8. Attack Streak ---
        executed_logs = session.exec(
            select(MovementLog)
            .where(MovementLog.status.in_(["executed", "verified"]), MovementLog.user_id == user_id)
            .order_by(MovementLog.date_executed.desc())
        ).all()

        total_attacks = len(executed_logs)

        # Calculate streak (consecutive months with at least 1 execution)
        current_streak = 0
        if executed_logs:
            # Group by month
            months_with_attacks = set()
            for log in executed_logs:
                if log.date_executed:
                    months_with_attacks.add(log.date_executed[:7])

            # Count consecutive months backwards from current
            check_date = date.today().replace(day=1)
            for _ in range(24):  # Max 2 years
                month_key = check_date.strftime("%Y-%m")
                if month_key in months_with_attacks:
                    current_streak += 1
                    # Go to previous month
                    if check_date.month == 1:
                        check_date = date(check_date.year - 1, 12, 1)
                    else:
                        check_date = date(
                            check_date.year, check_date.month - 1, 1
                        )
                else:
                    break

        streak = {
            "current": current_streak,
            "total_attacks": total_attacks,
        }

        # --- 9. Decision Helper Options ---
        decision_options = None
        if target and attack_amount > 0:
            # Option A: Full attack
            full_attack_savings = float(
                (attack_amount * (target.interest_rate / Decimal('100')))
                / Decimal('12')
            )

            # Option B: Boost shield
            shield_gap = max(
                Decimal('0'), shield_target - liquid_cash_dec
            )
            shield_boost_pct = min(
                Decimal('100'),
                ((liquid_cash_dec + attack_amount) / shield_target)
                * Decimal('100'),
            ) if shield_target > 0 else Decimal('100')

            # Option C: Split 50/50
            half = attack_amount / Decimal('2')
            split_savings = float(
                (half * (target.interest_rate / Decimal('100')))
                / Decimal('12')
            )

            # Recommendation logic
            shield_pct = shield.get("fill_percentage", 100)
            if shield_pct < 50:
                recommended = "shield"
            elif shield_pct < 80:
                recommended = "split"
            else:
                recommended = "attack"

            decision_options = {
                "options": [
                    {
                        "id": "attack",
                        "label": "Full Attack",
                        "amount": float(attack_amount),
                        "impact": f"Save ${full_attack_savings:.2f}/mo in interest",
                        "description": f"Apply all to {target.name}",
                    },
                    {
                        "id": "shield",
                        "label": "Boost Shield",
                        "amount": float(attack_amount),
                        "impact": f"Shield reaches {float(shield_boost_pct):.0f}%",
                        "description": "Strengthen your emergency fund",
                    },
                    {
                        "id": "split",
                        "label": "Balanced Split",
                        "amount": float(attack_amount),
                        "impact": f"Save ${split_savings:.2f}/mo + boost shield",
                        "description": "50% attack, 50% safety",
                    },
                ],
                "recommended": recommended,
            }

        return {
            "morning_briefing": morning_briefing,
            "confidence_meter": confidence_meter,
            "freedom_counter": freedom_counter,
            "streak": streak,
            "decision_options": decision_options,
        }


# ================================================================
# DEMO MODE — Stress Test Seed Endpoint
# ================================================================

@app.post("/api/dev/seed-stress-test")
async def seed_stress_test(user_id: str = Depends(get_current_user_id)):
    """Seed Carlos Mendoza stress-test dataset."""
    try:
        return _seed_impl(user_id)
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "tb": traceback.format_exc()}

def _seed_impl(user_id: str):
    from sqlalchemy import text

    with Session(engine) as session:
        uid = user_id  # Already a valid UUID string

        # ── 1. CLEAR existing data (TRUNCATE is faster than DELETE) ──
        session.execute(text("DELETE FROM transactions WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM movement_log WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM accounts WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM cashflow_items WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})

        # ── 1b. DISABLE FK checks for demo seeding ──────────
        session.execute(text("SET session_replication_role = 'replica'"))

        # ── 2. ACCOUNTS ────────────────────────────────────
        accounts_data = [
            # === ASSETS (4) ===
            ("Chase Business Checking", "checking", 12450.00, 0.01, 0, None, None, False, "revolving", "credit_card", None, None, None),
            ("Wells Fargo Personal", "checking", 3200.00, 0.01, 0, None, None, False, "revolving", "credit_card", None, None, None),
            ("Ally Savings (Emergency)", "savings", 8500.00, 4.25, 0, None, None, False, "revolving", "credit_card", None, None, None),
            ("Marcus Savings (Investment)", "savings", 15000.00, 4.40, 0, None, None, False, "revolving", "credit_card", None, None, None),
            # === REVOLVING DEBT (5) ===
            ("Amex Platinum Business", "debt", 18500.00, 24.99, 450.00, 5, 28, True, "revolving", "credit_card", None, None, None),
            ("Chase Sapphire Reserve", "debt", 7200.00, 21.49, 180.00, 12, 5, False, "revolving", "credit_card", None, None, None),
            ("Capital One Venture X", "debt", 4800.00, 19.99, 120.00, 20, 13, False, "revolving", "credit_card", None, None, None),
            ("Citi Double Cash", "debt", 2300.00, 17.49, 60.00, 28, 21, False, "revolving", "credit_card", None, None, None),
            ("HELOC - Property #2", "debt", 45000.00, 8.75, 375.00, 1, 25, False, "revolving", "heloc", None, None, None),
            # === FIXED / AMORTIZED DEBT (7) ===
            ("Mortgage - Casa Principal", "debt", 385000.00, 6.875, 2850.00, 1, None, False, "fixed", "mortgage", 420000.00, 360, 312),
            ("Mortgage - Rental #1", "debt", 220000.00, 7.25, 1680.00, 15, None, False, "fixed", "mortgage", 250000.00, 360, 288),
            ("Mortgage - Rental #2", "debt", 175000.00, 7.50, 1395.00, 15, None, False, "fixed", "mortgage", 200000.00, 360, 300),
            ("Tesla Model X Lease", "debt", 42000.00, 4.99, 780.00, 10, None, False, "fixed", "auto_loan", 65000.00, 72, 48),
            ("Range Rover Sport", "debt", 35000.00, 5.49, 650.00, 18, None, False, "fixed", "auto_loan", 55000.00, 60, 36),
            ("SBA Business Loan", "debt", 85000.00, 9.25, 1200.00, 25, None, False, "fixed", "personal_loan", 120000.00, 120, 84),
            ("Student Loan (MBA)", "debt", 28000.00, 5.50, 310.00, 5, None, False, "fixed", "student_loan", 45000.00, 120, 60),
        ]

        acc_insert = text("""
            INSERT INTO accounts (user_id, name, type, balance, interest_rate, min_payment,
                due_day, closing_day, is_velocity_target, interest_type, debt_subtype,
                original_amount, loan_term_months, remaining_months)
            VALUES (CAST(:uid AS uuid), :name, :type, :balance, :rate, :min_pay,
                :due_day, :closing_day, :vel_target, :int_type, :debt_sub,
                :orig_amt, :term, :remaining)
            RETURNING id, name
        """)

        acc_map = {}
        for a in accounts_data:
            result = session.execute(acc_insert, {
                "uid": uid, "name": a[0], "type": a[1],
                "balance": a[2], "rate": a[3], "min_pay": a[4],
                "due_day": a[5], "closing_day": a[6], "vel_target": a[7],
                "int_type": a[8], "debt_sub": a[9],
                "orig_amt": a[10], "term": a[11], "remaining": a[12],
            })
            row = result.fetchone()
            acc_map[row[1]] = row[0]  # name -> id

        # ── 3. CASHFLOW ITEMS (batch insert) ──────────────
        cf_insert = text("""
            INSERT INTO cashflow_items (user_id, name, amount, category, frequency,
                is_variable, day_of_month, day_of_week, month_of_year)
            VALUES (CAST(:uid AS uuid), :name, :amount, :category, :freq,
                :is_var, :dom, :dow, :moy)
        """)

        cashflows_data = [
            ("LLC Distribution", 8500.00, "income", "monthly", False, 1, None, None),
            ("W2 Consulting", 4200.00, "income", "biweekly", False, 15, 4, None),
            ("Rental Income #1", 2800.00, "income", "monthly", False, 5, None, None),
            ("Rental Income #2", 2200.00, "income", "monthly", False, 5, None, None),
            ("Freelance Projects", 1500.00, "income", "monthly", True, 15, None, None),
            ("Dividends - Brokerage", 350.00, "income", "monthly", False, 20, None, None),
            ("Airbnb Guest Payments", 900.00, "income", "weekly", True, 1, 0, None),
            ("Annual Bonus", 12000.00, "income", "annually", False, 15, None, 3),
            ("Property Tax - Casa", 580.00, "expense", "monthly", False, 1, None, None),
            ("Property Tax - Rental #1", 320.00, "expense", "monthly", False, 1, None, None),
            ("Property Tax - Rental #2", 280.00, "expense", "monthly", False, 1, None, None),
            ("HOA - Rental #1", 250.00, "expense", "monthly", False, 1, None, None),
            ("Insurance Bundle (3 props + 2 cars)", 890.00, "expense", "monthly", False, 10, None, None),
            ("Utilities - All Properties", 420.00, "expense", "monthly", True, 15, None, None),
            ("Internet + Phone Bundle", 280.00, "expense", "monthly", False, 18, None, None),
            ("Gym + Country Club", 350.00, "expense", "monthly", False, 1, None, None),
            ("Kids School Tuition", 1800.00, "expense", "monthly", False, 5, None, None),
            ("Groceries + Household", 600.00, "expense", "weekly", True, 1, 5, None),
        ]

        # Batch insert all cashflow items at once
        cf_params = [
            {"uid": uid, "name": cf[0], "amount": cf[1], "category": cf[2],
             "freq": cf[3], "is_var": cf[4], "dom": cf[5], "dow": cf[6], "moy": cf[7]}
            for cf in cashflows_data
        ]
        for p in cf_params:
            session.execute(cf_insert, p)

        # ── 4. HISTORICAL TRANSACTIONS (batch insert) ──────
        today = datetime.now()

        tx_insert = text("""
            INSERT INTO transactions (user_id, account_id, amount, description, category, date)
            VALUES (CAST(:uid AS uuid), :acc_id, :amount, :desc, :cat, :dt)
        """)

        transactions_data = [
            (acc_map.get("Chase Business Checking"), 8500.00, "LLC Distribution - February", "salary", 14),
            (acc_map.get("Chase Business Checking"), 4200.00, "W2 Consulting Biweekly", "salary", 7),
            (acc_map.get("Chase Business Checking"), 2800.00, "Rental Income - Property #1", "rental", 10),
            (acc_map.get("Chase Business Checking"), 2200.00, "Rental Income - Property #2", "rental", 10),
            (acc_map.get("Amex Platinum Business"), 450.00, "Velocity Execution: MIN PAYMENT Amex", "payment", 20),
            (acc_map.get("Chase Sapphire Reserve"), 180.00, "Velocity Execution: MIN PAYMENT Chase Sapphire", "payment", 18),
            (acc_map.get("Amex Platinum Business"), 2500.00, "Velocity Execution: ATTACK Amex Platinum", "payment", 13),
            (acc_map.get("Chase Business Checking"), -890.00, "Insurance Bundle - All Policies", "insurance", 5),
            (acc_map.get("Chase Business Checking"), -1800.00, "Kids School Tuition - February", "education", 10),
            (acc_map.get("Chase Business Checking"), -600.00, "Groceries - Costco + Whole Foods", "food", 3),
            (acc_map.get("Chase Business Checking"), 900.00, "Airbnb Guest Payment - Weekend Stay", "rental", 2),
            (acc_map.get("Chase Business Checking"), -350.00, "Gym + Country Club Monthly", "lifestyle", 1),
        ]

        # Batch insert all transactions at once
        tx_params = [
            {"uid": uid, "acc_id": tx[0], "amount": tx[1], "desc": tx[2],
             "cat": tx[3], "dt": (today - timedelta(days=tx[4])).strftime("%Y-%m-%d")}
            for tx in transactions_data
        ]
        for p in tx_params:
            session.execute(tx_insert, p)

        # Re-enable FK constraints
        session.execute(text("SET session_replication_role = 'origin'"))
        session.commit()

    return {
        "status": "success",
        "message": "Carlos Mendoza Stress Test loaded",
        "summary": {
            "accounts": len(accounts_data),
            "cashflows": len(cashflows_data),
            "transactions": len(transactions_data),
            "total_debt": sum(a[2] for a in accounts_data if a[1] == "debt"),
            "total_assets": sum(a[2] for a in accounts_data if a[1] in ["checking", "savings"]),
            "shield_target": 5000.00,
        }
    }
