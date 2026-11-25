"""
Velocity Banking Engine for KoreX Financial System.
Core financial calculations for debt optimization strategy.

Uses Decimal for precision as per project standards.
"""
from decimal import Decimal, ROUND_HALF_UP, ROUND_CEILING
from datetime import date, timedelta
from typing import Callable, List, Dict, Optional
import dataclasses
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
    plan_path: Optional[Dict] = None,
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
    c = compare_paths(debts, extra_monthly, start, plan_path=plan_path)
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


def _calendar_months(today: date, freedom_date: str) -> int:
    """Months on the calendar from today's month to the freedom month (14 = 14 months away)."""
    f = date.fromisoformat(freedom_date)
    return (f.year - today.year) * 12 + f.month - today.month


def compare_paths(
    debts: List[DebtAccount],
    extra_monthly: Decimal = Decimal('0'),
    start: Optional[date] = None,
    fuente_aporte: Optional[str] = None,
    plan_path: Optional[Dict] = None,
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
    # D4: the user's plan is THE cash route (debt_path) when the caller has it; the monthly
    # route from day 1 only for callers without user data (the public calculator).
    plan_sim = plan_path if plan_path is not None else simulate_freedom_path(debts, extra_monthly, start=start)

    q = lambda x: Decimal(str(x)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)  # noqa: E731
    plan_tope = plan_sim.get("tope_simulador") if plan_path is not None else         plan_sim["total_months"] >= SIM_MAX_MONTHS and plan_sim["timeline"][-1]["total_balance"] > 0
    min_tope = min_sim["total_months"] >= SIM_MAX_MONTHS and min_sim["timeline"][-1]["total_balance"] > 0
    # The user's plan (misión 17): months on the calendar from today, for both routes. Without the
    # cash route (public calculator) the simulator's own month count, as before.
    if plan_path is not None:
        plan_meses = _calendar_months(today, plan_sim["freedom_date"])
        min_meses = _calendar_months(today, min_sim["freedom_date"])
    else:
        plan_meses, min_meses = plan_sim["total_months"], min_sim["total_months"]
    dominio = max(COMPARE_MIN_DOMAIN, 2 * plan_meses)
    meses_ahorro = max(0, min_meses - plan_meses)
    # same quantization as before the refactor (difference first, then round)
    intereses_ahorro = max(Decimal('0'), Decimal(str(min_sim["total_interest_paid"])) - Decimal(str(plan_sim["total_interest_paid"]))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    estado = "sin_ahorro" if meses_ahorro == 0 and intereses_ahorro == 0 else "ok"
    return {
        **base,
        "estado": estado,
        "dominio_meses": dominio,
        "plan": {
            "meses": plan_meses,
            "anios": _years(plan_meses),
            "fecha_libre": None if plan_tope else plan_sim["freedom_date"],
            "tope_simulador": plan_tope,
            "interes_total": q(plan_sim["total_interest_paid"]),
            "aporte_mensual": q(extra_monthly),
            "fuente_aporte": fuente_aporte,
            "puntos": _points(plan_sim["timeline"], deuda_hoy, today),
        },
        "minimos": {
            "meses": min_meses,
            "anios": _years(min_meses),
            "fecha_libre": None if min_tope else min_sim["freedom_date"],
            # the last month the simulator reached (only for legacy standard_date; never shown)
            "fecha_fin_simulada": min_sim["freedom_date"],
            "anio_libre": None if min_tope else int(min_sim["freedom_date"][:4]),
            "tope_simulador": min_tope,
            "cortado": min_meses > dominio,
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
    The only strategy: avalanche (owner's decision 2026-11-13, U-13).
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


def _cash_plan(
    accounts: List["MissionAccount"],
    incomes: List[dict],
    expenses: List[dict],
    liquid_cash: Decimal,
    funding_account_name: str = "Checking",
    shield_target: Decimal = DEFAULT_PEACE_SHIELD,
    weapons: Optional[List[VelocityWeapon]] = None,
    start: Optional[date] = None,
    days: int = 62,
    undated_monthly: Decimal = Decimal('0'),
) -> Dict:
    """THE cash route (misión 17): the daily mission projected day by day from TODAY, with the
    balances and cash the plan has reached. Every day d:
      0. a fixed loan's interest posts on its due day, before its payment;
      1. get_daily_mission(state, cash, …, today=d) decides (obligations first, D1/D2, avalanche);
      2. incomes, dated expenses, the obligations whose action date is d and the plain minimums of
         debts no obligation covers — paid only from cash ABOVE the shield (D1);
      3. the velocity chunk (HELOC/UIL → highest APR above it), once a month on an income day;
      4. only the leftover the mission allowed attacks — strict avalanche (its target);
      5. end of day: a card's cut posts its interest (none if it reports $0: grace) and opens the
         next statement; debts without a cut post at month end; then the day's interest accrues
         (balance × APR / 36500, the same rule as daily_interest).
    The total debt of each day = balances + interest accrued not posted yet, so
    close = open − payments + interest, exactly. Days before `start` are never projected.
    `incomes` / `expenses` are dated events covering [start, start + days + MISSION_WINDOW_DAYS]."""
    import calendar as _cal
    start = start or date.today()
    cash = Decimal(str(liquid_cash))
    state = [dataclasses.replace(a) for a in accounts if a.balance > 0]
    original = {a.name: a.balance for a in state}
    accrued: Dict[str, Decimal] = {a.name: Decimal('0') for a in state}
    sim_weapons = [dataclasses.replace(w) for w in (weapons or []) if w.available_credit > Decimal('500')]
    chunk_months: set = set()
    movements: List[Dict] = []
    points: List[tuple] = []
    months: Dict[str, Dict] = {}

    def money(x: Decimal) -> float:
        return float(Decimal(x).quantize(_CENT, rounding=ROUND_HALF_UP))

    def total() -> Decimal:
        return sum((a.balance for a in state), Decimal('0')) + sum(accrued.values(), Decimal('0'))

    def move(d: date, title: str, description: str, amount: Decimal, kind: str, source: str, destination: str,
             debt: Optional["MissionAccount"] = None, before: Optional[Decimal] = None, **extra) -> None:
        after = debt.balance if debt is not None else None
        orig = original.get(debt.name) if debt is not None else None
        daily_saved = money(amount * debt.interest_rate / Decimal('100') / Decimal('365')) if debt is not None and kind == "attack" else 0
        movements.append({
            "day": d.day, "date": d.isoformat(), "display_date": d.strftime("%B %d, %Y"),
            "title": title, "description": description, "amount": money(amount), "type": kind,
            "source": source, "destination": destination,
            "daily_interest_saved": daily_saved, "days_shortened": 0,
            "balance_before": money(before) if before is not None else 0,
            "balance_after": money(after) if after is not None else 0,
            "total_interest_saved": 0, "funding_balance_after": money(cash),
            "debt_progress_pct": round(float((1 - max(after, Decimal('0')) / orig) * 100), 1) if orig else 0,
            "etiqueta": "estimado", **extra,
        })

    def pay(debt: "MissionAccount", amount: Decimal, ym: str) -> Decimal:
        nonlocal cash
        paid = max(Decimal('0'), min(amount, debt.balance, cash - shield_target))  # D1: never into the shield
        debt.balance -= paid
        debt.paid_since_cut += paid  # a statement / cut paid down stays paid inside the cycle
        cash -= paid
        months[ym]["pagos"] += paid
        return paid

    def post(debt: "MissionAccount", ym: str, grace: bool) -> None:
        amount = accrued.get(debt.name, Decimal('0'))
        accrued[debt.name] = Decimal('0')
        if grace and debt.balance <= 0:
            months[ym]["interes"] -= amount  # paid in full before the cut: no interest charged
            return
        rounded = amount.quantize(_CENT, rounding=ROUND_HALF_UP)
        debt.balance += rounded
        months[ym]["interes"] += rounded - amount

    for offset in range(days + 1):
        d = start + timedelta(days=offset)
        ym = d.isoformat()[:7]
        n = _cal.monthrange(d.year, d.month)[1]
        if ym not in months:
            months[ym] = {"inicio": total(), "pagos": Decimal('0'), "interes": Decimal('0'), "pagadas": []}

        # 0) a fixed loan's interest posts on its due day, before the payment
        for debt in state:
            if debt.debt_subtype in FIXED_SUBTYPES and debt.due_day and d.day == min(debt.due_day, n):
                post(debt, ym, grace=False)

        # 1) the mission decides with the state at the start of the day (it already projects d's flows)
        mission = get_daily_mission(state, cash, shield_target, incomes, expenses, today=d, undated_monthly=undated_monthly)
        due_today = [o for o in mission["obligaciones"] if o["fecha_accion"] == d]
        covered = set(mission["cubiertas"])

        # 2a) incomes
        for inc in incomes:
            if d in inc["dates"]:
                cash += Decimal(str(inc["amount"]))
                move(d, f"INCOME: {inc['name']}", f"{_usd(Decimal(str(inc['amount'])))} entran a {funding_account_name}",
                     Decimal(str(inc["amount"])), "income", inc["name"], funding_account_name)
        # 2b) dated expenses (rent, a move, subscriptions…)
        for exp in expenses:
            if d in exp["dates"]:
                amt = Decimal(str(exp["amount"]))
                cash -= amt
                move(d, f"EXPENSE: {exp['name']}", f"{_usd(amt)} sale de {funding_account_name}", amt, "expense",
                     funding_account_name, exp["name"])
        # 2c) obligations of the cycle whose action date is today (cut to $0, statement, loan, minimum)
        by_name = {a.name: a for a in state}
        for o in due_today:
            debt = by_name.get(o["cuenta"])
            if debt is None or debt.balance <= 0:
                continue
            before = debt.balance
            paid = pay(debt, o["monto"], ym)
            if paid > 0:
                move(d, f"{o['tipo'].upper()}: {debt.name}", o["copy"], paid, "obligation", funding_account_name, debt.name,
                     debt, before, obligacion=o["tipo"], fecha_evento=o["fecha_evento"].isoformat(),
                     **({"degradada": o["degradada"]} if o.get("degradada") else {}))
            short = min(o["monto"], before) - paid
            if short > 0:
                move(d, f"FALTANTE: {debt.name}", f"Te faltan {_usd(short)} para cubrir {_what(o)}", short, "faltante",
                     funding_account_name, debt.name, debt, debt.balance, obligacion=o["tipo"])
        # 2d) plain minimum on due_day for debts the mission does not cover with an obligation
        for debt in state:
            if debt.balance > 0 and debt.name not in covered and debt.debt_subtype not in FIXED_SUBTYPES \
                    and debt.due_day and d.day == debt.due_day:
                before = debt.balance
                minimum = debt.engine_minimum if debt.engine_minimum is not None else debt.min_payment
                paid = pay(debt, minimum, ym)
                if paid > 0:
                    move(d, f"MIN PAYMENT: {debt.name}", f"Pago mínimo de {debt.name}", paid, "min_payment",
                         funding_account_name, debt.name, debt, before)

        # 3) velocity chunk (HELOC/UIL → highest APR above the weapon), once a month on an income day.
        # The weapon's own balance grows by the same amount: the total debt does not move.
        if sim_weapons and (d.year, d.month) not in chunk_months and any(d in inc["dates"] for inc in incomes):
            for weapon in sorted(sim_weapons, key=lambda w: w.interest_rate):
                targets = [a for a in state if a.balance > 0 and a.interest_rate > weapon.interest_rate
                           and a.debt_subtype not in ("heloc", "uil") and a.name != weapon.name]
                if weapon.available_credit < Decimal('500') or not targets:
                    continue
                target = max(targets, key=lambda a: a.interest_rate)
                chunk = min(weapon.available_credit, target.balance, Decimal('15000'))
                if chunk < Decimal('500'):
                    continue
                before = target.balance
                target.balance -= chunk
                weapon.balance += chunk
                line = next((a for a in state if a.name == weapon.name), None)
                if line is None:
                    line = MissionAccount(name=weapon.name, balance=Decimal('0'), interest_rate=weapon.interest_rate,
                                          min_payment=Decimal('0'), debt_subtype=weapon.weapon_type)
                    state.append(line)
                    accrued[line.name] = Decimal('0')
                line.balance += chunk
                spread = (target.interest_rate / Decimal('100') / Decimal('365') - weapon.daily_rate) * chunk
                move(d, f"VELOCITY CHUNK: {target.name}",
                     f"{_usd(chunk)} de {weapon.name} ({float(weapon.interest_rate)}% APR) → {target.name} ({float(target.interest_rate)}% APR)",
                     chunk, "velocity_chunk", weapon.name, target.name, target, before,
                     weapon_name=weapon.name, weapon_apr=float(weapon.interest_rate), target_apr=float(target.interest_rate),
                     arbitrage_spread=float(target.interest_rate - weapon.interest_rate), net_daily_savings=money(spread))
                chunk_months.add((d.year, d.month))
                break

        # 4) only the leftover the mission allowed attacks — strict avalanche (its target)
        attack = min(mission["ataque"], max(Decimal('0'), cash - shield_target))
        target = next((a for a in state if a.name == mission["objetivo"] and a.balance > 0), None)
        if attack > Decimal('10') and target is not None:
            before = target.balance
            paid = pay(target, attack, ym)
            move(d, f"{'PAY OFF' if target.balance <= 0 else 'ATTACK'}: {target.name}",
                 f"Atacar la {target.name} con {_usd(paid)} desde {funding_account_name} (avalancha: el interés más alto)",
                 paid, "attack", funding_account_name, target.name, target, before)

        # 5) end of day: cuts (grace when it reports $0) and month-end posting, then the day's interest
        for debt in state:
            if debt.debt_subtype in FIXED_SUBTYPES:
                if not debt.due_day and d.day == n:
                    post(debt, ym, grace=False)
                continue
            if debt.closing_day and d.day == min(debt.closing_day, n):
                post(debt, ym, grace=True)
                debt.last_cut_date, debt.last_cut_reported, debt.paid_since_cut = d, debt.balance, Decimal('0')
                if debt.balance > 0:
                    minimum = min(plan_minimum(DebtAccount(name=debt.name, balance=debt.balance,
                                                           interest_rate=debt.interest_rate, min_payment=debt.min_payment,
                                                           debt_subtype=debt.debt_subtype)), debt.balance)
                    debt.statement_minimum, debt.engine_minimum = minimum, minimum
                    debt.statement_due = _next_on_or_after(debt.due_day, d + timedelta(days=1)) if debt.due_day else None
                else:
                    debt.statement_minimum, debt.statement_due = None, None
            elif not debt.closing_day and d.day == n:
                post(debt, ym, grace=True)
        for debt in state:
            if debt.balance > 0:
                it = debt_daily_interest(debt.balance, debt.interest_rate)
                accrued[debt.name] = accrued.get(debt.name, Decimal('0')) + it
                months[ym]["interes"] += it
        for name, bal in original.items():
            a = by_name.get(name)
            if a is not None and a.balance <= 0 and name not in months[ym]["pagadas"] and bal > 0 \
                    and not any(name in m["pagadas"] for m in months.values()):
                months[ym]["pagadas"].append(name)
        t = total()
        points.append((d, t))
        months[ym]["cierre"] = t
        months[ym]["activas"] = len([a for a in state if a.balance > 0])
        months[ym]["interes_diario"] = daily_interest([a for a in state if a.balance > 0])["total"]

    return {"movements": movements, "points": points, "months": months, "state": state, "accrued": accrued,
            "cash": cash}


def generate_action_plan(
    accounts: List["MissionAccount"],
    incomes: List[dict],
    expenses: List[dict],
    liquid_cash: Decimal,
    funding_account_name: str = "Checking",
    shield_target: Decimal = DEFAULT_PEACE_SHIELD,
    weapons: Optional[List[VelocityWeapon]] = None,
    start: Optional[date] = None,
    days: int = 62,
) -> List[Dict]:
    """Tactical GPS (U-14): the movements of the cash route (_cash_plan), the daily mission
    projected day by day. So if the mission says attack $0 today, the GPS never opens with an attack."""
    return _cash_plan(accounts, incomes, expenses, liquid_cash, funding_account_name, shield_target, weapons,
                      start, days)["movements"]


DEBT_PATH_HORIZON = 62


def debt_path(
    accounts: List["MissionAccount"],
    incomes: List[dict],
    expenses: List[dict],
    liquid_cash: Decimal,
    shield_target: Decimal,
    extra_monthly: Decimal,
    weapons: Optional[List[VelocityWeapon]] = None,
    today: Optional[date] = None,
    horizon: int = DEBT_PATH_HORIZON,
    is_payday: Optional[Callable[[date], bool]] = None,
    funding_account_name: str = "Checking",
    undated_monthly: Decimal = Decimal('0'),
) -> Dict:
    """THE projection of the user's debt (misión 17, spec §2; D4): the single source of the
    Calendar, the freedom date, «pagarás / ahorrarás», the GPS and the command-center.

    1. Cash leg, from TODAY to the end of the month that holds today + horizon: _cash_plan
       (obligations first, shield, attack only from the leftover, strict avalanche, D1/D2).
    2. Monthly continuation from the first day of the next month, with the balances the cash leg
       left (interest accrued included) and `extra_monthly` (the monthly surplus) — the existing
       plan route (daily_series / simulate_freedom_path), placed on its real days.
    Days before today are never projected: the month's first point is today's debt.
    Every figure is an ESTIMATE."""
    import calendar as _cal
    today = today or date.today()
    reach = today + timedelta(days=horizon)
    end = reach.replace(day=_cal.monthrange(reach.year, reach.month)[1])
    plan = _cash_plan(accounts, incomes, expenses, liquid_cash, funding_account_name, shield_target, weapons,
                      start=today, days=(end - today).days, undated_monthly=undated_monthly)
    q = lambda x: Decimal(x).quantize(_CENT, rounding=ROUND_HALF_UP)  # noqa: E731
    first = today.replace(day=1)
    opening = sum((a.balance for a in accounts if a.balance > 0), Decimal('0'))
    daily = [{"date": first.isoformat(), "total_balance": float(q(opening))}]
    daily += [{"date": d.isoformat(), "total_balance": float(max(q(t), Decimal('0')))} for d, t in plan["points"]]
    resumen, timeline = [], []
    for ym, m in plan["months"].items():
        inicio, cierre, pagos = q(m["inicio"]), max(q(m["cierre"]), Decimal('0')), q(m["pagos"])
        interes = cierre - inicio + pagos  # rounded identity: close = open − payments + interest
        resumen.append({"mes": ym, "inicio": inicio, "cierre": cierre, "pagos": pagos, "interes": interes,
                        "baja": inicio - cierre, "tramo": "caja"})
        d = date.fromisoformat(f"{ym}-01")
        timeline.append({"date": ym, "month_display": d.strftime("%b %Y"),
                         "events": [f"{name} Paid Off" for name in m["pagadas"]], "total_balance": float(cierre),
                         "debts_active": m["activas"], "interest_paid": float(interes),
                         "daily_interest": float(q(m["interes_diario"])), "is_freedom_month": cierre <= 0})
    free = next((date.fromisoformat(f"{r['mes']}-01") for r in resumen if r["cierre"] <= 0), None)
    tope = False
    if free is None:
        cont_debts = [DebtAccount(name=a.name, balance=q(a.balance + plan["accrued"].get(a.name, Decimal('0'))),
                                  interest_rate=a.interest_rate, min_payment=a.min_payment, due_day=a.due_day,
                                  closing_day=a.closing_day or 0, debt_subtype=a.debt_subtype)
                      for a in plan["state"] if a.balance > 0]
        cont = daily_series(cont_debts, Decimal(str(extra_monthly)), is_payday=is_payday, today=end + timedelta(days=1))
        daily += cont["daily_series"]
        prev = resumen[-1]["cierre"] if resumen else q(opening)
        for snap in cont["timeline"]:
            cierre = q(Decimal(str(snap["total_balance"])))
            interes = q(Decimal(str(snap["interest_paid"])))
            resumen.append({"mes": snap["date"], "inicio": prev, "cierre": cierre, "pagos": prev + interes - cierre,
                            "interes": interes, "baja": prev - cierre, "tramo": "mensual"})
            prev = cierre
        timeline += cont["timeline"]
        tope = cont["total_months"] >= SIM_MAX_MONTHS and bool(cont["timeline"]) and cont["timeline"][-1]["total_balance"] > 0
        free = date.fromisoformat(cont["freedom_date"])
    months_to_free = (free.year - today.year) * 12 + free.month - today.month
    return {
        "timeline": timeline,
        "deuda_hoy": float(q(opening)),
        "daily_series": daily,
        "resumen_meses": resumen,
        "freedom_date": free.isoformat(),
        "freedom_month_display": free.strftime("%B %Y"),
        "total_months": months_to_free,
        "total_interest_paid": float(sum((r["interes"] for r in resumen), Decimal('0'))),
        "tope_simulador": tope,
        "movements": plan["movements"],
        "fin_tramo_caja": end.isoformat(),
        "etiqueta": "estimado",
    }


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
    plan_path: Optional[Dict] = None,
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
    projections = calculate_debt_free_date(debts, extra_monthly, plan_path=plan_path)

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
    recurring_expenses: List[dict] = None,
    start_date: Optional[date] = None,
) -> Dict:
    """
    Calculates Available Equity based on the 'Lowest Low' projection.
    start_date: first projected day (default today; the tactical plan projects from each simulated day).
    
    Rule: You can only spend what keeps you ABOVE the Shield at your lowest projected point.
    """
    # 1. Run Simulation
    projection = generate_projected_calendar(
        start_date=start_date or date.today(),
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
        3. Difference = days delayed; cost_in_interest = impact total interest −
           baseline total interest (compare_paths, the simulator's real figure).
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

    # 2. Simulated Impact (Opportunity Cost): the purchase lands on the velocity
    # target (highest APR), where that money would have gone. Full copy of every
    # DebtAccount field (subtype decides fixed vs revolving minimums).
    simulated_debts = [dataclasses.replace(d) for d in debts]
    target = get_velocity_target(simulated_debts)
    if target:
        target.balance += purchase_amount

    impact = calculate_debt_free_date(simulated_debts, extra_monthly)
    impact_months = impact["velocity_months"]

    # 3. Delay
    months_delayed = max(0, impact_months - baseline_months)
    days_delayed = months_delayed * 30

    # 4. Interest cost: total interest of the impact projection minus the baseline's,
    # both from compare_paths (same source as Inicio's chart).
    interest_baseline = Decimal(str(baseline["velocity_interest"]))
    interest_impact = Decimal(str(impact["velocity_interest"]))
    cost_in_interest = (interest_impact - interest_baseline).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

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
        "interest_baseline": float(interest_baseline),
        "interest_impact": float(interest_impact),
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
    return copy.deepcopy(_simulate_cached(key, now, debts, extra_monthly_payment, roll_freed_payments,
                                          recalc_minimums, start)[0])


def _simulate_cached(key, now, debts, extra, roll, recalc, start):
    """(result, flows) from the memo, or a fresh run stored in it. Flows are tuples of
    Decimals (immutable): safe to share without a copy."""
    hit = _sim_cache.get(key)
    if hit and now - hit[0] < _SIM_TTL_S:
        return hit[1], hit[2]
    flows: list = []
    result = _simulate_freedom_path(debts, extra, roll, recalc, start, flows=flows)
    if len(_sim_cache) >= _SIM_MAX:
        _sim_cache.clear()
    _sim_cache[key] = (now, result, flows)
    return result, flows


def _simulate_freedom_path(
    debts: List[DebtAccount],
    extra_monthly_payment: Decimal = Decimal('0'),
    roll_freed_payments: bool = True,
    recalc_minimums: bool = False,
    start: Optional[date] = None,
    flows: Optional[list] = None,
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

    flows (optional, for daily_series): one entry per simulated month,
    (month_first_day, ((index, interest, minimum_paid, attack_paid), ...)), index into
    the debts with balance > 0. They are balance DIFFERENCES (the 1-cent payoff snap
    included), so replaying them reproduces each month's total_balance exactly.
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
        m_int = [Decimal('0')] * len(sim_debts)
        m_min = [Decimal('0')] * len(sim_debts)
        m_atk = [Decimal('0')] * len(sim_debts)

        # 2. Accrue Interest & Pay Minimums
        # We assume we have enough cash for minimums.
        for i, debt in enumerate(sim_debts):
            if debt.balance <= Decimal('0'):
                continue

            if recalc_minimums and debt.debt_subtype not in FIXED_SUBTYPES:
                debt.min_payment = calculate_minimum_payment(debt.balance, debt.interest_rate)

            interest = (debt.balance * debt.monthly_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            debt.balance += interest
            monthly_interest_sum += interest
            total_interest_paid += interest
            
            payment = min(debt.balance, debt.min_payment)
            before = debt.balance
            debt.balance -= payment

            if debt.balance <= Decimal('0.01'):
                 debt.balance = Decimal('0')
                 month_events.append(f"{debt.name} Paid Off")
            m_int[i] = interest
            m_min[i] = before - debt.balance

        # 3. Allocating Extra Cash — pure avalanche (highest APR first)
        active_debts = [d for d in sim_debts if d.balance > 0]
        
        if active_debts:
            # Freed payments of debts already gone keep working (they roll)
            available_for_attack = extra_monthly_payment + (
                sum((d.min_payment for d in sim_debts if d.balance <= 0), Decimal('0')) if roll_freed_payments else Decimal('0'))
            
            # --- Avalanche: all extra to the highest APR (U-13: no gap-first) ---
            active_debts = [d for d in sim_debts if d.balance > 0]
            active_debts.sort(key=lambda x: x.interest_rate, reverse=True)
            
            for debt in active_debts:
                if available_for_attack <= 0:
                    break

                payment = min(debt.balance, available_for_attack)
                before = debt.balance
                debt.balance -= payment
                available_for_attack -= payment

                if debt.balance <= Decimal('0.01'):
                    debt.balance = Decimal('0')
                    month_events.append(f"{debt.name} Eliminated")
                m_atk[next(k for k, x in enumerate(sim_debts) if x is debt)] += before - debt.balance
        
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
        if flows is not None:
            flows.append((current_date, tuple(
                (i, m_int[i], m_min[i], m_atk[i]) for i in range(len(sim_debts)) if m_int[i] or m_min[i] or m_atk[i])))
        months_elapsed += 1

    return {
        "timeline": timeline,
        "freedom_date": current_date.strftime("%Y-%m-%d"),
        "freedom_month_display": current_date.strftime("%B %Y"),
        "total_interest_paid": float(total_interest_paid),
        "total_months": months_elapsed
    }


# ── Daily series (misión 2026-11-23-calendario-serie-diaria) ──
# The calendar's red→green band, from the SAME flows as the monthly simulation
# (nothing is re-simulated), each placed on its real day:
#   interest → the statement cut (closing_day), never after the debt's first payment
#   minimum  → the due day (due_day)
#   attack   → the user's paydays that month, split evenly (the extra is the
#              paydays' surplus); no payday on record → the month's last day
#   no day loaded → the month's last day (conservative: no early credit)
# In the current month, anything dated before `today` lands on `today`: the engine
# starts from today's balances, so those events are not in them yet.
# Each month's close is timeline[i].total_balance exactly, by construction.

def _event_day(n: int, d: Optional[int]) -> int:
    return min(int(d), n) if d and int(d) > 0 else n


def daily_series(
    debts: List[DebtAccount],
    extra_monthly_payment: Decimal = Decimal('0'),
    is_payday: Optional[Callable[[date], bool]] = None,
    today: Optional[date] = None,
) -> Dict:
    """simulate_freedom_path (plan route) + "daily_series": step points
    [{date: YYYY-MM-DD, total_balance}], the balance at the END of that day; a day not
    listed keeps the previous point's value. Always listed: day 1 of the first month
    (the starting total), every day that changes, and every month's last day.
    Estimates, like the timeline."""
    import calendar as _cal
    import copy
    import time as _time
    today = today or date.today()
    key = _sim_key(debts, extra_monthly_payment, True, False, today)
    result, flows = _simulate_cached(key, _time.monotonic(), debts, extra_monthly_payment, True, False, today)
    result = copy.deepcopy(result)
    live = [d for d in debts if d.balance > 0]
    balance = sum((d.balance for d in live), Decimal('0'))
    cent = Decimal('0.01')
    first = today.replace(day=1)
    points = [{"date": first.isoformat(), "total_balance": float(balance)}]
    for month, rows in flows:
        n = _cal.monthrange(month.year, month.month)[1]
        floor = today.day if month == first else 1
        pays = [d for d in range(1, n + 1) if is_payday and is_payday(month.replace(day=d))] or [n]
        delta: Dict[int, Decimal] = {}

        def put(day: int, amount: Decimal):
            if amount:
                day = max(day, floor)
                delta[day] = delta.get(day, Decimal('0')) + amount

        for i, interest, minimum, attack in rows:
            d = live[i]
            due = _event_day(n, d.due_day)
            paid_on = ([due] if minimum else []) + (pays if attack else [])
            put(min([_event_day(n, d.closing_day)] + paid_on), interest)
            put(due, -minimum)
            if attack:
                share = (attack / len(pays)).quantize(cent, rounding="ROUND_DOWN")  # remainder → last payday
                for k, p in enumerate(pays):
                    put(p, -(attack - share * (len(pays) - 1)) if k == len(pays) - 1 else -share)
        for day in sorted(set(delta) | {n}):
            balance += delta.get(day, Decimal('0'))
            points.append({"date": month.replace(day=day).isoformat(), "total_balance": float(balance)})
    result["daily_series"] = points
    return result


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


def payment_impact(amount, apr) -> dict:
    """What a payment stops costing, at the debt's APR (estimate): per day (amount × APR / 36500,
    the daily_interest rule) and per month (× 365/12). The Plan's history shows these as-is."""
    daily = debt_daily_interest(amount, apr)
    return {"ahorro_diario": float(daily.quantize(_CENT, rounding=ROUND_HALF_UP)),
            "ahorro_mensual": float((daily * DAYS_PER_YEAR / 12).quantize(_CENT, rounding=ROUND_HALF_UP))}


def interest_periods_json(daily) -> dict:
    """THE interest per period every screen shows: from the daily figure the user SEES (rounded
    to the cent), so day × 7 = week on screen. Dashboard and Ajustes read this same dict."""
    shown = Decimal(str(daily)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {k: float(v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)) for k, v in interest_periods(shown).items()}


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
    engine_minimum: Optional[Decimal] = None     # plan_minimum capped (what screens charge); None = min_payment


def statement_minimum_due(a: MissionAccount, today: date) -> Decimal:
    """What is still owed of the current statement's MINIMUM: statement_minimum −
    payments since that cut, capped at the balance. 0 when no statement minimum was
    loaded, its due date passed, or it is already covered. Gate (Fase B, safety): the
    mission never sets aside less than this for the cycle."""
    if a.statement_minimum is None or a.statement_due is None or a.statement_due < today or a.balance <= 0:
        return Decimal('0')
    return max(Decimal('0'), min(a.statement_minimum - a.paid_since_cut, a.balance))


def statement_cycle_minimum(a: MissionAccount, today: date) -> Decimal:
    """THE minimum of the current statement's cycle, shared by the daily mission and the
    Calendar (one source): max(engine minimum, statement minimum), both net of payments
    since the cut, capped at the balance. 0 when no statement minimum is still owed —
    then each surface keeps the engine minimum, as before."""
    owed = statement_minimum_due(a, today)
    if owed <= 0:
        return Decimal('0')
    engine = a.engine_minimum if a.engine_minimum is not None else a.min_payment
    return min(max(owed, engine - a.paid_since_cut), a.balance)


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
            amount = statement_cycle_minimum(a, today)  # same number the Calendar paints
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


def _degraded(o: Dict, a: MissionAccount, today: date, end: date) -> Optional[Dict]:
    """D2: the card cannot be paid in full on time, so the cycle reserves only its minimum and the
    rest goes to the avalanche. Corte: the minimum of the statement that cut will produce, due on
    the next due_day after it. Estado: the statement's minimum, on its own due date. None when that
    minimum falls outside the window (nothing to reserve in this cycle)."""
    engine = a.engine_minimum if a.engine_minimum is not None else a.min_payment
    if o["tipo"] == "estado":
        amount = statement_cycle_minimum(a, today) or min(max(engine - a.paid_since_cut, Decimal('0')), a.balance)
        due = o["fecha_evento"]
        copy = (f"No alcanza para pagar todo el estado de la {a.name}: paga el mínimo ({_usd(amount)}) antes del "
                f"{_fecha_es(due)} y lo demás va a la avalancha")
    else:
        if not a.due_day:
            return None
        due = _next_on_or_after(a.due_day, o["fecha_evento"] + timedelta(days=1))
        amount = min(engine, a.balance)
        copy = (f"No alcanza para dejar la {a.name} en $0 antes del corte del {_fecha_es(o['fecha_evento'])}: "
                f"paga el mínimo ({_usd(amount)}) antes del {_fecha_es(due)} y lo demás va a la avalancha")
    if amount <= 0 or due >= end:
        return None
    return {"tipo": "minimo", "cuenta": a.name, "monto": amount, "fecha_accion": due, "fecha_evento": due,
            "copy": copy, "degradada": o["tipo"], "monto_completo": o["monto"]}


_HARDNESS = {"prestamo": 0, "estado": 0, "minimo": 0, "corte": 1}


def _obligation_key(o: Dict):
    return (o["fecha_evento"], _HARDNESS[o["tipo"]], -o["monto"])


def _day_flows(incomes: List[dict], expenses: List[dict], today: date, window: int) -> List[tuple]:
    """(income, expense) of each day of the window, summed once per mission."""
    out = []
    for i in range(window):
        d = today + timedelta(days=i)
        out.append((sum((Decimal(str(e["amount"])) for e in incomes if d in e["dates"]), Decimal('0')),
                    sum((Decimal(str(e["amount"])) for e in expenses if d in e["dates"]), Decimal('0'))))
    return out


def mission_cash_walk(accounts: List[MissionAccount], obligations: List[Dict], covered: set, liquid_cash: Decimal,
                      shield_target: Decimal, recurring_incomes: List[dict], recurring_expenses: List[dict],
                      today: date, window: int, flows: Optional[List[tuple]] = None) -> Dict:
    """The cash the plan will have, day by day, in [today, today + window): THE same order of events as
    the tactical GPS (generate_action_plan): incomes, dated expenses, the obligations whose action
    date is that day (paid only from cash ABOVE the shield, D1), plain minimums of debts no obligation
    covers. Returns the end-of-day cash and the first obligation the cash cannot cover on its date."""
    by_day: Dict[date, List[Dict]] = {}
    for o in sorted(obligations, key=_obligation_key):
        by_day.setdefault(o["fecha_accion"], []).append(o)
    cash = Decimal(str(liquid_cash))
    ends: List[Decimal] = []
    faltante = None
    flows = flows or _day_flows(recurring_incomes, recurring_expenses, today, window)
    for i in range(window):
        d = today + timedelta(days=i)
        cash += flows[i][0] - flows[i][1]
        for o in by_day.get(d, []):
            paid = max(Decimal('0'), min(o["monto"], cash - shield_target))
            cash -= paid
            short = o["monto"] - paid
            if short > 0 and faltante is None:
                falta = short.quantize(_CENT, rounding=ROUND_HALF_UP)
                faltante = {"tipo": "faltante", "cuenta": o["cuenta"], "monto": falta, "obligacion": o["tipo"],
                            "fecha_accion": o["fecha_accion"], "fecha_evento": o["fecha_evento"],
                            "copy": f"Te faltan {_usd(falta)} para cubrir {_what(o)}"}
        for a in accounts:
            if a.balance > 0 and a.name not in covered and a.debt_subtype not in FIXED_SUBTYPES \
                    and a.due_day and d.day == a.due_day:
                minimum = a.engine_minimum if a.engine_minimum is not None else a.min_payment
                cash -= max(Decimal('0'), min(minimum, a.balance, cash - shield_target))
        ends.append(cash)
    return {"cierres": ends, "faltante": faltante}


def get_daily_mission(
    accounts: List[MissionAccount],
    liquid_cash: Decimal,
    shield_target: Decimal,
    recurring_incomes: List[dict],
    recurring_expenses: List[dict],
    today: Optional[date] = None,
    window: int = MISSION_WINDOW_DAYS,
    undated_monthly: Decimal = Decimal('0'),
) -> Dict:
    """Today's single mission: the most urgent obligation; with none in the window, the avalanche
    attack with what is left after the cycle's reserve.

    - Obligations: mission_obligations (loan payments, statements, cuts to $0, statement minimums).
    - D2 (Fabian, 2026-11-24): a card is paid in full (cut to $0 / whole statement) only when the
      projected cash covers it; otherwise the cycle reserves its minimum and the rest goes to the
      avalanche, said openly in the obligation's copy ("degradada"). Hard obligations (loans,
      minimums) are reserved first; cards are decided in date order against the lowest projected
      cash from their date on, shield intact.
    - D1: an obligation is "faltante" only if the cash projected ON ITS DATE (dated incomes and
      expenses, shield intact) cannot cover it: the same walk as the GPS (mission_cash_walk).
    - Attack = the lowest end-of-day cash of the window minus the shield, capped at TODAY's cash
      minus the whole reserve and the shield (dated paydays never fund today's attack — Fabian,
      2026-11-25) and at the target's balance. No income on record: attack 0 (no invented salary).
      Active subscriptions with no charge date (`undated_monthly`) never get a made-up day: their
      month is kept out of the attack instead.
    - Debts with no obligation keep their plain minimum on due_day (the engine minimum, the one
      every screen charges); a debt with no due_day is never billed on a made-up day.
    """
    today = today or date.today()
    liquid_cash = Decimal(str(liquid_cash))
    end = today + timedelta(days=window)
    raw = mission_obligations(accounts, today, window)
    by_name = {a.name: a for a in accounts}
    open_debts = [a for a in accounts if a.balance > 0]

    # Gap: debts whose minimum does not cover their monthly interest (an alert, never paid ahead)
    gap_debts, gap_cost = [], Decimal('0')
    for a in open_debts:
        mi = (a.balance * (a.interest_rate / Decimal('100')) / Decimal('12')).quantize(_CENT, rounding=ROUND_HALF_UP)
        minimum = a.engine_minimum if a.engine_minimum is not None else a.min_payment
        shortfall = mi - minimum
        if shortfall > 0:
            gap_cost += shortfall
            gap_debts.append({"name": a.name, "shortfall": shortfall, "apr": a.interest_rate})

    # D2: hard obligations first, then each card in date order against the lowest cash from its date on
    hard = [o for o in raw if o["tipo"] not in ("corte", "estado")]
    cards = sorted([o for o in raw if o["tipo"] in ("corte", "estado")], key=lambda o: (o["fecha_accion"], _obligation_key(o)))
    covered = {o["cuenta"] for o in raw}
    accepted: List[Dict] = list(hard)
    degradadas: List[Dict] = []
    flows = _day_flows(recurring_incomes, recurring_expenses, today, window)
    for o in cards:
        walk = mission_cash_walk(accounts, accepted, covered, liquid_cash, shield_target,
                                 recurring_incomes, recurring_expenses, today, window, flows)["cierres"]
        offset = (o["fecha_accion"] - today).days
        slack = min(walk[offset:]) - shield_target if offset < len(walk) else Decimal('0')
        if slack >= o["monto"]:
            accepted.append(o)
            continue
        degradadas.append({"cuenta": o["cuenta"], "tipo": o["tipo"], "monto_completo": o["monto"]})
        lesser = _degraded(o, by_name[o["cuenta"]], today, end)
        if lesser is not None:
            accepted.append(lesser)
    obligations = sorted(accepted, key=_obligation_key)
    reserve = sum((o["monto"] for o in obligations), Decimal('0'))

    walk = mission_cash_walk(accounts, obligations, covered, liquid_cash, shield_target,
                             recurring_incomes, recurring_expenses, today, window, flows)
    faltante = walk["faltante"]
    target = get_velocity_target([DebtAccount(name=a.name, balance=a.balance, interest_rate=a.interest_rate,
                                              min_payment=a.min_payment, debt_subtype=a.debt_subtype)
                                  for a in open_debts])
    attack = Decimal('0')
    if recurring_incomes and target and walk["cierres"]:
        lowest = min(walk["cierres"]) - shield_target - Decimal(str(undated_monthly))
        # Fabian (2026-11-25): today's attack never counts dated paydays — it is capped at TODAY's
        # cash minus the whole reserve, shield intact. The faltante still uses the dated cash (D1).
        todays_cash = liquid_cash - reserve - shield_target
        attack = max(Decimal('0'), min(lowest, todays_cash, target.balance, walk["cierres"][0] - shield_target))
        attack = attack.quantize(_CENT, rounding=ROUND_HALF_UP)

    # Headline: the first obligation; the faltante only when it is that very obligation that falls short.
    mission = None
    if obligations:
        first = obligations[0]
        same = faltante and (faltante["cuenta"], faltante["obligacion"], faltante["fecha_accion"]) == \
            (first["cuenta"], first["tipo"], first["fecha_accion"])
        mission = faltante if same else first
    elif attack > 0:
        mission = {"tipo": "avalancha", "cuenta": target.name, "monto": attack, "fecha_accion": today,
                   "fecha_evento": today, "copy": f"Ataca la {target.name} con {_usd(attack)} hoy"}

    return {
        "mision": mission,
        "faltante": faltante,
        "obligaciones": obligations,
        "degradadas": degradadas,
        "cubiertas": sorted(covered),
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


def reserve_copy(mission: Dict, has_attack: bool) -> str:
    """What the reserve IS, in words: its real obligations (cuts to $0, statements, loan payments,
    minimums) and their dates. Never "pagos mínimos" for something that is not a minimum."""
    obs = mission["obligaciones"]
    if not obs:
        return ("Sin pagos del ciclo pendientes: lo que sobra va a la avalancha." if has_attack
                else "Tu ataque está recargando: espera tu próximo ingreso.")
    first = obs[0]
    noun = {"corte": "el corte de la", "estado": "el estado de la", "minimo": "el mínimo de la",
            "prestamo": "el pago de la"}[first["tipo"]]
    rest = len(obs) - 1
    tail = f" y {rest} pago{'s' if rest != 1 else ''} más hasta el {_fecha_es(obs[-1]['fecha_evento'])}" if rest else ""
    head = (f"Reservamos {_usd(mission['reserva'])} para {noun} {first['cuenta']} "
            f"({_fecha_es(first['fecha_accion'])}){tail}.")
    if has_attack:
        return f"{head} Con lo que sobra, ataca hoy {_usd(mission['ataque'])} a la {mission['objetivo']} (estimado)."
    if mission.get("faltante"):
        return f"{head} {mission['faltante']['copy']} (estimado)."
    return f"{head} Hoy no sobra para atacar sin tocar tu escudo (estimado)."


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
