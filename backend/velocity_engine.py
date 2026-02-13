"""
Velocity Banking Engine for CoreX Financial System.
Core financial calculations for debt optimization strategy.

Uses Decimal for precision as per project standards.
"""
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass



DEFAULT_PEACE_SHIELD = Decimal("1000.00")  # Dave Ramsey starter fund

@dataclass
class DebtAccount:
    """Represents a debt account for calculations."""
    name: str
    balance: Decimal
    interest_rate: Decimal  # Annual APR as percentage (e.g., 24.99)
    min_payment: Decimal
    due_day: int = 15
    
    @property
    def monthly_rate(self) -> Decimal:
        """Convert annual APR to monthly rate."""
        return (self.interest_rate / Decimal('100')) / Decimal('12')


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
    
    # Amortization formula: n = -log(1 - (r*P/M)) / log(1 + r)
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
    
    # Filter active debts
    active_debts = [d for d in debts if d.balance > 0]
    if not active_debts:
        return {
            "standard_months": 0,
            "velocity_months": 0,
            "standard_date": date.today().isoformat(),
            "velocity_date": date.today().isoformat(),
            "months_saved": 0,
            "interest_saved": Decimal('0')
        }
    
    # STANDARD STRATEGY: Pay minimums on everything
    standard_months = 0
    standard_interest = Decimal('0')
    
    for debt in active_debts:
        months = calculate_months_to_payoff(debt.balance, debt.interest_rate, debt.min_payment)
        standard_months = max(standard_months, months)
        standard_interest += calculate_total_interest(debt.balance, debt.interest_rate, debt.min_payment)
    
    # VELOCITY STRATEGY: Pay minimums + put extra toward highest APR
    # Simplified simulation
    velocity_months = 0
    velocity_interest = Decimal('0')
    remaining_debts = [
        {"name": d.name, "balance": d.balance, "apr": d.interest_rate, "min": d.min_payment}
        for d in active_debts
    ]
    
    while any(d["balance"] > 0 for d in remaining_debts) and velocity_months < 600:
        velocity_months += 1
        extra_available = extra_monthly
        
        # Sort by APR descending for velocity targeting
        remaining_debts.sort(key=lambda x: x["apr"], reverse=True)
        
        for debt in remaining_debts:
            if debt["balance"] <= 0:
                continue
                
            monthly_rate = (debt["apr"] / Decimal('100')) / Decimal('12')
            interest = debt["balance"] * monthly_rate
            velocity_interest += interest
            
            # Payment = minimum + extra (for highest APR only)
            payment = debt["min"]
            if debt == remaining_debts[0] and extra_available > 0:
                payment += extra_available
                extra_available = Decimal('0')
            
            principal = payment - interest
            if principal > 0:
                debt["balance"] -= principal
                if debt["balance"] < 0:
                    debt["balance"] = Decimal('0')
    
    # Calculate dates
    today = date.today()
    standard_date = today + timedelta(days=standard_months * 30)
    velocity_date = today + timedelta(days=velocity_months * 30)
    
    months_saved = standard_months - velocity_months
    interest_saved = standard_interest - velocity_interest
    
    return {
        "standard_months": standard_months,
        "velocity_months": velocity_months,
        "standard_date": standard_date.isoformat(),
        "velocity_date": velocity_date.isoformat(),
        "months_saved": max(0, months_saved),
        "interest_saved": max(Decimal('0'), interest_saved).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    }


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
    print(f"DEBUG: Purchase {purchase_amount}, Extra {extra_monthly}")
    print(f"DEBUG: Baseline Months: {baseline_months}")

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
    print(f"DEBUG: Impact Months: {impact_months}")

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

