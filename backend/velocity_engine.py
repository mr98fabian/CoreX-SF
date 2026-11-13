"""
Velocity Banking Engine for KoreX Financial System.
Core financial calculations for debt optimization strategy.

Uses Decimal for precision as per project standards.
"""
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from datetime import date, timedelta
from typing import List, Dict, Optional
from dataclasses import dataclass



DEFAULT_PEACE_SHIELD = Decimal("1000.00")  # Dave Ramsey starter fund
DEFAULT_ATTACK_PERCENTAGE = Decimal("20")  # % of liquid cash attacked monthly — configurable per user, see UserSettings.attack_percentage

def calculate_minimum_payment(balance: Decimal, apr: Decimal) -> Decimal:
    """The system's single minimum-payment rule (interest + 1% of balance, $35
    floor, whole balance if smaller). Delegates to core_engine.calculators so
    accounts, transactions and every simulation use the same number."""
    from core_engine.calculators import calculate_minimum_payment as _core_minimum
    return _core_minimum(balance, apr)


FIXED_SUBTYPES = ("auto_loan", "mortgage", "personal_loan", "student_loan")

# Occurrences per month for each cashflow frequency
MONTHLY_FACTOR = {
    "monthly": Decimal("1"), "semi_monthly": Decimal("2"), "biweekly": Decimal("26") / Decimal("12"),
    "weekly": Decimal("52") / Decimal("12"), "annually": Decimal("1") / Decimal("12"),
}
# Subscriptions store "annual"; cashflow stores "annually". Same factor, one table.
_FREQ_ALIAS = {"annual": "annually"}


def monthly_amount(amount, frequency: str) -> Decimal:
    """The single monthly normalisation for any recurring amount (cashflow items
    AND subscriptions). Unknown frequency = monthly, as cashflow always did."""
    f = _FREQ_ALIAS.get(frequency, frequency)
    return Decimal(str(amount)) * MONTHLY_FACTOR.get(f, Decimal("1"))


def monthly_surplus(cashflow_items, debts: List["DebtAccount"], subscriptions=()) -> Optional[Decimal]:
    """The user's real monthly attack: income − expenses − active subscriptions
    − debt payments (plan_minimum of each debt), floored at $0. `cashflow_items`
    are (amount, frequency, is_income) tuples; `subscriptions` are (amount,
    frequency) of ACTIVE subscriptions (helpers.load_cashflow_inputs already
    dropped the recurring items that duplicate one). None when there is no
    income on record, so the caller can fall back to its declared default."""
    income = expenses = Decimal("0")
    for amount, frequency in subscriptions:
        expenses += monthly_amount(amount, frequency)
    for amount, frequency, is_income in cashflow_items:
        monthly = monthly_amount(amount, frequency)
        if is_income:
            income += monthly
        else:
            expenses += monthly
    if income <= 0:
        return None
    payments = sum((plan_minimum(d) for d in debts if d.balance > 0), Decimal("0"))
    return max(Decimal("0"), income - expenses - payments).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def plan_minimum(debt: "DebtAccount") -> Decimal:
    """Payment used by projections: installment loans keep their contractual
    payment; revolving debt pays at least the single rule above (a stored value
    can be stale — e.g. Amex $99.96 stored vs $112.97 by the rule), or more if
    the user says they pay more."""
    stored = Decimal(str(debt.min_payment or 0))
    if debt.debt_subtype in FIXED_SUBTYPES:
        return stored
    return max(stored, calculate_minimum_payment(debt.balance, debt.interest_rate))


@dataclass
class DebtAccount:
    """Represents a debt account for calculations."""
    name: str
    balance: Decimal
    interest_rate: Decimal  # Annual APR as percentage (e.g., 24.99)
    min_payment: Decimal
    due_day: Optional[int] = None  # None = no payment date loaded: never billed on any day
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
    extra_monthly: Decimal = Decimal('0'),
    start: Optional[date] = None,
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
            "interest_saved": Decimal('0'),
            "velocity_interest": Decimal('0'),
        }

    # Both routes come from compare_paths (one run of each strategy)
    c = compare_paths(debts, extra_monthly, start)
    return {
        "standard_months": c["minimos"]["meses"],
        "velocity_months": c["plan"]["meses"],
        "standard_date": c["minimos"]["fecha_libre"] or c["minimos"]["fecha_fin_simulada"],
        "velocity_date": c["plan"]["fecha_libre"],
        "months_saved": c["ahorro"]["meses"],
        "interest_saved": c["ahorro"]["intereses"],
        # Interest still paid following the plan (same simulation; read by /api/logros)
        "velocity_interest": c["plan"]["interes_total"],
    }


SIM_MAX_MONTHS = 600  # simulator cap (_simulate_freedom_path)
COMPARE_MIN_DOMAIN = 24


def _years(months: int) -> Decimal:
    return (Decimal(months) / Decimal(12)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)


