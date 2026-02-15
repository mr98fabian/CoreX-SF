"""
Unit tests for velocity_engine.py — Pure financial simulation logic.
No database, no API. Tests the engine's core algorithms directly.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal
from velocity_engine import (
    DebtAccount,
    get_velocity_target,
    get_peace_shield_status,
    calculate_months_to_payoff,
)


def _debt(name="Test Card", balance=5000, rate=24.99, min_pay=150, due=15):
    """Helper to create a DebtAccount quickly."""
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
    )


class TestVelocityTarget:
    """get_velocity_target should return highest-APR debt (avalanche strategy)."""

    def test_returns_highest_apr(self):
        debts = [_debt("Low", rate=5), _debt("High", rate=25), _debt("Mid", rate=15)]
        target = get_velocity_target(debts)
        assert target.name == "High"

    def test_empty_debts_returns_none(self):
        assert get_velocity_target([]) is None

    def test_single_debt(self):
        target = get_velocity_target([_debt("Only")])
        assert target.name == "Only"


class TestPeaceShield:
    """Peace Shield status based on liquid cash vs target."""

    def test_shield_fully_charged(self):
        result = get_peace_shield_status(Decimal("10000"), Decimal("5000"))
        assert result["is_active"] is True
        assert result["fill_percentage"] >= 100
        assert result["attack_authorized"] is True
        assert result["status"] == "FULLY CHARGED"

    def test_shield_empty(self):
        result = get_peace_shield_status(Decimal("0"), Decimal("5000"))
        assert result["is_active"] is False
        assert result["fill_percentage"] == 0
        assert result["attack_authorized"] is False
        assert result["status"] == "CHARGING"

    def test_shield_partial(self):
        result = get_peace_shield_status(Decimal("2500"), Decimal("5000"))
        assert result["fill_percentage"] == 50
        assert result["status"] == "CHARGING"
        assert result["deficit"] == 2500.0


class TestMonthsToPayoff:
    """calculate_months_to_payoff should return reasonable timeframes."""

    def test_zero_interest_payoff(self):
        """0% APR + $100/mo on $1000 → exactly 10 months."""
        months = calculate_months_to_payoff(
            balance=Decimal("1000"),
            apr=Decimal("0"),
            monthly_payment=Decimal("100"),
        )
        assert months == 10

    def test_minimum_payment_high_apr(self):
        """Min payment at 24% APR on $5000 should take many months."""
        months = calculate_months_to_payoff(
            balance=Decimal("5000"),
            apr=Decimal("24"),
            monthly_payment=Decimal("150"),
        )
        assert months > 36

    def test_zero_balance_returns_zero(self):
        months = calculate_months_to_payoff(
            balance=Decimal("0"),
            apr=Decimal("24"),
            monthly_payment=Decimal("150"),
        )
        assert months == 0

    def test_payment_less_than_interest_returns_cap(self):
        """If payment can't cover interest, returns 600 (cap)."""
        months = calculate_months_to_payoff(
            balance=Decimal("50000"),
            apr=Decimal("30"),
            monthly_payment=Decimal("10"),
        )
        assert months == 600
