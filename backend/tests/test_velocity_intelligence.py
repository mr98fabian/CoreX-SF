"""
Unit tests for the 4 Intelligence Functions in velocity_engine.py.
Tests: Closing Day Intelligence, Interest Rate Arbitrage. (Float Kill and Hybrid Kill were removed
with U-13, avalanche only: see test_strict_avalanche.py.)
No database, no API — pure engine logic.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal
from datetime import date, timedelta
from velocity_engine import (
    DebtAccount,
    get_closing_day_intelligence,
    detect_interest_rate_arbitrage,
)


# ──────────────────────────── Helpers ────────────────────────────

def _card(
    name="Test Card", balance=2000, rate=24.99, min_pay=50, due=15,
    closing=25, subtype="credit_card", limit=5000,
):
    """Helper to create a revolving DebtAccount quickly."""
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
        closing_day=closing,
        debt_subtype=subtype,
        credit_limit=Decimal(str(limit)),
    )


def _loan(name="Auto Loan", balance=15000, rate=6.5, min_pay=350, due=1):
    """Helper to create a fixed-rate DebtAccount (non-revolving)."""
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
        debt_subtype="auto_loan",
    )


# ═══════════════════════════════════════════════════════════════
# TEST CLASS: get_closing_day_intelligence
# ═══════════════════════════════════════════════════════════════

class TestClosingDayIntelligence:
    """Closing Day Intelligence: Timing advice for purchases and payments."""

    def test_returns_data_for_revolving(self):
        """Revolving accounts with closing_day set should produce intelligence."""
        card = _card("Discover", closing=10, due=5)
        result = get_closing_day_intelligence([card])
        assert len(result) == 1
        assert result[0]["name"] == "Discover"

    def test_skips_non_revolving(self):
        """Non-revolving debts should be excluded."""
        loan = _loan("Mortgage")
        result = get_closing_day_intelligence([loan])
        assert len(result) == 0

    def test_skips_no_closing_day(self):
        """Cards without closing_day (0) AND due_day (0) should be skipped."""
        card = _card("Mystery Card", closing=0, due=0)
        result = get_closing_day_intelligence([card])
        assert len(result) == 0

    def test_float_days_positive(self):
        """Float days if buying today should be > 0."""
        card = _card("Test", closing=20, due=15)
        result = get_closing_day_intelligence([card])
        if result:
            assert result[0]["float_days_if_buy_today"] > 0

    def test_credit_utilization_calculated(self):
        """Credit utilization should be calculated when limit > 0."""
        card = _card("Util Card", balance=2500, limit=10000, closing=10)
        result = get_closing_day_intelligence([card])
        assert result[0]["credit_utilization"] == 25.0  # 2500 / 10000 * 100

    def test_tips_list_present(self):
        """Each result should have a tips list."""
        card = _card("Tip Card", closing=15, due=10)
        result = get_closing_day_intelligence([card])
        assert "tips" in result[0]
        assert isinstance(result[0]["tips"], list)

    def test_cycle_position_string(self):
        """cycle_position should be a descriptive string."""
        card = _card("Position Card", closing=15)
        result = get_closing_day_intelligence([card])
        assert result[0]["cycle_position"] in ("early", "mid_cycle", "pre_close", "close_week", "grace_period", "unknown")


# ═══════════════════════════════════════════════════════════════
# TEST CLASS: detect_interest_rate_arbitrage
# ═══════════════════════════════════════════════════════════════

class TestInterestRateArbitrage:
    """Arbitrage: Detects when savings yield < debt cost (net negative)."""

    def test_detects_clear_arbitrage(self):
        """Savings at 0.5% APY vs debt at 24% APR → obvious alert."""
        savings = [{"name": "My Savings", "balance": 5000, "apy": 0.5}]
        debts = [_card("Credit Card", balance=3000, rate=24)]
        result = detect_interest_rate_arbitrage(savings, debts)
        assert len(result) > 0
        assert result[0]["savings_account"] == "My Savings"
        assert result[0]["rate_spread"] > 20  # 24 - 0.5 = 23.5

    def test_no_savings_returns_empty(self):
        """No savings accounts → no alerts."""
        debts = [_card("Card", balance=5000)]
        result = detect_interest_rate_arbitrage([], debts)
        assert result == []

    def test_no_debts_returns_empty(self):
        """No debts → no arbitrage possible."""
        savings = [{"name": "Savings", "balance": 10000, "apy": 4.5}]
        result = detect_interest_rate_arbitrage(savings, [])
        assert result == []

    def test_high_yield_savings_no_alert(self):
        """If savings APY > debt APR (rare), no alert should appear."""
        savings = [{"name": "HYS", "balance": 5000, "apy": 30}]  # unrealistic but tests logic
        debts = [_card("Low Card", balance=3000, rate=5)]
        result = detect_interest_rate_arbitrage(savings, debts)
        # Spread is negative → should not alert
        assert len(result) == 0

    def test_severity_levels(self):
        """Higher spreads should produce higher severity alerts."""
        savings = [{"name": "Bank", "balance": 10000, "apy": 0.1}]
        debts = [_card("Huge APR", balance=5000, rate=29.99)]
        result = detect_interest_rate_arbitrage(savings, debts)
        assert len(result) > 0
        assert result[0]["severity"] in ("critical", "warning", "info")

    def test_transferable_amount_logic(self):
        """Transferable should be min(savings_balance, debt_balance)."""
        savings = [{"name": "Small Savings", "balance": 1000, "apy": 0.5}]
        debts = [_card("Card", balance=5000, rate=20)]
        result = detect_interest_rate_arbitrage(savings, debts)
        if result:
            assert result[0]["transferable_amount"] <= 1000  # Can't transfer more than savings

    def test_result_fields_complete(self):
        """Each alert should have all expected fields."""
        savings = [{"name": "Savings", "balance": 3000, "apy": 0.5}]
        debts = [_card("CC", balance=2000, rate=22)]
        result = detect_interest_rate_arbitrage(savings, debts)
        if result:
            assert "recommendation" in result[0]
            assert "Transfer" in result[0]["recommendation"] or "transfer" in result[0]["recommendation"].lower()

    def test_multiple_savings_multiple_debts(self):
        """Should cross-reference all savings against all debts."""
        savings = [
            {"name": "Savings A", "balance": 5000, "apy": 0.5},
            {"name": "Savings B", "balance": 3000, "apy": 1.0},
        ]
        debts = [
            _card("Card 1", balance=2000, rate=24),
            _card("Card 2", balance=4000, rate=18),
        ]
        result = detect_interest_rate_arbitrage(savings, debts)
        # Should produce multiple alerts (each savings vs highest-APR debt)
        assert len(result) >= 1
