from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, SQLModel, Field
from typing import List, Optional
from database import create_db_and_tables, engine, seed_data
from models import Account, CashflowItem, Transaction, TransactionCreate, User
from decimal import Decimal
from datetime import date, timedelta
from velocity_engine import (
    get_projections, DebtAccount, generate_tactical_schedule, CashflowTactical,
    get_peace_shield_status, calculate_purchase_time_cost, DEFAULT_PEACE_SHIELD,
    calculate_minimum_payment
)
from transaction_classifier import classify_batch, get_cashflow_summary
import uuid
from decimal import Decimal, ROUND_HALF_UP


# --- APP ---


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

# --- RUTAS ACCOUNTS ---
@app.get("/api/accounts", response_model=List[Account])
def get_accounts():
    with Session(engine) as session:
        return session.exec(select(Account)).all()

@app.post("/api/accounts", response_model=Account)
def create_account(account: Account):
    with Session(engine) as session:
        # Auto-calculate min_payment if it's a debt account AND user didn't provide one
        if account.type == "debt":
            if account.min_payment is None or account.min_payment == 0:
                account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
            
        session.add(account)
        session.commit()
        session.refresh(account)
        return account

@app.put("/api/accounts/{id}", response_model=Account)
def update_account(id: int, account_data: Account):
    with Session(engine) as session:
        account = session.get(Account, id)
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

        session.add(account)
        session.commit()
        session.refresh(account)
        return account

class BalanceUpdate(BaseModel):
    balance: float

