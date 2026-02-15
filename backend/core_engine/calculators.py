"""
Pure financial calculators — no database or API dependencies.
These functions use Decimal exclusively to prevent floating-point rounding errors
in financial calculations.
"""
from decimal import Decimal, ROUND_HALF_UP


def calculate_minimum_payment(balance, apr) -> Decimal:
    """
    Calculates minimum monthly payment: (Balance * (APR / 12)) + (Balance * 0.01)
    Floor: $25 or Total Balance if less.
    """
    # Enforce Decimal types to avoid float/Decimal mix errors
    try:
        b = Decimal(str(balance)) if balance is not None else Decimal("0")
        a = Decimal(str(apr)) if apr is not None else Decimal("0")
    except Exception:
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