def _points(timeline: List[Dict], today_balance: Decimal, today: date, upto: Optional[int] = None) -> List[Dict]:
    """Month 0 = today's balance; month i = the simulator's month-end balance i."""
    pts = [{"mes": 0, "fecha": today.isoformat(), "saldo": float(today_balance)}]
    for i, snap in enumerate(timeline[:upto] if upto is not None else timeline, start=1):
        pts.append({"mes": i, "fecha": snap["date"], "saldo": snap["total_balance"]})
    return pts


def compare_paths(
    debts: List[DebtAccount],
    extra_monthly: Decimal = Decimal('0'),
    start: Optional[date] = None,
    fuente_aporte: Optional[str] = None,
) -> Dict:
    """Plan vs minimums only (the Inicio chart). Runs EACH strategy of
    simulate_freedom_path once; calculate_debt_free_date reads from here.

    - plan: minimum + extra, freed payments roll (the user's plan route)
    - minimos: minimums only, revolving minimums recalculated from the balance
      each month (what the bank asks), no roll
    The client computes nothing: every number and state comes from here.
    All figures are ESTIMATES.
    """
    today = start or date.today()
    deuda_hoy = sum((Decimal(str(d.balance)) for d in debts if d.balance > 0), Decimal('0')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    base = {"etiqueta": "estimado", "deuda_hoy": deuda_hoy}
    if deuda_hoy <= 0:
        return {**base, "estado": "sin_deudas", "dominio_meses": 0, "plan": None, "minimos": None,
                "ahorro": {"intereses": Decimal('0'), "meses": 0, "anios": Decimal('0'), "es_minimo": False}}

    min_sim = simulate_freedom_path(debts, Decimal('0'), roll_freed_payments=False, recalc_minimums=True, start=start)
    plan_sim = simulate_freedom_path(debts, extra_monthly, start=start)

    q = lambda x: Decimal(str(x)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)  # noqa: E731
    plan_tope = plan_sim["total_months"] >= SIM_MAX_MONTHS and plan_sim["timeline"][-1]["total_balance"] > 0
    min_tope = min_sim["total_months"] >= SIM_MAX_MONTHS and min_sim["timeline"][-1]["total_balance"] > 0
    dominio = max(COMPARE_MIN_DOMAIN, 2 * plan_sim["total_months"])
    meses_ahorro = max(0, min_sim["total_months"] - plan_sim["total_months"])
    # same quantization as before the refactor (difference first, then round)
    intereses_ahorro = max(Decimal('0'), Decimal(str(min_sim["total_interest_paid"])) - Decimal(str(plan_sim["total_interest_paid"]))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    estado = "sin_ahorro" if meses_ahorro == 0 and intereses_ahorro == 0 else "ok"
    return {
        **base,
        "estado": estado,
        "dominio_meses": dominio,
        "plan": {
            "meses": plan_sim["total_months"],
            "anios": _years(plan_sim["total_months"]),
            "fecha_libre": None if plan_tope else plan_sim["freedom_date"],
            "tope_simulador": plan_tope,
            "interes_total": q(plan_sim["total_interest_paid"]),
            "aporte_mensual": q(extra_monthly),
            "fuente_aporte": fuente_aporte,
            "puntos": _points(plan_sim["timeline"], deuda_hoy, today),
        },
        "minimos": {
            "meses": min_sim["total_months"],
            "anios": _years(min_sim["total_months"]),
            "fecha_libre": None if min_tope else min_sim["freedom_date"],
            # the last month the simulator reached (only for legacy standard_date; never shown)
            "fecha_fin_simulada": min_sim["freedom_date"],
            "anio_libre": None if min_tope else int(min_sim["freedom_date"][:4]),
            "tope_simulador": min_tope,
            "cortado": min_sim["total_months"] > dominio,
            "interes_total": q(min_sim["total_interest_paid"]),
            "puntos": _points(min_sim["timeline"], deuda_hoy, today, upto=dominio),
        },
        "ahorro": {
            "intereses": intereses_ahorro,
            "meses": meses_ahorro,
            "anios": _years(meses_ahorro),
            # minimums hit the simulator cap: the real saving is LARGER than this
            "es_minimo": min_tope,
        },
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
                and (d.due_day or 0) > 0
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


def monthly_attack(surplus: Optional[Decimal], liquid_cash: Decimal, attack_percentage: Decimal) -> Decimal:
    """Monthly attack for simulations: the cashflow surplus when known, else the
    declared default (attack_percentage of liquid cash)."""
    if surplus is not None:
        return surplus
    return (Decimal(str(liquid_cash)) * attack_percentage / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def attack_impact(
    debts: List[DebtAccount],
    target: DebtAccount,
    effective_attack: Decimal,
    liquid_cash: Decimal,
    extra_monthly: Decimal,
    start: Optional[date] = None,
) -> Dict:
    """Today's recommended attack and its consequence, computed honestly.

    - amount is capped at min(attack, target balance, liquid cash): never
      recommend sending more than the debt owes or the user holds.
    - days_accelerated = freedom date WITHOUT the payment minus freedom date
      WITH it, on the same plan route (simulate_freedom_path). The route is
      monthly, so the result is in whole months (0 if the month doesn't move).
    """
    amount = max(Decimal('0'), min(effective_attack, target.balance, Decimal(str(liquid_cash))))
    amount = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    base = simulate_freedom_path(debts, extra_monthly, start=start)
    after = [
        DebtAccount(name=d.name, balance=(d.balance - amount if d.name == target.name else d.balance),
                    interest_rate=d.interest_rate, min_payment=d.min_payment, due_day=d.due_day,
                    debt_subtype=d.debt_subtype)
        for d in debts
    ]
    # If today's payment kills the target, its payment is freed from now on and
    # rolls like any other (otherwise the "after" route would lose it and the
    # payment would look worthless).
    freed = plan_minimum(target) if amount >= target.balance else Decimal('0')
    with_payment = simulate_freedom_path(after, extra_monthly + freed, start=start)
    days = (date.fromisoformat(base["freedom_date"]) - date.fromisoformat(with_payment["freedom_date"])).days
    return {
        "amount": amount,
        "days_accelerated": max(0, days),
        "interest_saved_monthly": ((amount * (target.interest_rate / Decimal('100'))) / Decimal('12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
        "interest_saved_total": max(Decimal('0'), Decimal(str(base["total_interest_paid"])) - Decimal(str(with_payment["total_interest_paid"]))).quantize(Decimal('0.01')),
    }


def get_projections(
    debts: List[DebtAccount],
    liquid_cash: Decimal,
    attack_percentage: Decimal = DEFAULT_ATTACK_PERCENTAGE,
    extra_monthly: Optional[Decimal] = None,
    subscriptions_monthly: Optional[Decimal] = None,
    eaten_by_subscriptions: bool = False,
) -> Dict:
    """
    Generate complete velocity banking projections.
    subscriptions_monthly / eaten_by_subscriptions only surface in the
    assumptions block (the surplus passed in already subtracts them).

    Args:
        debts: List of debt accounts
        liquid_cash: Available liquid cash for velocity payments
        attack_percentage: % of liquid_cash attacked monthly (user-configurable,
            see helpers.get_attack_percentage). Every projection this function
            returns is downstream of this single assumption — it MUST be
            surfaced to the user, never left implicit (see assumptions block).

    Returns:
        Complete projection data for dashboard, including the "assumptions"
        block that makes the attack_percentage and its dollar effect explicit.
    """
    total_debt = sum(d.balance for d in debts) if debts else Decimal('0')
    total_min_payments = sum((min(plan_minimum(d), d.balance) for d in debts if d.balance > 0), Decimal('0'))

    # Real attack = the user's cashflow surplus when known (helpers.get_attack_extra);
    # otherwise the declared default: attack_percentage of liquid cash.
    from_cashflow = extra_monthly is not None
    if not from_cashflow:
        extra_monthly = (liquid_cash * attack_percentage / Decimal('100')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

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
        "velocity_interest": float(projections["velocity_interest"]),
        "years_saved": round(projections["months_saved"] / 12, 1),
        "assumptions": {
            "attack_percentage": float(attack_percentage),
            "liquid_cash_used": float(liquid_cash),
            "extra_monthly_payment": float(extra_monthly),
            "extra_source": "cashflow_surplus" if from_cashflow else "attack_percentage_default",
            **({"subscriptions_monthly": float(subscriptions_monthly)} if subscriptions_monthly is not None else {}),
            "subscriptions_eat_surplus": bool(eaten_by_subscriptions),
            "note": ("Estimate: assumes your monthly surplus (income − expenses − subscriptions − debt payments) goes to debt every month, and paid-off debts' payments roll to the next."
                     if from_cashflow else
                     "Estimate: no income on record, so it assumes this % of your liquid cash goes to debt each month, and paid-off debts' payments roll to the next."),
        },
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

def _event_hits(item: dict, d: date) -> bool:
    """A recurring item hits day d: by exact dates when given (any frequency,
    expanded by the caller), else by day of month (legacy shape)."""
    if "dates" in item:
        return d in item["dates"]
    return item.get("day") == d.day


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
    # No invented income: without real income on record, nothing comes in.
    if recurring_incomes is None:
        recurring_incomes = []

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
            if _event_hits(expense, current_date):
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
            if _event_hits(income, current_date):
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
            "freedom_date_baseline": None,
            "freedom_date_impact": None,
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
        # The engine's own velocity dates (response-only addition; the math above is untouched)
        "freedom_date_baseline": baseline["velocity_date"],
        "freedom_date_impact": impact["velocity_date"],
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

# ── Memo for simulate_freedom_path (perf 2026-11-05) ─────────
# Dashboard, freedom-path, projections and command-center all simulate the
# same inputs on every screen. The key is the FULL input fingerprint (every
# debt's name/balance/rate/payment/subtype + extra + flags + start month):
# - any write (payment, edit, new account, cashflow change) changes the
#   inputs, so a stale projection can never be served;
# - the result depends only on these numbers, so two users can't leak into
#   each other (identical inputs ⇒ identical, user-free output).
# TTL 60 s bounds memory and the month rollover; callers get a deep copy.
_SIM_TTL_S = 60
_SIM_MAX = 512
_sim_cache: Dict[tuple, tuple] = {}


def _sim_key(debts, extra, roll, recalc, start) -> tuple:
    return (
        tuple((d.name, str(d.balance), str(d.interest_rate), str(d.min_payment), d.debt_subtype, d.due_day) for d in debts),
        str(extra), roll, recalc, (start or date.today()).replace(day=1).isoformat(),
    )


def simulate_freedom_path(
    debts: List[DebtAccount],
    extra_monthly_payment: Decimal = Decimal('0'),
    roll_freed_payments: bool = True,
    recalc_minimums: bool = False,
    start: Optional[date] = None,
) -> Dict:
    """Memoized front for _simulate_freedom_path (see the memo note above)."""
    import copy
    import time as _time
    key = _sim_key(debts, extra_monthly_payment, roll_freed_payments, recalc_minimums, start)
    now = _time.monotonic()
    hit = _sim_cache.get(key)
    if hit and now - hit[0] < _SIM_TTL_S:
        return copy.deepcopy(hit[1])
    result = _simulate_freedom_path(debts, extra_monthly_payment, roll_freed_payments, recalc_minimums, start)
    if len(_sim_cache) >= _SIM_MAX:
        _sim_cache.clear()
    _sim_cache[key] = (now, result)
    return copy.deepcopy(result)


def _simulate_freedom_path(
    debts: List[DebtAccount],
    extra_monthly_payment: Decimal = Decimal('0'),
    roll_freed_payments: bool = True,
    recalc_minimums: bool = False,
    start: Optional[date] = None,
) -> Dict:
    """
    Simulates the journey to zero debt month-by-month.
    Supports 'What-If' scenarios by accepting extra monthly payment.

    Plan route (defaults): each debt keeps paying its starting minimum
    (plan_minimum) and, when a debt dies, its freed payment ROLLS into the
    avalanche attack on the next one.
    Baseline route (roll_freed_payments=False, recalc_minimums=True): minimums
    only, revolving minimums recalculated each month from the balance like a
    real card — the honest comparison.
    """
    # 1. Clone debts (keep the subtype: it decides fixed vs revolving minimums)
    sim_debts = [
        DebtAccount(
            name=d.name,
            balance=d.balance,
            interest_rate=d.interest_rate,
            min_payment=plan_minimum(d),
            due_day=d.due_day,
            debt_subtype=d.debt_subtype,
        ) for d in debts if d.balance > 0
    ]

    timeline = []
    current_date = (start or date.today()).replace(day=1)
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

            if recalc_minimums and debt.debt_subtype not in FIXED_SUBTYPES:
                debt.min_payment = calculate_minimum_payment(debt.balance, debt.interest_rate)

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
            # Freed payments of debts already gone keep working (they roll)
            available_for_attack = extra_monthly_payment + (
                sum((d.min_payment for d in sim_debts if d.balance <= 0), Decimal('0')) if roll_freed_payments else Decimal('0'))
            
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
            # Estimated interest per day at this month-end's balances (same helper as the dashboard)
            "daily_interest": float(daily_interest(sim_debts)["total"].quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
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
        if (debt.due_day or 0) <= 0:
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
        if debt.closing_day <= 0 and (debt.due_day or 0) <= 0:
            continue
        
        closing_day = debt.closing_day
        due_day = debt.due_day or 0
        current_day = today.day
        
        # ── Calculate grace period length ──
        if closing_day > 0 and due_day > 0:
            if due_day > closing_day:
                grace_days = due_day - closing_day
            else:
                grace_days = (30 - closing_day) + due_day  # wraps month
        else:
            grace_days = 25  # assumption, labelled estimado below
        
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
            "due_day": due_day or None,
            "grace_period_days": grace_days,
            "grace_period_estimado": not (closing_day > 0 and due_day > 0),
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
                float(round_utilization(card_utilization(debt.balance, debt.credit_limit)))
                if has_credit_limit(debt.credit_limit) else None
            ),
            "credit_utilization_band": utilization_band(card_utilization(debt.balance, debt.credit_limit)),
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



# ── Modo Compra de Casa ──────────────────────────────────────
# Estimation assumptions for the PITI (stated in every response as "estimado")
HOUSE_RATE = Decimal("7")          # % APR, 30-year fixed
HOUSE_TERM_MONTHS = 360
HOUSE_TAX_PCT = Decimal("1.7")     # % of price per year (Texas average)
HOUSE_INSURANCE_PCT = Decimal("0.35")  # % of price per year


def estimated_piti(home_price: Decimal, down_pct: Decimal) -> Decimal:
    """Monthly principal + interest (7%, 30 years) on price × (1 − down) plus
    property tax and homeowner insurance. Mortgage insurance (MIP/PMI) is NOT
    included."""
    loan = home_price * (Decimal("1") - down_pct / Decimal("100"))
    r = HOUSE_RATE / Decimal("1200")
    growth = (Decimal("1") + r) ** HOUSE_TERM_MONTHS
    pi = loan * r * growth / (growth - Decimal("1")) if loan > 0 else Decimal("0")
    tax_ins = home_price * (HOUSE_TAX_PCT + HOUSE_INSURANCE_PCT) / Decimal("100") / Decimal("12")
    return pi + tax_ins


def goal_progress(target: Decimal, saved: Decimal, monthly_saving: Optional[Decimal], today: Optional[date] = None) -> dict:
    """Metas: progress of a savings goal from its declared monthly pace (an ESTIMATE).
    pct = saved / target (0-100, capped), remaining floored at $0, eta_months =
    ceil(remaining / monthly_saving); no pace (None or 0) → eta None; saved ≥ target → completed."""
    target, saved = Decimal(str(target)), Decimal(str(saved))
    remaining = max(Decimal("0"), target - saved)
    completed = target > 0 and saved >= target
    pct = min(Decimal("100"), saved / target * Decimal("100")) if target > 0 else Decimal("0")
    pace = Decimal(str(monthly_saving)) if monthly_saving is not None else None
    eta_months = eta_date = None
    if completed:
        eta_months = 0
    elif pace is not None and pace > 0:
        eta_months = int((remaining / pace).to_integral_value(rounding=ROUND_CEILING))
        start = today or date.today()
        y, m = divmod(start.month - 1 + eta_months, 12)
        eta_date = date(start.year + y, m + 1, min(start.day, 28))
    q = lambda x: x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # noqa: E731
    return {"pct": pct.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP), "remaining": q(remaining),
            "completed": completed, "eta_months": eta_months, "eta_date": eta_date}


def house_goal_estimate(target: Decimal, home_price: Decimal, down_pct: Decimal, closing_pct: Decimal,
                        saved: Decimal, monthly_saving: Optional[Decimal],
                        debt_minimums: Decimal, monthly_income: Optional[Decimal]) -> dict:
    """Down-payment thermometer + DTI guard. Decimal in, Decimal out (callers
    quantize to present). eta_months None without a saving pace; dti None
    without income on record."""
    down = home_price * down_pct / Decimal("100")
    closing = home_price * closing_pct / Decimal("100")
    missing = max(Decimal("0"), target - saved)
    pct = min(Decimal("100"), saved / target * Decimal("100")) if target > 0 else Decimal("0")
    if missing == 0:
        eta = 0
    elif monthly_saving and monthly_saving > 0:
        eta = int((missing / monthly_saving).to_integral_value(rounding="ROUND_CEILING"))
    else:
        eta = None
    piti = estimated_piti(home_price, down_pct)
    dti = (debt_minimums + piti) / monthly_income * Decimal("100") if monthly_income and monthly_income > 0 else None
    return {"down": down, "closing": closing, "reserve": target - down - closing, "missing": missing, "pct": pct,
            "eta_months": eta, "piti": piti, "debt_minimums": debt_minimums, "monthly_income": monthly_income, "dti": dti}


def cashflow_summary(cashflow_items, debts: List["DebtAccount"], subscriptions=()) -> dict:
    """Monthly totals for the Reloj de dinero, Cuentas and Análisis (GET /api/cashflow/summary).
    Same frequency table (monthly_amount) and same debt payments (plan_minimum) as
    monthly_surplus. expenses_monthly = living expenses (recurring, without the
    ones that duplicate a subscription); subscriptions_monthly = active
    subscriptions; outflow = living + subscriptions + payments. Each line is
    rounded once for display and balance_monthly is the arithmetic of the lines
    shown (Ganas − Gastas = Te sobra to the cent). surplus_monthly is
    monthly_surplus itself (floored at $0, None without income)."""
    items = list(cashflow_items)
    subs = list(subscriptions)
    q = lambda x: x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)  # noqa: E731
    expenses = q(sum((monthly_amount(a, f) for a, f, inc in items if not inc), Decimal("0")))
    subs_monthly = q(sum((monthly_amount(a, f) for a, f in subs), Decimal("0")))
    payments = q(sum((plan_minimum(d) for d in debts if d.balance > 0), Decimal("0")))
    income = monthly_income(items)
    surplus = monthly_surplus(items, debts, subs)
    inc = q(income or Decimal("0"))
    return {
        "income_monthly": inc,
        "expenses_monthly": expenses,
        "subscriptions_monthly": subs_monthly,
        "debt_payments_monthly": payments,
        "outflow_monthly": expenses + subs_monthly + payments,
        "surplus_monthly": surplus,
        "balance_monthly": inc - expenses - subs_monthly - payments,
        "has_income": surplus is not None,
    }


def monthly_income(cashflow_items) -> Optional[Decimal]:
    """Monthly income from (amount, frequency, is_income) tuples; None without income."""
    income = sum((monthly_amount(a, f) for a, f, inc in cashflow_items if inc), Decimal("0"))
    return income if income > 0 else None


# ── Panel de crédito (utilización de tarjetas) ────────────────────────────────
# One rule for the whole app: a card has a limit only when credit_limit > 0
# (null or ≤ 0 = "sin límite preestablecido", never an invented limit).
# Utilization = balance / limit, floored at 0 (negative balance = credit in
# favour), no ceiling (over-limit shows > 100%). Scale: ≤10 low · ≤30 mid · >30 high.
UTIL_LOW_MAX = Decimal("10")
UTIL_MID_MAX = Decimal("30")


def has_credit_limit(credit_limit) -> bool:
    return credit_limit is not None and Decimal(credit_limit) > 0


def card_utilization(balance, credit_limit) -> Optional[Decimal]:
    """Utilization % (unrounded) or None when the card has no limit."""
    if not has_credit_limit(credit_limit):
        return None
    return max(Decimal(balance), Decimal("0")) / Decimal(credit_limit) * Decimal("100")


def round_utilization(pct: Decimal) -> Decimal:
    """The 1-decimal % the user sees. Bands are taken from THIS value, so the
    number and its colour always agree (10.04 → "10.0%" low)."""
    return Decimal(pct).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def utilization_band(pct: Optional[Decimal]) -> Optional[str]:
    if pct is None:
        return None
    pct = round_utilization(pct)
    return "low" if pct <= UTIL_LOW_MAX else "mid" if pct <= UTIL_MID_MAX else "high"


def credit_panel(cards) -> dict:
    """cards: iterable of (account_id, balance, credit_limit) for the INCLUDED
    credit cards (the caller already dropped non-cards and plan-locked ones).
    Cards without a limit stay out of the totals and are listed apart."""
    total = used = Decimal("0")
    per_card, no_limit = {}, []
    for acc_id, balance, limit in cards:
        pct = card_utilization(balance, limit)
        if pct is None:
            no_limit.append(acc_id)
            continue
        total += Decimal(limit)
        used += max(Decimal(balance), Decimal("0"))
        per_card[acc_id] = pct
    return {
        "limite_total": total, "usado": used, "disponible": total - used,
        "utilizacion_global": (used / total * Decimal("100")) if total > 0 else None,
        "por_tarjeta": per_card, "sin_limite": no_limit,
    }


# ── Interés diario (one calculation for the whole app) ─────────────────────────
# Estimated interest a debt charges per day at today's balance and APR:
# balance × APR / 36500 (APR in %). Unrounded Decimal; round only to present.
# Callers pass the plan-limited set (filter_active_debt_accounts), the same one
# the dashboard, the command center, logros and the credit panel use.
DAYS_PER_YEAR = Decimal("365")


def debt_daily_interest(balance, apr) -> Decimal:
    b, r = Decimal(str(balance or 0)), Decimal(str(apr or 0))
    if b <= 0 or r <= 0:
        return Decimal("0")
    return b * r / (Decimal("100") * DAYS_PER_YEAR)


def daily_interest(debts) -> dict:
    """debts: objects with .balance and .interest_rate (Account or DebtAccount).
    Returns {"total": Decimal, "por_deuda": [Decimal, ...]} in input order;
    the total is the sum of the UNROUNDED per-debt values (the total rules)."""
    per = [debt_daily_interest(d.balance, d.interest_rate) for d in debts]
    return {"total": sum(per, Decimal("0")), "por_deuda": per}


def interest_periods(daily: Decimal) -> dict:
    """The daily figure carried at today's pace: day ×1, week ×7, month ×365/12, year ×365."""
    d = Decimal(daily)
    return {"dia": d, "semana": d * 7, "mes": d * DAYS_PER_YEAR / 12, "anio": d * DAYS_PER_YEAR}


# ================================================================
# DAILY MISSION — obligations first, then avalanche (Plan-Obligaciones)
# One function feeds Inicio's "único pendiente" and the Plan's mission.
# ================================================================

MISSION_WINDOW_DAYS = 35  # same horizon as calculate_safe_attack_equity's days_buffer
CORTE_LEAD_DAYS = 2       # pay by corte − 2 so the payment posts before the cut
_MONTHS_ES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
              "agosto", "septiembre", "octubre", "noviembre", "diciembre")
_CENT = Decimal('0.01')


@dataclass
class MissionAccount:
    """A debt as the mission sees it. due_day / closing_day are the DB values:
    None means unknown, and an unknown date never becomes an obligation."""
    name: str
    balance: Decimal
    interest_rate: Decimal
    min_payment: Decimal
    debt_subtype: str = ""
    due_day: Optional[int] = None
    closing_day: Optional[int] = None
    last_cut_date: Optional[date] = None       # most recent CutHistory.cut_date
    last_cut_reported: Optional[Decimal] = None
    paid_since_cut: Decimal = Decimal('0')     # payments recorded after that cut
    statement_minimum: Optional[Decimal] = None  # that cut's statement minimum (None = not loaded)
    statement_due: Optional[date] = None         # and its due date


def statement_minimum_due(a: MissionAccount, today: date) -> Decimal:
    """What is still owed of the current statement's MINIMUM: statement_minimum −
    payments since that cut, capped at the balance. 0 when no statement minimum was
    loaded, its due date passed, or it is already covered. Gate (Fase B, safety): the
    mission never sets aside less than this for the cycle."""
    if a.statement_minimum is None or a.statement_due is None or a.statement_due < today or a.balance <= 0:
        return Decimal('0')
    return max(Decimal('0'), min(a.statement_minimum - a.paid_since_cut, a.balance))


def _day_in(year: int, month: int, day: int) -> date:
    import calendar as _cal
    return date(year, month, min(day, _cal.monthrange(year, month)[1]))


def _next_on_or_after(day: int, ref: date) -> date:
    d = _day_in(ref.year, ref.month, day)
    if d >= ref:
        return d
    y, m = (ref.year + 1, 1) if ref.month == 12 else (ref.year, ref.month + 1)
    return _day_in(y, m, day)


def _last_before(day: int, ref: date) -> date:
    d = _day_in(ref.year, ref.month, day)
    if d < ref:
        return d
    y, m = (ref.year - 1, 12) if ref.month == 1 else (ref.year, ref.month - 1)
    return _day_in(y, m, day)


def corte_action_date(cut: date, today: date) -> date:
    """Last day to pay so the card reports $0 on its cut: cut − 2, never before
    today. ONE rule for the daily mission and the calendar's day sheet."""
    return max(today, cut - timedelta(days=CORTE_LEAD_DAYS))


def _fecha_es(d: date) -> str:
    return f"{d.day} de {_MONTHS_ES[d.month - 1]}"


def _usd(x: Decimal) -> str:
    return f"${Decimal(x).quantize(_CENT, rounding=ROUND_HALF_UP):,.2f}"


def _obligation(tipo: str, acc: MissionAccount, monto: Decimal, accion: date, evento: date) -> Dict:
    copy = {
        "corte": f"Deja la {acc.name} en $0 — paga a más tardar el {_fecha_es(accion)} para que reporte $0 el {_fecha_es(evento)}",
        "estado": f"Paga el estado de la {acc.name} ({_usd(monto)}) antes del {_fecha_es(evento)}",
        "minimo": f"Paga el mínimo de la {acc.name} ({_usd(monto)}) antes del {_fecha_es(evento)}, según tu estado de cuenta",
        "prestamo": f"Reserva el pago de la {acc.name} ({_usd(monto)}) para el {_fecha_es(evento)}",
    }[tipo]
    return {"tipo": tipo, "cuenta": acc.name, "monto": monto, "fecha_accion": accion, "fecha_evento": evento, "copy": copy}


def mission_obligations(accounts: List[MissionAccount], today: date, window: int = MISSION_WINDOW_DAYS) -> List[Dict]:
    """The cycle's obligations inside [today, today + window), most urgent first.

    - Fixed loans: the contractual payment on its real due_day.
    - Cards, EXCLUSIVE states:
      (a) after the cut with the statement uncovered: statement = last
          CutHistory.reported_balance − payments since that cut (no record of
          this cycle: the full balance), due on due_day;
      (b) otherwise, before the next cut: the full balance so it reports $0,
          action date = cut − 2, event = cut.
    - Cards with a loaded statement minimum still owed (statement_minimum_due):
      the statement obligation never falls below it; with no statement obligation,
      the minimum is its own obligation ("minimo") on the statement's due date, and
      a cut in the same window reserves only the rest of the balance (no double count).
    """
    end = today + timedelta(days=window)
    out: List[Dict] = []
    for a in accounts:
        if a.balance <= 0:
            continue
        if a.debt_subtype in FIXED_SUBTYPES:
            if a.due_day and a.min_payment > 0:
                due = _next_on_or_after(a.due_day, today)
                if due < end:
                    out.append(_obligation("prestamo", a, min(a.min_payment, a.balance), due, due))
            continue
        stmt_min = statement_minimum_due(a, today)
        if a.closing_day and a.due_day:
            last_close = _last_before(a.closing_day, today)
            stmt_due = _next_on_or_after(a.due_day, last_close + timedelta(days=1))
            if today <= stmt_due:
                this_cycle = a.last_cut_date is not None and a.last_cut_date >= last_close - timedelta(days=3)
                if this_cycle and a.last_cut_reported is not None:
                    pending = a.last_cut_reported - a.paid_since_cut
                else:
                    pending = a.balance
                pending = max(Decimal('0'), min(max(pending, stmt_min), a.balance))
                if pending > 0:
                    out.append(_obligation("estado", a, pending, stmt_due, stmt_due))
                    continue
        rest = a.balance
        if stmt_min > 0 and a.statement_due < end:
            # reserve = max(engine minimum, statement minimum), both net of payments since the cut
            amount = min(max(stmt_min, a.min_payment - a.paid_since_cut), a.balance)
            out.append(_obligation("minimo", a, amount, a.statement_due, a.statement_due))
            rest = a.balance - amount
        if a.closing_day and rest > 0:
            cut = _next_on_or_after(a.closing_day, today)
            if cut < end:
                out.append(_obligation("corte", a, rest, corte_action_date(cut, today), cut))
    # Contractual due dates first: by event date, then hardness (a loan payment
    # or statement due beats a cut on the same day), then the bigger amount.
    hardness = {"prestamo": 0, "estado": 0, "minimo": 0, "corte": 1}
    out.sort(key=lambda o: (o["fecha_evento"], hardness[o["tipo"]], -o["monto"]))
    return out


def _what(o: Dict) -> str:
    noun = {"corte": "el corte", "estado": "el estado", "minimo": "el mínimo", "prestamo": "el pago"}[o["tipo"]]
    return f"{noun} de la {o['cuenta']} del {_fecha_es(o['fecha_evento'])}"


def get_daily_mission(
    accounts: List[MissionAccount],
    liquid_cash: Decimal,
    shield_target: Decimal,
    recurring_incomes: List[dict],
    recurring_expenses: List[dict],
    today: Optional[date] = None,
    window: int = MISSION_WINDOW_DAYS,
) -> Dict:
    """Today's single mission: the most urgent obligation; with none in the
    window, the avalanche attack with what is left after the cycle's reserve.

    - Reserve = sum of the window's obligations. It REPLACES the minimum-payment
      reserve of safe equity for those accounts (they leave the simulation), so
      nothing is counted twice; debts without an obligation keep theirs, and a
      debt with no due_day in the DB is never billed on a default day.
    - Attack = safe equity simulated from (liquid − reserve) with REAL incomes
      and expenses, minus the monthly interest gaps, capped at the target's
      balance and the cash. No income on record: attack 0 (no invented salary).
    - Reserve > liquid: "faltante", the exact amount missing to cover the first
      obligation the cash cannot reach. Never a silent $0 attack.
    """
    today = today or date.today()
    liquid_cash = Decimal(str(liquid_cash))
    obligations = mission_obligations(accounts, today, window)
    reserve = sum((o["monto"] for o in obligations), Decimal('0'))
    covered = {o["cuenta"] for o in obligations}

    open_debts = [a for a in accounts if a.balance > 0]
    gap_debts, gap_cost = [], Decimal('0')
    for a in open_debts:
        mi = (a.balance * (a.interest_rate / Decimal('100')) / Decimal('12')).quantize(_CENT, rounding=ROUND_HALF_UP)
        shortfall = mi - a.min_payment
        if shortfall > 0:
            gap_cost += shortfall
            gap_debts.append({"name": a.name, "shortfall": shortfall, "apr": a.interest_rate})

    def as_debt(a: MissionAccount, billed: bool) -> DebtAccount:
        # due_day 0 never matches a calendar day: no phantom default bill
        return DebtAccount(name=a.name, balance=a.balance, interest_rate=a.interest_rate, min_payment=a.min_payment,
                           due_day=(a.due_day or 0) if billed else 0, closing_day=a.closing_day or 0,
                           debt_subtype=a.debt_subtype)

    sim_debts = [as_debt(a, True) for a in open_debts if a.name not in covered]
    target = get_velocity_target([as_debt(a, False) for a in open_debts])
    attack = Decimal('0')
    if recurring_incomes and target and liquid_cash > reserve:
        safe = calculate_safe_attack_equity(liquid_cash - reserve, shield_target, sim_debts, days_buffer=window,
                                            recurring_incomes=recurring_incomes,
                                            recurring_expenses=recurring_expenses or [])["safe_equity"]
        attack = max(Decimal('0'), min(safe - gap_cost, target.balance, liquid_cash - reserve))
        attack = attack.quantize(_CENT, rounding=ROUND_HALF_UP)

    # The first obligation the cumulative cash cannot reach: a warning of its own
    faltante = None
    if reserve > liquid_cash:
        running = Decimal('0')
        for o in obligations:
            running += o["monto"]
            if running > liquid_cash:
                falta = (running - liquid_cash).quantize(_CENT, rounding=ROUND_HALF_UP)
                faltante = {"tipo": "faltante", "cuenta": o["cuenta"], "monto": falta, "obligacion": o["tipo"],
                            "fecha_accion": o["fecha_accion"], "fecha_evento": o["fecha_evento"],
                            "copy": f"Te faltan {_usd(falta)} para cubrir {_what(o)}"}
                break

    # Headline: the first obligation when the cash covers it; the faltante only
    # when not even the first one is covered.
    mission = None
    if obligations:
        mission = faltante if obligations[0]["monto"] > liquid_cash else obligations[0]
    elif attack > 0:
        mission = {"tipo": "avalancha", "cuenta": target.name, "monto": attack, "fecha_accion": today,
                   "fecha_evento": today, "copy": f"Ataca la {target.name} con {_usd(attack)} hoy"}

    return {
        "mision": mission,
        "faltante": faltante,
        "obligaciones": obligations,
        "reserva": reserve.quantize(_CENT, rounding=ROUND_HALF_UP),
        "ataque": attack,
        "objetivo": target.name if target else None,
        "objetivo_apr": target.interest_rate if target else None,
        "objetivo_saldo": target.balance if target else None,
        "gap_cost": gap_cost,
        "gap_debts": gap_debts,
        "ventana_dias": window,
        "etiqueta": "estimado",
    }


def mission_json(result: Dict) -> Dict:
    """JSON-safe view of get_daily_mission (Decimal to float, date to ISO)."""
    def conv(v):
        if isinstance(v, Decimal):
            return float(v.quantize(_CENT, rounding=ROUND_HALF_UP))
        if isinstance(v, date):
            return v.isoformat()
        if isinstance(v, dict):
            return {k: conv(x) for k, x in v.items()}
        if isinstance(v, list):
            return [conv(x) for x in v]
        return v
    return conv(result)
