"""
Unit tests for core_engine/calculators.py — Pure financial math.
No database, no API. These tests validate the formulas directly.

Formula: min_payment = (balance * APR/12/100) + (balance * 1%)
         floor: $25 (or balance if balance < $25)
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from decimal import Decimal
from core_engine.calculators import calculate_minimum_payment


class TestRevolvingMinPayment:
    """Credit card / HELOC minimum payment calculation."""

    def test_standard_credit_card(self):
        """$5,000 @ 24% APR → interest + 1% principal."""
        result = calculate_minimum_payment(Decimal("5000"), Decimal("24"))
        monthly_interest = Decimal("5000") * (Decimal("24") / Decimal("100") / Decimal("12"))
        one_percent = Decimal("5000") * Decimal("0.01")
        expected = monthly_interest + one_percent
        assert result == expected.quantize(Decimal("0.01"))

    def test_small_balance_applies_floor(self):
        """$100 @ 20% → calculated = $2.67, floor $25 wins."""
        result = calculate_minimum_payment(Decimal("100"), Decimal("20"))
        # Formula: max($25, interest + 1%) = max($25, $1.67 + $1) = $25
        assert result == Decimal("25.00")

    def test_zero_balance_returns_zero(self):
        result = calculate_minimum_payment(Decimal("0"), Decimal("24"))
        assert result == Decimal("0")

    def test_negative_balance_returns_zero(self):
        result = calculate_minimum_payment(Decimal("-100"), Decimal("24"))
        assert result == Decimal("0")

    def test_balance_smaller_than_25_returns_balance(self):
        """$10 balance → payment = balance (can't pay more than owed)."""
        result = calculate_minimum_payment(Decimal("10"), Decimal("20"))
        assert result == Decimal("10")

    def test_none_balance_returns_zero(self):
        result = calculate_minimum_payment(None, Decimal("20"))
        assert result == Decimal("0.00")

    def test_none_apr_treated_as_zero(self):
        """With 0% APR, min payment is just max(1% of balance, $25)."""
        result = calculate_minimum_payment(Decimal("5000"), None)
        expected = max(Decimal("5000") * Decimal("0.01"), Decimal("25"))
        assert result == expected.quantize(Decimal("0.01"))

    def test_float_inputs_coerced_safely(self):
        """Function should handle float inputs via str() conversion."""
        result = calculate_minimum_payment(5000.00, 24.0)
        assert isinstance(result, Decimal)
        assert result > Decimal("0")
