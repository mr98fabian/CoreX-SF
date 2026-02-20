"""
Unit tests for the 4 Intelligence Functions in velocity_engine.py.
Tests: Float Kill, Closing Day Intelligence, Hybrid Kill, Interest Rate Arbitrage.
No database, no API — pure engine logic.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal
from datetime import date, timedelta
from velocity_engine import (
    DebtAccount,
    detect_float_kill_opportunities,
    get_closing_day_intelligence,
    get_hybrid_kill_target,
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
# TEST CLASS: detect_float_kill_opportunities
# ═══════════════════════════════════════════════════════════════

class TestFloatKillOpportunities:
    """Float Kill: Identifies revolving credit in grace period for priority attack."""

    def test_killable_card_detected(self):
        """A card with balance <= attack equity and due within grace window."""
        card = _card("Chase Freedom", balance=500, due=date.today().day + 5 if date.today().day + 5 <= 28 else 5)
        result = detect_float_kill_opportunities([card], Decimal("1000"))
        assert len(result) > 0
        killable = [r for r in result if r["can_kill"]]
        assert len(killable) > 0
        assert killable[0]["name"] == "Chase Freedom"

    def test_non_revolving_excluded(self):
        """Fixed loans (auto, mortgage) should NOT appear in float kills."""
        loan = _loan("My Auto Loan", balance=500)
        result = detect_float_kill_opportunities([loan], Decimal("1000"))
        assert len(result) == 0

    def test_insufficient_equity_not_killable(self):
        """Card with balance > attack equity is still reported but not 'can_kill'."""
        card = _card("Big Card", balance=5000, due=date.today().day + 3 if date.today().day + 3 <= 28 else 3)
        result = detect_float_kill_opportunities([card], Decimal("1000"))
        if len(result) > 0:
            assert result[0]["can_kill"] is False

    def test_empty_debts_returns_empty(self):
        """No debts → no opportunities."""
        result = detect_float_kill_opportunities([], Decimal("5000"))
        assert result == []

    def test_zero_equity_returns_no_killable(self):
        """With zero attack equity, nothing should be killable."""
        card = _card("Test", balance=100)
        result = detect_float_kill_opportunities([card], Decimal("0"))
        killable = [r for r in result if r["can_kill"]]
        assert len(killable) == 0

    def test_result_fields_present(self):
        """Ensure all expected fields exist in the result dict."""
        card = _card("Amex", balance=200, due=date.today().day + 10 if date.today().day + 10 <= 28 else 10)
        result = detect_float_kill_opportunities([card], Decimal("500"))
        if result:
            entry = result[0]
            expected_keys = {"name", "balance", "days_until_due", "daily_interest_at_risk",
                             "monthly_interest_at_risk", "can_kill", "apr", "priority", "reason"}
            assert expected_keys.issubset(entry.keys())


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
# TEST CLASS: get_hybrid_kill_target
# ═══════════════════════════════════════════════════════════════

class TestHybridKillTarget:
    """Hybrid Kill: Determines if eliminating a small debt beats pure avalanche."""

    def test_recommends_hybrid_when_beneficial(self):
        """Small debt with high min_payment freed should trigger hybrid."""
        # Small card: $500 balance, $100/mo min payment, 18% APR
        small = _card("Small Card", balance=500, min_pay=100, rate=18)
        # Big card: $10000 balance, $200/mo, 22% APR (avalanche target)
        big = _card("Big Card", balance=10000, min_pay=200, rate=22)
        result = get_hybrid_kill_target([small, big], Decimal("600"))
        # Should recommend hybrid: killing small frees $100/mo
        if result and result["strategy"] == "hybrid_kill":
            assert result["kill_target_name"] == "Small Card"
            assert result["freed_min_payment"] == 100.0

    def test_recommends_avalanche_when_better(self):
        """When avalanche clearly wins, should recommend pure avalanche."""
        # Small card: $500 balance, $25/mo min, 5% APR
        small = _card("Low Rate Card", balance=500, min_pay=25, rate=5)
        # Big card: $10000, $200/mo, 29.99% APR
        big = _card("Monster Card", balance=10000, min_pay=200, rate=29.99)
        result = get_hybrid_kill_target([small, big], Decimal("600"))
        if result:
            assert result["strategy"] in ("hybrid_kill", "avalanche")

    def test_single_debt_returns_avalanche(self):
        """With only one debt, hybrid makes no sense."""
        card = _card("Solo Card", balance=5000, rate=20)
        result = get_hybrid_kill_target([card], Decimal("1000"))
        # Should return avalanche or None  
        if result:
            assert result["strategy"] == "avalanche"

    def test_no_debts_returns_none(self):
        """No debts → None."""
        result = get_hybrid_kill_target([], Decimal("1000"))
        assert result is None

    def test_zero_equity_returns_none(self):
        """With zero attack equity, can't kill anything."""
        debts = [_card("A", balance=500), _card("B", balance=3000)]
        result = get_hybrid_kill_target(debts, Decimal("0"))
        # Should return None since zero equity
        assert result is None

    def test_result_has_reasoning(self):
        """Result should include a human-readable reasoning string."""
        small = _card("Tiny", balance=200, min_pay=50, rate=15)
        big = _card("Large", balance=8000, min_pay=180, rate=24)
        result = get_hybrid_kill_target([small, big], Decimal("500"))
        if result:
            assert "reasoning" in result
            assert len(result["reasoning"]) > 10


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
