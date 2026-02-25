"""
Velocity Banking Engine for KoreX Financial System.
Core financial calculations for debt optimization strategy.

Uses Decimal for precision as per project standards.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass



DEFAULT_PEACE_SHIELD = Decimal("1000.00")  # Dave Ramsey starter fund

def calculate_minimum_payment(balance: Decimal, apr: Decimal) -> Decimal:
    """
    Calculates minimum monthly payment: (Balance * (APR / 12)) + (Balance * 0.01)
    Floor: $25 or Total Balance if less.
    """
    # Enforce Decimal types to avoid float errors
    try:
        b = Decimal(str(balance)) if balance is not None else Decimal("0")
        a = Decimal(str(apr)) if apr is not None else Decimal("0")
    except:
        return Decimal("0.00")

    if b <= 0:
        return Decimal("0.00")
    
    # Formula: (Balance * (APR% / 12)) + (Balance * 1%)
    monthly_interest = b * (a / Decimal("100") / Decimal("12"))
    principal_payment = b * Decimal("0.01")
    calculated = monthly_interest + principal_payment
    
    floor = Decimal("25.00")
    
    if b < floor:
        result = b
    else:
        result = max(floor, calculated)
    
    return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@dataclass
class DebtAccount:
    """Represents a debt account for calculations."""
    name: str
    balance: Decimal
    interest_rate: Decimal  # Annual APR as percentage (e.g., 24.99)
    min_payment: Decimal
    due_day: int = 15
    closing_day: int = 0  # Statement closing day (0 = not set)
    debt_subtype: str = ""  # credit_card, heloc, auto_loan, mortgage, etc.
    credit_limit: Decimal = Decimal('0')  # For revolving accounts
    is_active: bool = True # For simulation
    
    @property
    def monthly_rate(self) -> Decimal:
        """Convert annual APR to monthly rate."""
        return (self.interest_rate / Decimal('100')) / Decimal('12')
    
    @property
    def is_revolving(self) -> bool:
        """True for credit cards, HELOCs, and UILs (have grace periods)."""
        return self.debt_subtype in ("credit_card", "heloc", "uil")

@dataclass
class VelocityWeapon:
    """A credit line (HELOC/UIL) used offensively to attack higher-APR debt."""
    name: str
    balance: Decimal
    credit_limit: Decimal
    interest_rate: Decimal  # APR as percentage (e.g., 8.75)
    weapon_type: str        # "heloc" or "uil"

    @property
    def available_credit(self) -> Decimal:
        return max(self.credit_limit - self.balance, Decimal('0'))

    @property
    def daily_rate(self) -> Decimal:
        return self.interest_rate / Decimal('100') / Decimal('365')


def calculate_chunk_benefit(
    weapon: VelocityWeapon,
    target: DebtAccount,
    monthly_net_cashflow: Decimal = Decimal('0'),
) -> Optional[Dict]:
    """
    Calculate the financial benefit of deploying a velocity chunk.
    Only profitable if weapon APR < target APR (interest arbitrage).
    Returns None if chunk would lose money.
    """
    # Guard: no arbitrage if weapon costs more than target
    if weapon.interest_rate >= target.interest_rate:
        return None
    if weapon.available_credit <= Decimal('0') or target.balance <= Decimal('0'):
        return None

    # Optimal chunk: min(available credit, 80% monthly cashflow, target balance)
    cashflow_limit = monthly_net_cashflow * Decimal('0.80') if monthly_net_cashflow > 0 else weapon.available_credit
    optimal_chunk = min(
        weapon.available_credit,
        cashflow_limit,
        target.balance,
    )
    # Floor: at least $500 to be worth the effort
    if optimal_chunk < Decimal('500'):
        return None

    # Net daily savings = (target_daily_rate - weapon_daily_rate) * chunk_amount
    target_daily_rate = target.interest_rate / Decimal('100') / Decimal('365')
    weapon_daily_rate = weapon.daily_rate
    net_daily_savings = (target_daily_rate - weapon_daily_rate) * optimal_chunk
    annual_savings = net_daily_savings * Decimal('365')

    return {
        "weapon_name": weapon.name,
        "weapon_type": weapon.weapon_type,
        "weapon_apr": float(weapon.interest_rate),
        "target_name": target.name,
        "target_apr": float(target.interest_rate),
        "chunk_amount": float(optimal_chunk.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
        "net_daily_savings": float(net_daily_savings.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
        "annual_savings": float(annual_savings.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
        "arbitrage_spread": float(target.interest_rate - weapon.interest_rate),
    }


@dataclass
class FreedomMilestone:
    month_date: str # YYYY-MM
    name: str # "Sapphire Preferred Paid Off"
    type: str # "debt_paid" or "freedom"

@dataclass
class MonthSnapshot:
    date: str # YYYY-MM
    events: List[FreedomMilestone]
    total_balance: Decimal
    debts_active: int
    interest_paid: Decimal
    is_freedom_month: bool = False


def calculate_months_to_payoff(
    balance: Decimal,
    apr: Decimal,
    monthly_payment: Decimal
) -> int:
    """
    Calculate months required to pay off a debt.
    
    Uses amortization formula. Returns 0 if payment can't cover interest.
    """
    if balance <= 0:
        return 0
    if monthly_payment <= 0:
        return 600  # Infinite/Cap
        
    monthly_rate = (apr / Decimal('100')) / Decimal('12')
    
    # If payment doesn't cover monthly interest, debt will never be paid
    monthly_interest = balance * monthly_rate
    if monthly_payment <= monthly_interest:
        return 600  # Cap at 50 years (Functional Infinity)
    
    # Simplified iterative approach for precision
    months = 0
    remaining = balance
    
    while remaining > 0 and months < 600:  # Max 50 years
        interest = remaining * monthly_rate
        principal = monthly_payment - interest
        if principal <= 0:
            return 600
        remaining -= principal
        months += 1
    
    return months



def calculate_debt_free_date(
    debts: List[DebtAccount],
    extra_monthly: Decimal = Decimal('0')
) -> Dict:
    """
    Calculate the debt-free date using standard vs. velocity strategy.
    
    Args:
        debts: List of debt accounts
        extra_monthly: Extra cash available for velocity payments
        
    Returns:
        Dict with projections for both strategies
    """
    if not debts:
        return {
            "standard_months": 0,
            "velocity_months": 0,
            "standard_date": date.today().isoformat(),
            "velocity_date": date.today().isoformat(),
            "months_saved": 0,
            "interest_saved": Decimal('0')
        }
    
    # 1. Standard Strategy (Min Payments Only)
    standard_sim = simulate_freedom_path(debts, Decimal('0'))
    
    # 2. Velocity Strategy (Min + Extra)
    velocity_sim = simulate_freedom_path(debts, extra_monthly)
    
    months_saved = standard_sim["total_months"] - velocity_sim["total_months"]
    interest_saved = Decimal(str(standard_sim["total_interest_paid"])) - Decimal(str(velocity_sim["total_interest_paid"]))
    
    return {
        "standard_months": standard_sim["total_months"],
        "velocity_months": velocity_sim["total_months"],
        "standard_date": standard_sim["freedom_date"],
        "velocity_date": velocity_sim["freedom_date"],
        "months_saved": max(0, months_saved),
        "interest_saved": max(Decimal('0'), interest_saved).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    }





def calculate_total_interest(
    balance: Decimal,
    apr: Decimal,
    monthly_payment: Decimal
) -> Decimal:
    """
    Calculate total interest paid over the life of the debt.
    """
    if balance <= 0 or monthly_payment <= 0:
        return Decimal('0')
    
    monthly_rate = (apr / Decimal('100')) / Decimal('12')
    total_interest = Decimal('0')
    remaining = balance
    months = 0
    
    while remaining > 0 and months < 600:
        interest = (remaining * monthly_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_interest += interest
        principal = monthly_payment - interest
        if principal <= 0:
            break
        remaining -= principal
        months += 1
    
    return total_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def get_velocity_target(debts: List[DebtAccount]) -> Optional[DebtAccount]:
    """
    Determine the highest-priority debt to attack (Velocity Target).
    
    Strategy: Target debt with highest APR first (Avalanche method).
    Alternative strategies could include Snowball (lowest balance first).
    """
    if not debts:
        return None
    
    # Filter out zero-balance debts
    active_debts = [d for d in debts if d.balance > 0]
    if not active_debts:
        return None
    
    # Avalanche: Highest interest rate first
    return max(active_debts, key=lambda d: d.interest_rate)


def detect_debt_alerts(debts: List[DebtAccount]) -> List[Dict]:
    """
    Scans all active debts for dangerous conditions.
    
    Returns a list of alerts with severity levels:
    - CRITICAL: Min payment doesn't cover monthly interest (debt grows infinitely)
    - WARNING:  <10% of payment goes to principal (debt trap)
    - CAUTION:  Payoff > 360 months (30+ years)
    """
    alerts = []
    
    for debt in debts:
        if debt.balance <= 0:
            continue
        
        monthly_interest = (debt.balance * (debt.interest_rate / Decimal('100'))) / Decimal('12')
        monthly_interest = monthly_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # CRITICAL: Payment doesn't cover interest
        if debt.min_payment <= monthly_interest:
            alerts.append({
                "severity": "critical",
                "debt_name": debt.name,
                "title": "Payment Doesn't Cover Interest",
                "message": (
                    f"{debt.name}: ${float(debt.min_payment):,.2f}/mo payment "
                    f"< ${float(monthly_interest):,.2f}/mo interest at "
                    f"{float(debt.interest_rate)}% APR. Debt grows infinitely."
                ),
                "details": {
                    "balance": float(debt.balance),
                    "apr": float(debt.interest_rate),
                    "min_payment": float(debt.min_payment),
                    "monthly_interest": float(monthly_interest),
                    "shortfall": float(monthly_interest - debt.min_payment),
                },
                "recommendation": (
                    f"Increase payment to at least ${float(monthly_interest + Decimal('50')):,.2f}/mo "
                    f"or negotiate a lower rate."
                ),
            })
            continue  # Skip lower-severity checks for this debt
        
        # WARNING: <10% of payment goes to principal
        principal_portion = debt.min_payment - monthly_interest
        principal_pct = (principal_portion / debt.min_payment * Decimal('100')).quantize(
            Decimal('0.1'), rounding=ROUND_HALF_UP
        )
        
        if principal_pct < Decimal('10'):
            alerts.append({
                "severity": "warning",
                "debt_name": debt.name,
                "title": "Debt Trap — Slow Progress",
                "message": (
                    f"{debt.name}: Only {float(principal_pct)}% of your "
                    f"${float(debt.min_payment):,.2f} payment goes to principal. "
                    f"${float(monthly_interest):,.2f} is swallowed by interest."
                ),
                "details": {
                    "balance": float(debt.balance),
                    "apr": float(debt.interest_rate),
                    "principal_pct": float(principal_pct),
                    "monthly_interest": float(monthly_interest),
                },
                "recommendation": (
                    f"Add extra payments to break free faster. "
                    f"Even ${float(principal_portion * 2):,.2f} extra/mo doubles your progress."
                ),
            })
            continue
        
        # CAUTION: Payoff > 360 months (30 years)
        months = calculate_months_to_payoff(debt.balance, debt.interest_rate, debt.min_payment)
        if months > 360:
            years = round(months / 12, 1)
            alerts.append({
                "severity": "caution",
                "debt_name": debt.name,
                "title": "Extended Payoff Timeline",
                "message": (
                    f"{debt.name}: At current payments, payoff takes "
                    f"{years} years ({months} months)."
                ),
                "details": {
                    "balance": float(debt.balance),
                    "apr": float(debt.interest_rate),
                    "months_to_payoff": months,
                    "years_to_payoff": years,
                },
                "recommendation": "Consider debt consolidation or increasing monthly payments.",
            })
    
    # Sort: critical first, then warning, then caution
    severity_order = {"critical": 0, "warning": 1, "caution": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))
    
    return alerts



@dataclass
class CashflowTactical:
    """Represents a cashflow for tactical scheduling."""
    name: str
    amount: Decimal
    day_of_month: int
    category: str  # income, expense

@dataclass
class Movement:
    """Represents a specific financial movement recommendation."""
    date: date
    display_date: str
    title: str
    description: str
    amount: Decimal
    type: str  # pump, payment, expense, attack
    source: str
    destination: str

def generate_tactical_schedule(
    debts: List[DebtAccount],
    cashflows: List[CashflowTactical],
    checking_balance: Decimal,
    funding_account: Optional[DebtAccount] = None,
    shield_target: Decimal = DEFAULT_PEACE_SHIELD
) -> List[Movement]:
    """
    Generates the tactical schedule based on PURE ATTACK LOGIC.
    
    Principles:
    1. NO Income recommendations (User manages income manually).
    2. ATTACK FUNDS = Chase Balance - Peace Shield Target.
    3. If Attack Funds > 0 -> Pay off debt immediately.
    4. Explicit instructions: "Pagar $X hoy desde Chase Cuenta".
    """
    today = date.today()
    movements: List[Movement] = []
    
    # 1. Sort Debts by Interest Rate (Avalanche Method)
    # Highest interest first.
    sorted_debts = sorted(debts, key=lambda x: x.interest_rate, reverse=True)
    
    # 2. Identify Attacks Funds available NOW
    # Formula: Attack Funds = Current Checking Balance - Peace Shield Target
    attack_funds = checking_balance - shield_target
    
    # Funding Source Name (Hardcoded preference or dynamic)
    funding_source_name = funding_account.name if funding_account else "Chase Cuenta"
    
    if attack_funds > Decimal('0'):
        # WE HAVE AMMO. ATTACK!
        remaining_ammo = attack_funds
        
        for debt in sorted_debts:
            if remaining_ammo <= 0:
                break
                
            if debt.balance <= 0:
                continue
            
            # Determine payment amount
            # If we can pay off the whole debt, do it.
            # Otherwise, use all remaining ammo.
            payment_amount = min(remaining_ammo, debt.balance)
            
            if payment_amount > 0:
                # Create the Attack Movement
                movements.append(Movement(
                    date=today, # IMMEDIATE EXECUTION
                    display_date=today.strftime("%B %d, %Y"),
                    title=f"PAY OFF: {debt.name}" if payment_amount == debt.balance else f"ATTACK: {debt.name}",
                    description=f"🎯 ATTACK: Pagar ${payment_amount:,.2f} hoy desde {funding_source_name} (Funds available above Shield).",
                    amount=payment_amount,
                    type="attack",
                    source=funding_source_name,
                    destination=debt.name
                ))
                
                remaining_ammo -= payment_amount
                # debt.balance -= payment_amount # We don't update the object here to avoid side effects if reused, but for simulation it's fine.
    
    return sorted(movements, key=lambda x: x.date)


def generate_action_plan(
    debts: List[DebtAccount],
    cashflows: List[CashflowTactical],
    checking_balance: Decimal,
    funding_account_name: str = "Chase Cuenta",
    shield_target: Decimal = DEFAULT_PEACE_SHIELD,
    weapons: Optional[List[VelocityWeapon]] = None,
) -> List[Dict]:
    """
    Generates a 2-month action plan by simulating day-by-day cashflow.
    
    Produces a chronological list of ALL financial events:
    - Income arrivals
    - Minimum payment due dates
    - Attack opportunities (after income, when funds > shield)
    
    Each movement includes an impact estimate (daily_interest_saved, days_shortened).
    """
    today = date.today()
    end_date = today + timedelta(days=62)  # ~2 months forward
    
    movements: List[Dict] = []
    sim_balance = checking_balance
    
    # Clone debts so simulation doesn't mutate originals
    sim_debts = [
        DebtAccount(
            name=d.name, balance=d.balance,
            interest_rate=d.interest_rate,
            min_payment=d.min_payment,
            due_day=d.due_day,
            debt_subtype=d.debt_subtype,
            credit_limit=d.credit_limit,
        ) for d in debts if d.balance > 0
    ]
    
    # Clone weapons so simulation doesn't mutate originals
    sim_weapons = [
        VelocityWeapon(
            name=w.name, balance=w.balance, credit_limit=w.credit_limit,
            interest_rate=w.interest_rate, weapon_type=w.weapon_type,
        ) for w in (weapons or [])
        if w.available_credit > Decimal('500')  # Only weapons with meaningful credit
    ]
    
    # Track which income days trigger chunk deployments (first income of each month)
    chunk_deployed_months: set = set()
    
    # Sort by interest rate for avalanche attacks
    sim_debts.sort(key=lambda x: x.interest_rate, reverse=True)
    
    # Track original balances for progress percentage
    original_balances = {d.name: float(d.balance) for d in sim_debts}
    
    # Separate incomes and expenses from cashflows
    incomes = [cf for cf in cashflows if cf.category == "income"]
    
    current = today
    while current <= end_date:
        day_num = current.day
        display = current.strftime("%B %d, %Y")
        iso = current.isoformat()
        
        # ─── 1. MIN PAYMENTS on due dates ───────────────────
        for debt in sim_debts:
            if debt.balance <= 0:
                continue
            if debt.due_day == day_num:
                payment = min(debt.min_payment, debt.balance)
                if payment > 0:
                    bal_before = float(debt.balance)
                    new_debt_bal = float(debt.balance - payment)
                    new_fund_bal = float(sim_balance - payment)
                    orig = original_balances.get(debt.name, bal_before)
                    progress = round((1 - new_debt_bal / orig) * 100, 1) if orig > 0 else 100.0
                    movements.append({
                        "day": day_num,
                        "date": iso,
                        "display_date": display,
                        "title": f"MIN PAYMENT: {debt.name}",
                        "description": f"Minimum payment due for {debt.name}",
                        "amount": float(payment),
                        "type": "min_payment",
                        "source": funding_account_name,
                        "destination": debt.name,
                        "daily_interest_saved": 0,
                        "days_shortened": 0,
                        "balance_before": bal_before,
                        "balance_after": new_debt_bal,
                        "total_interest_saved": 0,
                        "funding_balance_after": new_fund_bal,
                        "debt_progress_pct": progress,
                    })
                    sim_balance -= payment
                    debt.balance -= payment
        
        # ─── 2. INCOME arrivals ─────────────────────────────
        for inc in incomes:
            if inc.day_of_month == day_num:
                new_fund_bal = float(sim_balance + inc.amount)
                movements.append({
                    "day": day_num,
                    "date": iso,
                    "display_date": display,
                    "title": f"INCOME: {inc.name}",
                    "description": f"${float(inc.amount):,.2f} deposited to {funding_account_name}",
                    "amount": float(inc.amount),
                    "type": "income",
                    "source": inc.name,
                    "destination": funding_account_name,
                    "daily_interest_saved": 0,
                    "days_shortened": 0,
                    "balance_before": 0,
                    "balance_after": 0,
                    "total_interest_saved": 0,
                    "funding_balance_after": new_fund_bal,
                    "debt_progress_pct": 0,
                })
                sim_balance += inc.amount
        
        # ─── 3. VELOCITY CHUNK — Phase 0 (credit line deployment) ──
        # On income days, deploy chunks from low-APR weapons to high-APR debts
        month_key = (current.year, current.month)
        income_today = any(inc.day_of_month == day_num for inc in incomes)
        
        if sim_weapons and income_today and month_key not in chunk_deployed_months:
            # One chunk deployment per month to keep it manageable
            for weapon in sorted(sim_weapons, key=lambda w: w.interest_rate):
                if weapon.available_credit < Decimal('500'):
                    continue
                
                # Find best target: highest APR debt that's more expensive than weapon
                eligible_targets = [
                    d for d in sim_debts
                    if d.balance > Decimal('0')
                    and d.interest_rate > weapon.interest_rate
                    and d.debt_subtype not in ('heloc', 'uil')  # Don't chunk weapon-to-weapon
                ]
                if not eligible_targets:
                    continue
                
                target = max(eligible_targets, key=lambda d: d.interest_rate)
                
                # Calculate optimal chunk
                chunk_amount = min(
                    weapon.available_credit,
                    target.balance,
                    Decimal('15000'),  # Cap per chunk to manage risk
                )
                if chunk_amount < Decimal('500'):
                    continue
                
                # Calculate arbitrage benefit
                target_daily = target.interest_rate / Decimal('100') / Decimal('365')
                weapon_daily = weapon.daily_rate
                net_daily_savings = float(
                    ((target_daily - weapon_daily) * chunk_amount)
                    .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                )
                annual_savings = round(net_daily_savings * 365, 2)
                
                bal_before = float(target.balance)
                new_target_bal = float(target.balance - chunk_amount)
                orig = original_balances.get(target.name, bal_before)
                progress = round((1 - max(new_target_bal, 0) / orig) * 100, 1) if orig > 0 else 100.0
                
                movements.append({
                    "day": day_num,
                    "date": iso,
                    "display_date": display,
                    "title": f"⚡ VELOCITY CHUNK: {target.name}",
                    "description": (
                        f"Deploy ${float(chunk_amount):,.2f} from {weapon.name} ({float(weapon.interest_rate)}% APR) "
                        f"→ {target.name} ({float(target.interest_rate)}% APR). "
                        f"Net arbitrage: ${net_daily_savings}/day (${annual_savings}/yr)"
                    ),
                    "amount": float(chunk_amount),
                    "type": "velocity_chunk",
                    "source": weapon.name,
                    "destination": target.name,
                    "daily_interest_saved": net_daily_savings,
                    "days_shortened": 0,
                    "balance_before": bal_before,
                    "balance_after": new_target_bal,
                    "total_interest_saved": annual_savings,
                    "funding_balance_after": float(sim_balance),  # Checking unchanged
                    "debt_progress_pct": progress,
                    "weapon_name": weapon.name,
                    "weapon_apr": float(weapon.interest_rate),
                    "target_apr": float(target.interest_rate),
                    "arbitrage_spread": float(target.interest_rate - weapon.interest_rate),
                })
                
                # Update simulation state
                target.balance -= chunk_amount
                weapon.balance += chunk_amount  # Weapon balance increases
                chunk_deployed_months.add(month_key)
                break  # One chunk per income event
        
        # ─── 4. ATTACK OPPORTUNITY — 3-Phase Priority ─────────
        # Phase 1: Float Kill (revolving credit in grace period)
        # Phase 2: Hybrid Kill (eliminate small debts for compound benefit)
        # Phase 3: Avalanche (highest APR)
        attack_funds = sim_balance - shield_target
        if attack_funds > Decimal('10'):
            remaining_ammo = attack_funds
            
            # ── Phase 1: FLOAT KILLS (grace period priority) ──
            revolving_due_soon = [
                d for d in sim_debts
                if d.balance > 0
                and d.is_revolving
                and d.due_day > 0
                and _days_until_due(d.due_day, current) <= 25
            ]
            # Sort: smallest balance first (kill the most cards possible)
            revolving_due_soon.sort(key=lambda d: d.balance)
            
            for debt in revolving_due_soon:
                if remaining_ammo <= Decimal('10'):
                    break
                if debt.balance <= 0:
                    continue
                
                payment = min(remaining_ammo, debt.balance)
                is_payoff = payment >= debt.balance
                days_left = _days_until_due(debt.due_day, current)
                
                daily_savings = float(
                    (payment * (debt.interest_rate / Decimal('100')) / Decimal('365'))
                    .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                )
                total_daily_interest = float(
                    (debt.balance * (debt.interest_rate / Decimal('100')) / Decimal('365'))
                    .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                )
                days_short = round(float(payment) / max(total_daily_interest, 0.01))
                
                bal_before = float(debt.balance)
                new_debt_bal = float(debt.balance - payment)
                total_saved = round(daily_savings * days_short, 2)
                new_fund_bal = float(sim_balance - payment)
                orig = original_balances.get(debt.name, bal_before)
                progress = round((1 - max(new_debt_bal, 0) / orig) * 100, 1) if orig > 0 else 100.0
                
                movements.append({
                    "day": day_num,
                    "date": iso,
                    "display_date": display,
                    "title": f"⚡ FLOAT KILL: {debt.name}" if is_payoff else f"⚡ FLOAT ATTACK: {debt.name}",
                    "description": (
                        f"🛡️ Grace period payment — due in {days_left} days. "
                        f"Pay ${float(payment):,.2f} from {funding_account_name} to preserve 0% interest."
                    ),
                    "amount": float(payment),
                    "type": "float_kill",
                    "source": funding_account_name,
                    "destination": debt.name,
                    "daily_interest_saved": daily_savings,
                    "days_shortened": days_short,
                    "balance_before": bal_before,
                    "balance_after": new_debt_bal,
                    "total_interest_saved": total_saved,
                    "funding_balance_after": new_fund_bal,
                    "debt_progress_pct": progress,
                })
                
                remaining_ammo -= payment
                sim_balance -= payment
                debt.balance -= payment
            
            # ── Phase 2: HYBRID KILL (eliminate small debts) ──
            if remaining_ammo > Decimal('10'):
                active_for_hybrid = [d for d in sim_debts if d.balance > 0]
                if len(active_for_hybrid) > 1:
                    avalanche_t = max(active_for_hybrid, key=lambda d: d.interest_rate)
                    killable = [
                        d for d in active_for_hybrid
                        if d.balance <= remaining_ammo and d.name != avalanche_t.name
                    ]
                    
                    for candidate in sorted(killable, key=lambda d: d.balance):
                        # Quick check: does killing this beat pure avalanche?
                        freed_min = candidate.min_payment
                        leftover = remaining_ammo - candidate.balance
                        partial_savings = leftover * avalanche_t.monthly_rate if leftover > 0 else Decimal('0')
                        hybrid_benefit = (freed_min + partial_savings) * Decimal('12')
                        
                        avalanche_benefit = (remaining_ammo * avalanche_t.monthly_rate) * Decimal('12')
                        
                        if hybrid_benefit > avalanche_benefit:
                            payment = candidate.balance
                            
                            daily_savings = float(
                                (payment * (candidate.interest_rate / Decimal('100')) / Decimal('365'))
                                .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                            )
                            total_daily_interest = float(
                                (candidate.balance * (candidate.interest_rate / Decimal('100')) / Decimal('365'))
                                .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                            )
                            days_short = round(float(payment) / max(total_daily_interest, 0.01))
                            
                            bal_before = float(candidate.balance)
                            new_fund_bal = float(sim_balance - payment)
                            orig = original_balances.get(candidate.name, bal_before)
                            
                            movements.append({
                                "day": day_num,
                                "date": iso,
                                "display_date": display,
                                "title": f"💡 HYBRID KILL: {candidate.name}",
                                "description": (
                                    f"Eliminate {candidate.name} (${float(payment):,.2f}) → "
                                    f"frees ${float(freed_min):,.2f}/mo for future attacks. "
                                    f"Advantage: ${float(hybrid_benefit - avalanche_benefit):,.2f} over 12mo."
                                ),
                                "amount": float(payment),
                                "type": "hybrid_kill",
                                "source": funding_account_name,
                                "destination": candidate.name,
                                "daily_interest_saved": daily_savings,
                                "days_shortened": days_short,
                                "balance_before": bal_before,
                                "balance_after": 0,
                                "total_interest_saved": round(daily_savings * days_short, 2),
                                "funding_balance_after": new_fund_bal,
                                "debt_progress_pct": 100.0,
                            })
                            
                            remaining_ammo -= payment
                            sim_balance -= payment
                            candidate.balance = Decimal('0')
                            break  # Only 1 hybrid kill per day
            
            # ── Phase 3: AVALANCHE (standard highest-APR attack) ──
            if remaining_ammo > Decimal('10'):
                remaining_debts = [d for d in sim_debts if d.balance > 0]
                remaining_debts.sort(key=lambda x: x.interest_rate, reverse=True)
                
                for debt in remaining_debts:
                    if remaining_ammo <= Decimal('10'):
                        break
                    if debt.balance <= 0:
                        continue
                    
                    payment = min(remaining_ammo, debt.balance)
                    
                    daily_savings = float(
                        (payment * (debt.interest_rate / Decimal('100')) / Decimal('365'))
                        .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    )
                    total_daily_interest = float(
                        (debt.balance * (debt.interest_rate / Decimal('100')) / Decimal('365'))
                        .quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                    )
                    days_short = round(float(payment) / max(total_daily_interest, 0.01))
                    
                    is_payoff = payment >= debt.balance
                    
                    bal_before = float(debt.balance)
                    new_debt_bal = float(debt.balance - payment)
                    total_saved = round(daily_savings * days_short, 2)
                    new_fund_bal = float(sim_balance - payment)
                    orig = original_balances.get(debt.name, bal_before)
                    progress = round((1 - max(new_debt_bal, 0) / orig) * 100, 1) if orig > 0 else 100.0
                    
                    movements.append({
                        "day": day_num,
                        "date": iso,
                        "display_date": display,
                        "title": f"PAY OFF: {debt.name}" if is_payoff else f"ATTACK: {debt.name}",
                        "description": f"🎯 Pagar ${float(payment):,.2f} desde {funding_account_name} hacia {debt.name}",
                        "amount": float(payment),
                        "type": "attack",
                        "source": funding_account_name,
                        "destination": debt.name,
                        "daily_interest_saved": daily_savings,
                        "days_shortened": days_short,
                        "balance_before": bal_before,
                        "balance_after": new_debt_bal,
                        "total_interest_saved": total_saved,
                        "funding_balance_after": new_fund_bal,
                        "debt_progress_pct": progress,
                    })
                    
                    remaining_ammo -= payment
                    sim_balance -= payment
                    debt.balance -= payment
        
        current += timedelta(days=1)
    
    return movements


def get_projections(debts: List[DebtAccount], liquid_cash: Decimal) -> Dict:
    """
    Generate complete velocity banking projections.
    
    Args:
        debts: List of debt accounts
        liquid_cash: Available liquid cash for velocity payments
        
    Returns:
        Complete projection data for dashboard
    """
    total_debt = sum(d.balance for d in debts) if debts else Decimal('0')
    total_min_payments = sum(d.min_payment for d in debts) if debts else Decimal('0')
    
    # Assume 20% of liquid cash could be used monthly for velocity
    extra_monthly = (liquid_cash * Decimal('0.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Get velocity target
    target = get_velocity_target(debts)
    target_name = target.name if target else "No Active Debts"
    
    # Calculate projections
    projections = calculate_debt_free_date(debts, extra_monthly)
    
    return {
        "total_debt": float(total_debt),
        "total_min_payments": float(total_min_payments),
        "liquid_cash": float(liquid_cash),
        "velocity_power": float(extra_monthly),
        "velocity_target": target_name,
        "standard_debt_free_date": projections["standard_date"],
        "velocity_debt_free_date": projections["velocity_date"],
        "months_saved": projections["months_saved"],
        "interest_saved": float(projections["interest_saved"]),
        "years_saved": round(projections["months_saved"] / 12, 1)
    }


# ================================================================
# PEACE SHIELD — Emergency Fund Defense System
# ================================================================




def get_peace_shield_status(
    liquid_cash: Decimal,
    shield_target: Decimal = DEFAULT_PEACE_SHIELD,
) -> Dict:
    """
    Evaluate if the Peace Shield (Emergency Fund) is active.

    If liquid cash < shield target, velocity attacks are BLOCKED.
    The user must fill the shield before attacking debt.

    Returns:
        Dict with shield health, fill percentage, and attack authorization.
    """
    fill_amount = min(liquid_cash, shield_target)
    fill_pct = (fill_amount / shield_target * Decimal("100")).quantize(
        Decimal("0.1"), rounding=ROUND_HALF_UP
    )
    deficit = max(Decimal("0"), shield_target - liquid_cash)
    is_active = liquid_cash >= shield_target

    return {
        "shield_target": float(shield_target),
        "current_fill": float(fill_amount),
        "fill_percentage": float(fill_pct),
        "deficit": float(deficit),
        "is_active": is_active,
        "attack_authorized": is_active,
        "status": "FULLY CHARGED" if is_active else "CHARGING",
        "message": (
            "Shield charged. Velocity Attacks authorized."
            if is_active
            else f"Shield needs ${float(deficit):,.2f} more. Attacks paused."
        ),
    }


# --- TACTICAL CALENDAR & SAFETY ENGINE ---

@dataclass
class CalendarDay:
    date: str
    date_obj: date
    events: List[dict]
    starting_balance: Decimal
    ending_balance: Decimal
    is_critical: bool = False # Has Bill
    is_reinforcement: bool = False # Has Income
    status: str = "safe" # safe, warning, danger (below shield)

def generate_projected_calendar(
    start_date: date,
    num_days: int,
    current_liquid_cash: Decimal,
    shield_target: Decimal,
    debts: List[DebtAccount],
    recurring_incomes: List[dict] = None,
    recurring_expenses: List[dict] = None
) -> Dict:
    """
    Simulates daily cashflow to find the 'Lowest Low' and build a visual calendar.
    """
    if recurring_incomes is None:
        # Default fallback if no income data provided
        recurring_incomes = [{"name": "Salary", "amount": Decimal("2000.00"), "day": 12}]

    if recurring_expenses is None:
        recurring_expenses = []

    calendar_days = []
    running_balance = current_liquid_cash
    lowest_projected_balance = current_liquid_cash
    limiting_event = None
    
    # Track reserved amounts for specific bills
    reserved_breakdown = []

    for i in range(num_days):
        current_date = start_date + timedelta(days=i)
        day_num = current_date.day
        
        daily_events = []
        is_critical = False
        is_reinforcement = False
        
        # 1. Check for Bills (Debts)
        for debt in debts:
            # Simple Due Day check. 
            if debt.due_day == day_num:
                amount = debt.min_payment
                running_balance -= amount
                daily_events.append({
                    "name": debt.name,
                    "amount": float(amount),
                    "type": "bill"
                })
                is_critical = True

        # 1b. Check for Recurring Expenses (non-debt bills: rent, utilities, etc.)
        for expense in recurring_expenses:
            if expense["day"] == day_num:
                amount = expense["amount"]
                running_balance -= amount
                daily_events.append({
                    "name": expense["name"],
                    "amount": float(amount),
                    "type": "expense"
                })
                is_critical = True
                
        # 2. Check for Income
        for income in recurring_incomes:
            if income["day"] == day_num:
                amount = income["amount"]
                running_balance += amount
                daily_events.append({
                    "name": income["name"],
                    "amount": float(amount),
                    "type": "income"
                })
                is_reinforcement = True

        # 3. Determine Status
        status = "safe"
        if running_balance < shield_target:
            status = "danger"
        elif running_balance < shield_target * Decimal('1.1'):
            status = "warning"

        # 4. Update Lowest Low
        if running_balance < lowest_projected_balance:
            lowest_projected_balance = running_balance
            # Find the event that caused the dip
            if daily_events:
                 limiting_event = f"{daily_events[-1]['name']} on {current_date.strftime('%b %d')}"
            else:
                 limiting_event = f"Low point on {current_date.strftime('%b %d')}"

        calendar_days.append(CalendarDay(
            date=current_date.strftime("%Y-%m-%d"),
            date_obj=current_date,
            events=daily_events,
            starting_balance=Decimal('0'), # Populated if needed, but ending is key
            ending_balance=running_balance,
            is_critical=is_critical,
            is_reinforcement=is_reinforcement,
            status=status
        ))

    return {
        "calendar": calendar_days,
        "lowest_projected_balance": lowest_projected_balance,
        "limiting_event": limiting_event
    }

def calculate_safe_attack_equity(
    liquid_cash: Decimal,
    shield_target: Decimal,
    debts: List[DebtAccount],
    days_buffer: int = 35, # Look ahead 1 month + buffer
    recurring_incomes: List[dict] = None,
    recurring_expenses: List[dict] = None
) -> Dict:
    """
    Calculates Available Equity based on the 'Lowest Low' projection.
    
    Rule: You can only spend what keeps you ABOVE the Shield at your lowest projected point.
    """
    # 1. Run Simulation
    projection = generate_projected_calendar(
        start_date=date.today(),
        num_days=days_buffer,
        current_liquid_cash=liquid_cash,
        shield_target=shield_target,
        debts=debts,
        recurring_incomes=recurring_incomes,
        recurring_expenses=recurring_expenses
    )
    
    lowest_balance = projection["lowest_projected_balance"]
    limiting_event = projection["limiting_event"]
    
    # 2. Calculate Safe Equity
    # If lowest point > shield, the difference is safe to spend today.
    # If lowest point < shield, we have 0 safe equity (and maybe a problem).
    safe_equity = max(Decimal('0'), lowest_balance - shield_target)
    
    # 3. Calculate "Reserved"
    # Raw Equity would be (Liquid - Shield). 
    # Reserved is the difference between Raw and Safe.
    raw_equity = max(Decimal('0'), liquid_cash - shield_target)
    reserved_for_bills = max(Decimal('0'), raw_equity - safe_equity)
    
    # 4. Build Breakdown
    breakdown = []
    if reserved_for_bills > 0 and limiting_event:
        breakdown.append({
            "name": "Projected Low Point",
            "amount": float(reserved_for_bills),
            "due_date": limiting_event, # Text description
            "days_until": 0 # Not relevant for this logic
        })

    return {
        "safe_equity": safe_equity,
        "raw_equity": raw_equity,
        "reserved_for_bills": reserved_for_bills,
        "breakdown": breakdown,
        "projection_data": projection["calendar"], # Pass this back for the UI!
        "message": f"Reserved ${float(reserved_for_bills):,.2f} to protect against {limiting_event}" if reserved_for_bills > 0 else "Full Power Available"
    }


# ================================================================
# RISKY OPPORTUNITY — "Shield Sacrifice for Acceleration"
# ================================================================


def calculate_risky_opportunity(
    liquid_cash: Decimal,
    shield_target: Decimal,
    debts: List[DebtAccount],
    source_account_name: str = "Checking",
    max_sacrifice_pct: int = 90,
) -> Optional[Dict]:
    """
    Calculates a risky opportunity where the user dips INTO
    their Peace Shield to accelerate debt payoff.

    Rules:
    - Only triggers when shield is >= 100% (fully charged)
    - Max sacrifice: 90% of shield (never below 10%)
    - Must save at least $10/month in interest to be worth showing
    - Targets the highest-APR debt (avalanche)

    Returns None if no worthwhile opportunity exists.
    """
    if shield_target <= 0:
        return None

    # Shield must be fully charged to suggest risky moves
    shield_pct = (min(liquid_cash, shield_target) / shield_target * Decimal('100'))
    if shield_pct < Decimal('100'):
        return None

    # Need a debt target
    target = get_velocity_target(debts)
    if not target:
        return None

    # Calculate max sacrifice amount (up to 90% of shield)
    max_sacrifice = (shield_target * Decimal(str(max_sacrifice_pct)) / Decimal('100')).quantize(
        Decimal('0.01'), rounding=ROUND_HALF_UP
    )

    # Don't overpay the debt — cap at the debt balance
    risk_amount = min(max_sacrifice, target.balance)
    if risk_amount <= Decimal('0'):
        return None

    # Calculate new shield % after sacrifice
    new_liquid = liquid_cash - risk_amount
    new_shield_pct = (new_liquid / shield_target * Decimal('100')).quantize(
        Decimal('0.1'), rounding=ROUND_HALF_UP
    )

    # Calculate interest savings
    interest_saved_monthly = (risk_amount * (target.interest_rate / Decimal('100'))) / Decimal('12')
    interest_saved_monthly = interest_saved_monthly.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Minimum threshold: must save at least $10/month to be worth showing
    if interest_saved_monthly < Decimal('10'):
        return None

    # Daily cost eliminated
    daily_cost = (risk_amount * (target.interest_rate / Decimal('100'))) / Decimal('365')
    daily_cost = daily_cost.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    # Days accelerated
    days_accelerated = 0
    if target.min_payment > 0:
        months_saved = risk_amount / target.min_payment
        days_accelerated = int((months_saved * Decimal('30')).quantize(Decimal('1')))

    # Risk level based on remaining shield %
    new_pct_float = float(new_shield_pct)
    if new_pct_float >= 70:
        risk_level = "moderate"
    elif new_pct_float >= 40:
        risk_level = "high"
    else:
        risk_level = "critical"

    return {
        "risk_amount": float(risk_amount),
        "destination": target.name,
        "destination_apr": float(target.interest_rate),
        "destination_balance": float(target.balance),
        "source_account": source_account_name,
        "shield_before": 100.0,
        "shield_after": float(new_shield_pct),
        "risk_level": risk_level,
        "interest_saved_monthly": float(interest_saved_monthly),
        "days_accelerated": days_accelerated,
        "daily_cost_eliminated": float(daily_cost),
    }


# ================================================================
# PURCHASE TIME-COST SIMULATOR — "The Cost of Living Future"
# ================================================================


def calculate_purchase_time_cost(
    purchase_amount: Decimal,
    debts: list[DebtAccount],
    extra_monthly: Decimal,
) -> Dict:
    """
    Calculate how many extra days a discretionary purchase adds
    to the user's debt-free timeline.

    Logic:
        1. Baseline: Run simulation with current debts.
        2. Impact: Run simulation as if we added 'purchase_amount' to the 
           highest interest debt (Simulating: "I spent this instead of paying off debt").
        3. Difference = days delayed.
    """
    if not debts:
        return {
            "days_delayed": 0,
            "cost_in_interest": 0.0,
            "message": "No active debts — buy freely (but wisely).",
        }

    # 1. Baseline Projection
    baseline = calculate_debt_free_date(debts, extra_monthly)
    baseline_months = baseline["velocity_months"]

    # 2. Simulated Impact (Opportunity Cost)
    # We clone the debts to avoid mutating the original objects
    # We choose the velocity target (highest APR) to add the "phantom debt" to
    # because that's where the money WOULD have gone.
    simulated_debts = [
        DebtAccount(
            name=d.name,
            balance=d.balance,
            interest_rate=d.interest_rate,
            min_payment=d.min_payment,
            due_day=d.due_day
        ) for d in debts
    ]
    
    target = get_velocity_target(simulated_debts)
    if target:
        target.balance += purchase_amount
    
    impact = calculate_debt_free_date(simulated_debts, extra_monthly)
    impact_months = impact["velocity_months"]

    # 3. Calculate Delay
    months_delayed = max(0, impact_months - baseline_months)
    days_delayed = months_delayed * 30

    # 4. Calculate Interest Cost
    # Difference in total interest paid
    baseline_interest = baseline["interest_saved"] # Wait, this is 'saved' vs standard. 
    # We need total interest PAID. calculate_debt_free_date doesn't return total interest paid directly?
    # It returns 'interest_saved'. Standard Interest - Velocity Interest.
    # Standard Interest shouldn't change much for the baseline debts (except the extra phantom debt).
    # Let's verify calculate_debt_free_date return values.
    # It returns "interest_saved".
    
    # We really want (Impact Velocity Interest - Baseline Velocity Interest).
    # Since we don't have that direct value, we can infer it or we should update calculate_debt_free_date to return it.
    # checking velocity_engine.py again... 
    # velocity_interest is calculated locally but not returned explicitly except in the difference.
    
    # Let's estimate using the daily interest method as fallback, 
    # but strictly speaking, the cost is the interest on the purchase amount over the payoff time + interest on existing debt delayed.
    
    # Simple rigorous math: Cost = Impact Total Interest - Baseline Total Interest + Purchase Amount?
    # No, just Interest Difference.
    
    # Since we can't get velocity_interest easily without modifying the helper, 
    # we'll stick to the estimation method but refined.
    
    # ESTIMATION: Average daily interest of the portfolio * days_delayed.
    # + The interest allowed to accrue on the purchase amount itself?
    # If I don't pay off $5000 today, that $5000 accrues 20% APR for N months.
    
    if target:
        # Approximate interest on the diverted funds
        # Interest = Amount * Rate * Time
        years = baseline_months / 12
        diverted_funds_interest = purchase_amount * (target.interest_rate / Decimal('100')) * Decimal(str(years))
    else:
        diverted_funds_interest = Decimal('0')

    cost_in_interest = diverted_funds_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    message = f"This delays your freedom by ~{months_delayed} months."
    
    # Special handling for "Debt Trap" (Infinite/Capped Debt)
    # If the user is already at the 50-year cap, small purchases technically don't delay it further (it's already maxed).
    # We shouldn't scare them with "+9999 days" for a coffee.
    if baseline_months >= 600 and impact_months >= 600:
        days_delayed = 0
        months_delayed = 0
        message = "Timeline capped at 50 years (No measurable delay). Focus on increasing income."
    elif baseline_months < 600 and impact_months >= 600:
        # Real damage: This purchase pushed them over the edge
        days_delayed = 9999
        months_delayed = 999
        message = "CRITICAL: This purchase pushes you into indefinite debt (>50 years)."
    
    return {
        "purchase_amount": float(purchase_amount),
        "days_delayed": days_delayed,
        "months_delayed": months_delayed,
        "cost_in_interest": float(cost_in_interest),
        "message": message,
        "debug": {
            "baseline_months": baseline_months,
            "impact_months": impact_months,
            "target_balance": float(target.balance) if target else 0,
            "extra_monthly": float(extra_monthly),
            "total_debt_count": len(debts),
            "total_debt_balance": float(sum(d.balance for d in debts))
        }
    }


# ================================================================
# FREEDOM PATH SIMULATOR
# ================================================================

def simulate_freedom_path(
    debts: List[DebtAccount],
    extra_monthly_payment: Decimal = Decimal('0')
) -> Dict:
    """
    Simulates the journey to zero debt month-by-month.
    Supports 'What-If' scenarios by accepting extra monthly payment.
    """
    # 1. Clone debts
    sim_debts = [
        DebtAccount(
            name=d.name,
            balance=d.balance,
            interest_rate=d.interest_rate,
            min_payment=d.min_payment,
            due_day=d.due_day
        ) for d in debts if d.balance > 0
    ]
    
    timeline = []
    current_date = date.today().replace(day=1) 
    total_interest_paid = Decimal('0')
    months_elapsed = 0
    max_months = 600
    
    # We need to know who is the Velocity Target to focus fire
    # Re-eval target every month? Yes, Standard Velocity.
    
    while any(d.balance > 0 for d in sim_debts) and months_elapsed < max_months:
        if months_elapsed > 0:
             if current_date.month == 12:
                 current_date = date(current_date.year + 1, 1, 1)
             else:
                 current_date = date(current_date.year, current_date.month + 1, 1)
        
        month_str = current_date.strftime("%Y-%m")
        month_events = []
        monthly_interest_sum = Decimal('0')
        
        # 2. Accrue Interest & Pay Minimums
        # We assume we have enough cash for minimums. 
        for debt in sim_debts:
            if debt.balance <= Decimal('0'):
                continue
                
            interest = (debt.balance * debt.monthly_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            debt.balance += interest
            monthly_interest_sum += interest
            total_interest_paid += interest
            
            payment = min(debt.balance, debt.min_payment)
            debt.balance -= payment
            
            if debt.balance <= Decimal('0.01'):
                 debt.balance = Decimal('0')
                 month_events.append(f"{debt.name} Paid Off")

        # 3. Allocating Extra Cash — GAP-FIRST STRATEGY
        # Step A: Cover interest shortfalls so no debt GROWS
        # Step B: Attack highest APR with remaining extra (Avalanche)
        active_debts = [d for d in sim_debts if d.balance > 0]
        
        if active_debts:
            available_for_attack = extra_monthly_payment
            
            # --- Step A: Cover interest gaps first ---
            for debt in active_debts:
                if available_for_attack <= 0:
                    break
                
                # Calculate this month's interest (already accrued above)
                monthly_interest = (debt.balance * debt.monthly_rate).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
                
                # The min_payment already reduced debt.balance above.
                # But if min_payment < interest that was accrued, the debt grew.
                # We calculate the original shortfall to see if we need to cover it.
                shortfall = monthly_interest - debt.min_payment
                
                if shortfall > 0:
                    gap_payment = min(shortfall, available_for_attack, debt.balance)
                    debt.balance -= gap_payment
                    available_for_attack -= gap_payment
                    
                    if debt.balance <= Decimal('0.01'):
                        debt.balance = Decimal('0')
                        month_events.append(f"{debt.name} Eliminated (gap covered)")
            
            # --- Step B: Avalanche with remaining extra ---
            active_debts = [d for d in sim_debts if d.balance > 0]
            active_debts.sort(key=lambda x: x.interest_rate, reverse=True)
            
            for debt in active_debts:
                if available_for_attack <= 0:
                    break
                
                payment = min(debt.balance, available_for_attack)
                debt.balance -= payment
                available_for_attack -= payment
                
                if debt.balance <= Decimal('0.01'):
                    debt.balance = Decimal('0')
                    month_events.append(f"{debt.name} Eliminated")
        
        # 4. Snapshot
        total_balance = sum(d.balance for d in sim_debts)
        
        snapshot = {
            "date": month_str,
            "month_display": current_date.strftime("%b %Y"),
            "events": list(set(month_events)),
            "total_balance": float(total_balance),
            "debts_active": len([d for d in sim_debts if d.balance > 0]),
            "interest_paid": float(monthly_interest_sum),
            "is_freedom_month": (total_balance <= 0)
        }
        timeline.append(snapshot)
        months_elapsed += 1

    return {
        "timeline": timeline,
        "freedom_date": current_date.strftime("%Y-%m-%d"),
        "freedom_month_display": current_date.strftime("%B %Y"),
        "total_interest_paid": float(total_interest_paid),
        "total_months": months_elapsed
    }


# ================================================================
# FLOAT KILL — Grace Period Priority Attack
# ================================================================

def _days_until_due(due_day: int, ref: date = None) -> int:
    """Calculate days from ref (today) until the next due_day occurrence."""
    if ref is None:
        ref = date.today()
    if due_day <= 0:
        return 999  # No due date info
    
    # If due_day hasn't passed this month, it's this month
    if ref.day <= due_day:
        try:
            target = ref.replace(day=due_day)
        except ValueError:
            # Month doesn't have this day (e.g. Feb 30), use last day
            import calendar
            last_day = calendar.monthrange(ref.year, ref.month)[1]
            target = ref.replace(day=min(due_day, last_day))
    else:
        # Due day already passed this month → next month
        if ref.month == 12:
            next_month = ref.replace(year=ref.year + 1, month=1, day=1)
        else:
            next_month = ref.replace(month=ref.month + 1, day=1)
        import calendar
        last_day = calendar.monthrange(next_month.year, next_month.month)[1]
        target = next_month.replace(day=min(due_day, last_day))
    
    return (target - ref).days


def detect_float_kill_opportunities(
    debts: List[DebtAccount],
    attack_equity: Decimal,
    grace_window_days: int = 25,
) -> List[Dict]:
    """
    Identify credit cards in grace period that can be paid off with attack equity.
    
    Float Kill Logic:
    1. Find revolving debts (credit cards / HELOCs) with a due_day
    2. If days_until_due <= grace_window AND balance <= attack_equity → FLOAT KILL
    3. Priority: smallest payable balance first (clear the most cards)
    
    Returns list of float kill opportunities sorted by priority.
    """
    opportunities = []
    today = date.today()
    
    for debt in debts:
        if debt.balance <= 0:
            continue
        if not debt.is_revolving:
            continue
        if debt.due_day <= 0:
            continue
        
        days_left = _days_until_due(debt.due_day, today)
        
        if days_left > grace_window_days:
            continue
        
        # Calculate daily interest if NOT paid (cost of missing grace period)
        daily_interest = (
            debt.balance * (debt.interest_rate / Decimal('100')) / Decimal('365')
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        
        # Monthly interest cost if grace period is lost
        monthly_interest_cost = (daily_interest * Decimal('30')).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        
        can_kill = debt.balance <= attack_equity
        
        opportunities.append({
            "name": debt.name,
            "balance": float(debt.balance),
            "days_until_due": days_left,
            "daily_interest_at_risk": float(daily_interest),
            "monthly_interest_at_risk": float(monthly_interest_cost),
            "can_kill": can_kill,
            "apr": float(debt.interest_rate),
            "priority": 1 if can_kill else 2,
            "reason": (
                f"Pay ${float(debt.balance):,.2f} in {days_left} days to keep 0% grace period. "
                f"Missing it costs ${float(monthly_interest_cost)}/mo in interest."
            ),
        })
    
    # Sort: killable first, then by balance ascending (smallest kills first)
    opportunities.sort(key=lambda x: (x["priority"], x["balance"]))
    return opportunities


# ================================================================
# CLOSING DAY INTELLIGENCE — Strategic Purchase Timing
# ================================================================

def get_closing_day_intelligence(debts: List[DebtAccount]) -> List[Dict]:
    """
    Analyzes each revolving account's closing_day and due_day to provide
    optimal purchase and payment timing recommendations.
    
    Key Insight:
    - Buy RIGHT AFTER closing day = maximum float (up to ~55 days interest-free)
    - Buy RIGHT BEFORE closing day = minimum float (due in ~25 days)
    - Pay BEFORE due day = keep grace period alive
    
    Returns per-card intelligence with actionable timing advice.
    """
    intelligence = []
    today = date.today()
    
    for debt in debts:
        if not debt.is_revolving:
            continue
        if debt.closing_day <= 0 and debt.due_day <= 0:
            continue
        
        closing_day = debt.closing_day
        due_day = debt.due_day
        current_day = today.day
        
        # ── Calculate grace period length ──
        if closing_day > 0 and due_day > 0:
            if due_day > closing_day:
                grace_days = due_day - closing_day
            else:
                grace_days = (30 - closing_day) + due_day  # wraps month
        else:
            grace_days = 25  # default assumption
        
        # ── Determine current position in billing cycle ──
        if closing_day > 0:
            if current_day <= closing_day:
                days_until_close = closing_day - current_day
                cycle_position = "pre_close"
            else:
                # Statement already closed, in grace period
                days_until_close = (30 - current_day) + closing_day
                cycle_position = "grace_period"
        else:
            days_until_close = None
            cycle_position = "unknown"
        
        days_to_due = _days_until_due(due_day, today) if due_day > 0 else None
        
        # ── Optimal purchase window ──
        # Best: days closing_day+1 to closing_day+10 (max float)
        # Worst: days closing_day-5 to closing_day (closes immediately)
        if closing_day > 0:
            optimal_buy_start = closing_day + 1 if closing_day < 28 else 1
            optimal_buy_end = min(optimal_buy_start + 9, 28)
            
            # Calculate float if you buy TODAY
            if cycle_position == "grace_period":
                # Statement already closed → next statement won't include today's purchases
                # Float = days until NEXT closing + grace period
                float_days_today = days_until_close + grace_days
            else:
                # Pre-close → today's purchases will be on THIS statement
                # Float = days until close + grace period
                float_days_today = days_until_close + grace_days
        else:
            optimal_buy_start = None
            optimal_buy_end = None
            float_days_today = None
        
        # ── Build coaching tips ──
        tips = []
        
        if cycle_position == "grace_period":
            tips.append({
                "type": "optimal_now",
                "message": f"🟢 NOW is the best time to make purchases on {debt.name}. "
                           f"Today's charges won't appear until next statement = ~{float_days_today} days of free float.",
            })
        elif cycle_position == "pre_close" and days_until_close is not None:
            if days_until_close <= 5:
                tips.append({
                    "type": "avoid_now",
                    "message": f"🔴 AVOID purchases on {debt.name} for {days_until_close} days. "
                               f"Statement closes on day {closing_day} — charges today get billed immediately.",
                })
            else:
                tips.append({
                    "type": "moderate",
                    "message": f"🟡 {days_until_close} days until {debt.name} closes. "
                               f"Purchases today get ~{float_days_today} days of float.",
                })
        
        if days_to_due is not None and days_to_due <= 7:
            tips.append({
                "type": "payment_urgent",
                "message": f"⚠️ {debt.name} payment due in {days_to_due} days! "
                           f"Pay statement balance to keep grace period active.",
            })
        
        intelligence.append({
            "name": debt.name,
            "closing_day": closing_day,
            "due_day": due_day,
            "grace_period_days": grace_days,
            "cycle_position": cycle_position,
            "days_until_close": days_until_close,
            "days_until_due": days_to_due,
            "float_days_if_buy_today": float_days_today,
            "optimal_purchase_window": {
                "start_day": optimal_buy_start,
                "end_day": optimal_buy_end,
            } if optimal_buy_start else None,
            "tips": tips,
            "credit_utilization": (
                float((debt.balance / debt.credit_limit * Decimal('100')).quantize(
                    Decimal('0.1'), rounding=ROUND_HALF_UP
                ))
                if debt.credit_limit > 0 else None
            ),
        })
    
    return intelligence


# ================================================================
# HYBRID KILL — Snowball + Avalanche Optimization
# ================================================================

def get_hybrid_kill_target(
    debts: List[DebtAccount],
    attack_equity: Decimal,
    lookahead_months: int = 12,
) -> Optional[Dict]:
    """
    Checks if eliminating a small debt (snowball) yields better compound
    returns than pure avalanche (highest APR).
    
    Logic:
    1. Find the avalanche target (highest APR)
    2. Find debts that can be FULLY ELIMINATED with the attack equity
    3. For each killable debt, calculate: freed_min_payment × remaining_months
    4. Compare: compound value of freed payment vs interest saved by avalanche
    5. If hybrid wins → recommend killing the smaller debt first
    
    Returns the recommended target (may be avalanche or hybrid) with reasoning.
    """
    if not debts or attack_equity <= Decimal('0'):
        return None
    
    active = [d for d in debts if d.balance > 0]
    if not active:
        return None
    
    # 1. Pure Avalanche Target
    avalanche_target = max(active, key=lambda d: d.interest_rate)
    
    # Interest saved by paying attack_equity toward avalanche target
    avalanche_payment = min(attack_equity, avalanche_target.balance)
    avalanche_monthly_interest_saved = (
        avalanche_payment * avalanche_target.monthly_rate
    ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    
    # Total avalanche benefit over lookahead period
    avalanche_total_benefit = avalanche_monthly_interest_saved * Decimal(str(lookahead_months))
    
    # 2. Find killable debts (excluding avalanche target if it can also be killed)
    killable = [
        d for d in active
        if d.balance <= attack_equity and d.name != avalanche_target.name
    ]
    
    if not killable:
        return {
            "strategy": "avalanche",
            "target_name": avalanche_target.name,
            "target_balance": float(avalanche_target.balance),
            "payment_amount": float(avalanche_payment),
            "apr": float(avalanche_target.interest_rate),
            "benefit_monthly": float(avalanche_monthly_interest_saved),
            "benefit_total": float(avalanche_total_benefit),
            "reasoning": (
                f"No debts can be fully eliminated. Attack {avalanche_target.name} "
                f"({float(avalanche_target.interest_rate)}% APR) — saves "
                f"${float(avalanche_monthly_interest_saved)}/mo in interest."
            ),
        }
    
    # 3. Evaluate each killable debt
    best_hybrid = None
    best_hybrid_benefit = Decimal('0')
    
    for candidate in killable:
        # Killing this debt frees up its min_payment every month
        freed_payment = candidate.min_payment
        
        # Remaining equity after the kill goes to avalanche target
        remaining_equity = attack_equity - candidate.balance
        partial_avalanche_savings = (
            remaining_equity * avalanche_target.monthly_rate
        ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) if remaining_equity > 0 else Decimal('0')
        
        # Compound benefit: freed payment accelerates ALL future months
        # Each freed dollar compounds as additional attack power
        hybrid_monthly_benefit = freed_payment + partial_avalanche_savings
        hybrid_total_benefit = hybrid_monthly_benefit * Decimal(str(lookahead_months))
        
        if hybrid_total_benefit > best_hybrid_benefit:
            best_hybrid_benefit = hybrid_total_benefit
            best_hybrid = {
                "kill_target": candidate,
                "freed_payment": freed_payment,
                "remaining_equity": remaining_equity,
                "partial_avalanche_savings": partial_avalanche_savings,
                "monthly_benefit": hybrid_monthly_benefit,
                "total_benefit": hybrid_total_benefit,
            }
    
    # 4. Compare strategies
    if best_hybrid and best_hybrid_benefit > avalanche_total_benefit:
        kill = best_hybrid["kill_target"]
        return {
            "strategy": "hybrid_kill",
            "kill_target_name": kill.name,
            "kill_target_balance": float(kill.balance),
            "kill_target_apr": float(kill.interest_rate),
            "freed_min_payment": float(best_hybrid["freed_payment"]),
            "remaining_equity_to_avalanche": float(best_hybrid["remaining_equity"]),
            "avalanche_target_name": avalanche_target.name,
            "avalanche_target_apr": float(avalanche_target.interest_rate),
            "benefit_monthly": float(best_hybrid["monthly_benefit"]),
            "benefit_total": float(best_hybrid["total_benefit"]),
            "avalanche_benefit_total": float(avalanche_total_benefit),
            "advantage": float(best_hybrid_benefit - avalanche_total_benefit),
            "reasoning": (
                f"💡 HYBRID KILL: Pay off {kill.name} (${float(kill.balance):,.2f}) → "
                f"frees ${float(best_hybrid['freed_payment']):,.2f}/mo. "
                f"Then send remaining ${float(best_hybrid['remaining_equity']):,.2f} to "
                f"{avalanche_target.name}. Net advantage: "
                f"${float(best_hybrid_benefit - avalanche_total_benefit):,.2f} over {lookahead_months} months."
            ),
        }
    
    # Avalanche wins
    return {
        "strategy": "avalanche",
        "target_name": avalanche_target.name,
        "target_balance": float(avalanche_target.balance),
        "payment_amount": float(avalanche_payment),
        "apr": float(avalanche_target.interest_rate),
        "benefit_monthly": float(avalanche_monthly_interest_saved),
        "benefit_total": float(avalanche_total_benefit),
        "reasoning": (
            f"Pure avalanche is optimal. Attack {avalanche_target.name} "
            f"({float(avalanche_target.interest_rate)}% APR) — saves "
            f"${float(avalanche_monthly_interest_saved)}/mo in interest."
        ),
    }


# ================================================================
# INTEREST RATE ARBITRAGE — Savings vs Debt Comparison
# ================================================================

def detect_interest_rate_arbitrage(
    savings_accounts: List[Dict],
    debts: List[DebtAccount],
    min_savings_apr: Decimal = Decimal('0.5'),  # Typical savings APY
) -> List[Dict]:
    """
    Compare savings yields vs debt costs to find net-negative positions.
    
    If savings earn 0.5% APY while credit card charges 24.99% APR,
    every dollar in savings is losing 24.49% net annually.
    
    Args:
        savings_accounts: List of dicts with {name, balance, apy}
        debts: Active debt accounts
        min_savings_apr: Assumed minimum savings APY if not specified
    
    Returns alerts for each arbitrage opportunity.
    """
    if not savings_accounts or not debts:
        return []
    
    alerts = []
    
    # Sort debts by interest rate DESC
    sorted_debts = sorted(debts, key=lambda d: d.interest_rate, reverse=True)
    
    for savings in savings_accounts:
        savings_balance = Decimal(str(savings.get("balance", 0)))
        savings_apy = Decimal(str(savings.get("apy", min_savings_apr)))
        savings_name = savings.get("name", "Savings Account")
        
        if savings_balance <= Decimal('0'):
            continue
        
        for debt in sorted_debts:
            if debt.balance <= 0:
                continue
            
            # Net rate spread
            rate_spread = debt.interest_rate - savings_apy
            
            if rate_spread <= Decimal('0'):
                continue  # Savings earn more than debt costs (rare but possible)
            
            # How much could be transferred?
            transferable = min(savings_balance, debt.balance)
            
            # Annual cost of NOT transferring
            annual_cost = (
                transferable * (rate_spread / Decimal('100'))
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            monthly_cost = (annual_cost / Decimal('12')).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            
            # Savings earned on that amount annually
            savings_earned = (
                transferable * (savings_apy / Decimal('100'))
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            # Debt interest on that amount annually
            debt_cost = (
                transferable * (debt.interest_rate / Decimal('100'))
            ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            
            severity = "critical" if rate_spread > Decimal('15') else (
                "warning" if rate_spread > Decimal('5') else "info"
            )
            
            alerts.append({
                "severity": severity,
                "savings_account": savings_name,
                "savings_balance": float(savings_balance),
                "savings_apy": float(savings_apy),
                "debt_name": debt.name,
                "debt_balance": float(debt.balance),
                "debt_apr": float(debt.interest_rate),
                "rate_spread": float(rate_spread),
                "transferable_amount": float(transferable),
                "annual_net_loss": float(annual_cost),
                "monthly_net_loss": float(monthly_cost),
                "savings_earned_annually": float(savings_earned),
                "debt_cost_annually": float(debt_cost),
                "message": (
                    f"${float(transferable):,.2f} in {savings_name} earns "
                    f"${float(savings_earned)}/yr ({float(savings_apy)}% APY) but "
                    f"{debt.name} costs ${float(debt_cost)}/yr ({float(debt.interest_rate)}% APR). "
                    f"Net loss: ${float(monthly_cost)}/mo. "
                    f"Transfer could save ${float(annual_cost)}/yr."
                ),
                "recommendation": (
                    f"Transfer ${float(transferable):,.2f} from {savings_name} → "
                    f"pay {debt.name}. Saves ${float(monthly_cost)}/mo "
                    f"(${float(annual_cost)}/yr net)."
                ),
            })
            
            break  # Only match each savings account to the highest-APR debt
    
    # Sort by severity then annual loss
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: (severity_order.get(a["severity"], 3), -a["annual_net_loss"]))
    
    return alerts