@app.patch("/api/accounts/{id}/balance", response_model=Account)
def update_account_balance(id: int, data: BalanceUpdate):
    with Session(engine) as session:
        account = session.get(Account, id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        account.balance = Decimal(str(data.balance))
        
        # Auto-update Min Payment
        if account.type == "debt":
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
            
        session.add(account)
        session.commit()
        session.refresh(account)
        return account

from models import Account, CashflowItem, Transaction, TransactionCreate, MovementLog

@app.delete("/api/accounts/{id}")
def delete_account(id: int):
    with Session(engine) as session:
        item = session.get(Account, id)
        if item:
            # 1. Get transactions for this account
            transactions = session.exec(select(Transaction).where(Transaction.account_id == id)).all()
            tx_ids = [tx.id for tx in transactions]
            
            # 2. Unlink MovementLogs that reference these transactions
            if tx_ids:
                logs = session.exec(select(MovementLog).where(MovementLog.verified_transaction_id.in_(tx_ids))).all()
                for log in logs:
                    log.verified_transaction_id = None
                    log.status = "executed" # Revert status? Or keep verified but unlinked? Let's keep status or revert.
                    session.add(log)
            
            # 3. Delete transactions
            for tx in transactions:
                session.delete(tx)
            
            # 4. Delete account
            session.delete(item)
            session.commit()
        return {"ok": True}

@app.delete("/api/accounts")
def delete_all_accounts():
    """HARD RESET: Wipe all accounts, transactions, and movement logs."""
    try:
        with Session(engine) as session:
            # 1. Delete ALL MovementLogs (Clean Slate)
            logs = session.exec(select(MovementLog)).all()
            for log in logs:
                session.delete(log)
            
            # 2. Delete all transactions
            transactions = session.exec(select(Transaction)).all()
            for tx in transactions:
                session.delete(tx)
            
            # 3. Delete all accounts
            accounts = session.exec(select(Account)).all()
            for acc in accounts:
                session.delete(acc)
                
            session.commit()
        return {"ok": True, "message": "System Hard Reset Complete"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- RUTAS CASHFLOW ---
@app.get("/api/cashflow", response_model=List[CashflowItem])
def get_cashflow():
    with Session(engine) as session:
        return session.exec(select(CashflowItem)).all()

@app.post("/api/cashflow", response_model=CashflowItem)
def create_cashflow(item: CashflowItem):
    with Session(engine) as session:
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

@app.delete("/api/cashflow/{id}")
def delete_cashflow(id: int):
    with Session(engine) as session:
        item = session.get(CashflowItem, id)
        if item:
            session.delete(item)
            session.commit()
        return {"ok": True}

# --- RUTAS DASHBOARD ---
@app.get("/api/dashboard")
def get_dashboard_metrics():
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
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
        
        # 2. Calculate Safe Attack Equity
        from velocity_engine import calculate_safe_attack_equity
        safety_data = calculate_safe_attack_equity(chase_balance, shield_target, debt_objects)
        
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
            cashflow_items = session.exec(select(CashflowItem)).all()
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
def get_dashboard_monitor(timeframe: str = "monthly", type: str = "income"):
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

        # Base Query: Filter by date
        query = select(Transaction).where(Transaction.date >= start_date)
        
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
def get_peace_shield_data():
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD
        accounts = session.exec(select(Account)).all()
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
def get_velocity_projections():
    """Calculate real velocity banking projections from account data."""
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        
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
def get_freedom_path():
    """Get the month-by-month freedom path simulation."""
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
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
def get_simulation(extra_cash: float):
    """Simulate payoff with custom extra monthly cash."""
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
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
def get_tactical_gps():
    """Generate the precise day-by-day movement schedule."""
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        cashflows = session.exec(select(CashflowItem)).all()
        
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
        # Find all asset accounts (checking/savings) with positive balance
        asset_accounts = [
            DebtAccount(
                name=acc.name,
                balance=acc.balance,
                interest_rate=acc.interest_rate,
                min_payment=Decimal('0'),
                due_day=acc.due_day if acc.due_day else 1
            )
            for acc in accounts 
            if acc.type in ["checking", "savings"] and acc.balance > 0
        ]
        
        # Sort by balance descending to find the strongest account
        funding_account = None
        if asset_accounts:
            asset_accounts.sort(key=lambda x: x.balance, reverse=True)
            funding_account = asset_accounts[0]
        
        # Get User Shield Target
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        movements = generate_tactical_schedule(debts, cf_tactical, checking_balance, funding_account, shield_target)
        
        # Convert Movement objects to dict for JSON serialization
        results = []
        for m in movements:
            results.append({
                "day": m.date.day, # Keep 'day' for frontend compatibility if needed, or derived
                "date": m.date.isoformat(),
                "display_date": m.display_date,
                "title": m.title,
                "description": m.description,
                "amount": float(m.amount),
                "type": m.type,
                "source": m.source,
                "destination": m.destination
            })
        return results

from models import User, Account, CashflowItem, Transaction, MovementLog, TransactionCreate
# ... other imports ...
from fastapi import Depends
from database import get_session
from datetime import date, timedelta
from typing import List
from pydantic import BaseModel
from velocity_engine import DebtAccount, CashflowTactical, generate_tactical_schedule, get_projections, Movement, simulate_freedom_path, calculate_minimum_payment
from fastapi import HTTPException


class MovementExecute(BaseModel):
    movement_key: str
    title: str
    amount: float
    date_planned: str
    source: str
    destination: str

@app.post("/api/strategy/execute")
def execute_movement(data: MovementExecute, session: Session = Depends(get_session)):
    """
    Executes a tactical movement by creating a transaction and UPDATING BALANCES.
    """
    amount = Decimal(str(data.amount))
    
    # 1. Find Source Account (e.g. Chase)
    source_acc = session.exec(select(Account).where(Account.name == data.source)).first()
    
    # If source is explicit "External" or "Salary", we might not have an account for it.
    # But if it's "Chase Checking", we must find it.
    if source_acc:
        source_acc.balance -= amount
        session.add(source_acc)
        
    # 2. Find Destination Account (e.g. Credit Card)
    dest_acc = session.exec(select(Account).where(Account.name == data.destination)).first()
    if dest_acc:
        # If destination is a Debt account, paying it reduces the balance.
        # usually Debt is positive liabilities. Paying it reduces liability.
        dest_acc.balance -= amount
        
        # Auto-update Min Payment
        if dest_acc.type == "debt":
            dest_acc.min_payment = calculate_minimum_payment(dest_acc.balance, dest_acc.interest_rate)
             
        session.add(dest_acc)
    
    # 3. Record Transaction
    # If we found accounts, link them. If not, just record string names.
    # FIX: SQLite enforces NOT NULL on account_id. 
    # If source is external (Salary), use Destination ID (Credit Card).
    primary_account_id = source_acc.id if source_acc else (dest_acc.id if dest_acc else None)
    
    if not primary_account_id:
        print("EXECUTION ABORTED: No internal account linked.")
        # If we return success here, the UI might be happy but no record created.
        # But let's raise error for now to confirm connectivity.
        raise HTTPException(status_code=400, detail="Execution Failed: Source nor Destination account found in DB.")

    try:
        tx = Transaction(
            date=date.today().isoformat(), # Ensure string format
            amount=amount,
            description=f"Velocity Execution: {data.title}",
            category="Debt Payment" if dest_acc else "Transfer",
            account_id=primary_account_id,
            is_manual=False
        )
        session.add(tx)
        session.commit()
        return {
            "status": "executed", 
            "new_balance_source": source_acc.balance if source_acc else "N/A",
            "source_found": bool(source_acc),
            "dest_found": bool(dest_acc)
        }
    except Exception as e:
        print(f"EXECUTION ERROR: {e}")
        raise HTTPException(status_code=400, detail=f"Execution Failed: {str(e)}")

@app.get("/api/debug/accounts")
def debug_list_accounts(session: Session = Depends(get_session)):
    return session.exec(select(Account)).all()

@app.get("/api/strategy/executed-logs")
def get_executed_logs():
    """Retrieve all logged strategic movements."""
    with Session(engine) as session:
        return session.exec(select(MovementLog)).all()

# --- RUTAS TRANSACCIONES ---
@app.post("/api/transactions", response_model=Transaction)
def create_transaction(tx: TransactionCreate):
    with Session(engine) as session:
        # 1. Guardar Transacción
        db_tx = Transaction.from_orm(tx)
        session.add(db_tx)
        
        # 2. Actualizar Balance de la Cuenta automáticamente
        account = session.get(Account, tx.account_id)
        if account:
            # Si es Checking: Ingreso (+) aumenta balance, Gasto (-) reduce.
            # Si es Deuda: Pago (+) reduce deuda, Gasto (-) aumenta deuda.
            # (Para simplificar este MVP, usaremos lógica bancaria estándar: + aumenta fondos, - reduce fondos)
            # NOTA: Para DEUDA, un gasto AUMENTA el balance (la deuda crece), un pago DISMINUYE.
            # Vamos a asumir que el usuario envía negativo para gastos y positivo para pagos/ingresos.
            # Pero en DEUDA es al revés. Definamos esto claramente.
            # Convención: 
            #   - DEBT ACCOUNT: + Amount = Pago a la Deuda (Reduce Balance). - Amount = Gasto (Aumenta Balance).
            #   - ASSET ACCOUNT: + Amount = Ingreso (Aumenta Balance). - Amount = Gasto (Reduce Balance).
            
            amount_decimal = Decimal(str(tx.amount))
            
            if account.type == "debt":
                # En deuda, el balance es positivo (monto debido).
                # Un pago positivo REDUCE la deuda.
                # Un gasto negativo AUMENTA la deuda (se vuelve mas debida).
                # Ejemplo: Deuda $1000. Pago $200 -> Balance $800. Gasto -$50 -> Balance $1050.
                account.balance -= amount_decimal
            else:
                # En activos, normal.
                account.balance += amount_decimal
                
            session.add(account)
            
        session.commit()
        session.refresh(db_tx)
        return db_tx

@app.get("/api/accounts/{account_id}/transactions", response_model=List[Transaction])
def get_account_transactions(account_id: int):
    with Session(engine) as session:
        return session.exec(select(Transaction).where(Transaction.account_id == account_id).order_by(Transaction.date.desc())).all()

# --- RUTAS PLAID ---
from plaid_service import create_link_token, exchange_public_token, get_accounts as plaid_get_accounts, sync_transactions
from pydantic import BaseModel

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
def api_import_plaid_accounts():
    """Import Plaid accounts into CoreX database."""
    access_token = plaid_tokens.get("current")
    if not access_token:
        raise HTTPException(status_code=400, detail="No bank linked. Connect a bank first.")
    
    try:
        plaid_accounts = plaid_get_accounts(access_token)
        imported = []
        
        with Session(engine) as session:
            for acc in plaid_accounts:
                # Check if account already exists by plaid_account_id
                existing_account = session.exec(select(Account).where(Account.plaid_account_id == acc["plaid_account_id"])).first()
                
                if existing_account:
                    # Update balance and mask
                    existing_account.balance = Decimal(str(abs(acc["balance"])))
                    existing_account.name = f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name']
                    continue

                # Map Plaid types to CoreX types
                corex_type = "checking"
                if acc["type"] == "credit":
                    corex_type = "debt"
                elif acc["type"] == "depository":
                    corex_type = "checking" if acc["subtype"] in ["checking", None] else "savings"
                
                # Create CoreX account
                new_account = Account(
                    name=f"{acc['name']} (...{acc['mask']})" if acc['mask'] else acc['name'],
                    type=corex_type,
                    balance=Decimal(str(abs(acc["balance"]))),
                    interest_rate=Decimal("0"),  # Plaid doesn't provide this
                    min_payment=Decimal("0"),
                    payment_frequency="monthly",
                    plaid_account_id=acc["plaid_account_id"]
                )
                session.add(new_account)
                imported.append(new_account.name)
            
            session.commit()
        
        return {"success": True, "imported": imported, "count": len(imported)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ... imports ...
from transaction_classifier import classify_transaction

# ...

@app.post("/api/plaid/sync_transactions")
def api_sync_transactions(data: PlaidAccessToken):
    """Sync transactions from Plaid and persist to DB."""
    try:
        result = sync_transactions(data.access_token)
        
        counts = {"added": 0, "skipped": 0}
        
        with Session(engine) as session:
            # Get all accounts that have a plaid_account_id
            accounts = session.exec(select(Account).where(Account.plaid_account_id != None)).all()
            account_map = {acc.plaid_account_id: acc.id for acc in accounts}
            
            for tx in result.get("added", []):
                # 1. Map to local account
                local_account_id = account_map.get(tx["plaid_account_id"])
                if not local_account_id:
                    counts["skipped"] += 1
                    continue
                
                # 2. Check if transaction already exists
                existing = session.exec(select(Transaction).where(Transaction.plaid_transaction_id == tx["plaid_transaction_id"])).first()
                if existing:
                    counts["skipped"] += 1
                    continue
                
                # 3. Classify Transaction (Radar)
                # Plaid amounts: positive = spend, negative = income
                plaid_amount = Decimal(str(tx["amount"]))
                classification = classify_transaction(
                    amount=plaid_amount,
                    name=tx["name"],
                    merchant_name=tx.get("merchant_name"),
                    category=tx.get("category"),
                )
                
                # Format: "Tag: Original Category"
                smart_category = f"{classification['tag'].title()}: {tx['category']}"
                
                # 4. Save new transaction
                # CoreX standard: Positive = Income/Payment to Debt, Negative = Expense
                # Plaid: Positive = Spend -> CoreX: Negative
                # Plaid: Negative = Income -> CoreX: Positive
                corex_amount = plaid_amount * Decimal("-1")
                
                new_tx = Transaction(
                    account_id=local_account_id,
                    date=tx["date"],
                    amount=corex_amount,
                    description=tx["name"],
                    category=smart_category, # Use smart category
                    plaid_transaction_id=tx["plaid_transaction_id"]
                )
                session.add(new_tx)
                counts["added"] += 1
            
            session.commit()
            
            # --- AUTO-VERIFICATION LOGIC ---
            # After syncing, check if any 'executed' movements match new transactions
            pending_logs = session.exec(select(MovementLog).where(MovementLog.status == "executed")).all()
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
def create_manual_transaction(tx: TransactionCreate):
    """Manually create a transaction and update account balance."""
    with Session(engine) as session:
        account = session.get(Account, tx.account_id)
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        # Create transaction
        new_tx = Transaction(
            account_id=tx.account_id,
            amount=tx.amount,
            description=tx.description,
            category=tx.category,
            date=tx.date,
            plaid_transaction_id=f"manual-{uuid.uuid4()}" 
        )
        session.add(new_tx)
        
        # Update Account Balance logic
        # Assets: Positive = Income (Add), Negative = Expense (Subtract) -> balance += amount
        # Debts: Positive = Payment (Subtract), Negative = Spend (Add) -> balance -= amount
        if account.type == "debt":
            account.balance -= tx.amount
            # Auto-update Min Payment
            account.min_payment = calculate_minimum_payment(account.balance, account.interest_rate)
        else:
            account.balance += tx.amount
            
        session.add(account)
        session.commit()
        session.refresh(new_tx)
        return new_tx

@app.get("/api/transactions/recent", response_model=List[Transaction])
def get_recent_transactions(limit: int = 10):
    """Fetch most recent transactions across all accounts."""
    with Session(engine) as session:
        return session.exec(
            select(Transaction).order_by(Transaction.date.desc()).limit(limit)
        ).all()


# ================================================================
# PEACE SHIELD — Emergency Fund Status
# ================================================================

@app.get("/api/peace-shield")
def get_shield_status():
    """Returns the current Peace Shield (Emergency Fund) status."""
    with Session(engine) as session:
        # Get User Settings
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD
        
        accounts = session.exec(select(Account)).all()
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        return get_peace_shield_status(Decimal(str(liquid_cash)), shield_target=shield_target)

class ShieldUpdate(BaseModel):
    target: float

@app.put("/api/user/me/shield")
def update_shield_target(data: ShieldUpdate):
    """Update the user's Peace Shield target amount."""
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.shield_target = Decimal(str(data.target))
        session.add(user)
        session.commit()
        return {"ok": True, "new_target": data.target}


# ================================================================
# PURCHASE SIMULATOR — Time-Cost Calculator
# ================================================================

class SimulatorRequest(BaseModel):
    amount: float

@app.post("/api/simulator/time-cost")
def simulate_purchase_cost(req: SimulatorRequest):
    """Calculate how many days a purchase delays freedom."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
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
def get_classified_transactions(limit: int = 50):
    """Return transactions with CoreX smart tags (income/debt/life)."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).order_by(Transaction.date.desc()).limit(limit)
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
def get_cashflow_intelligence():
    """Return the AI-classified cashflow summary."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).order_by(Transaction.date.desc()).limit(100)
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

