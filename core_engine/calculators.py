"""
CoreX Financial System — Pure Financial Calculators
No database or API dependencies. All functions are pure.
"""
from decimal import Decimal


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
