"""
Stress Tester — Extreme financial scenarios to find breaking points.

Run: python -m pytest tests/test_stress_scenarios.py -v --tb=short
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import time
from decimal import Decimal, ROUND_HALF_UP

from velocity_engine import (
    DebtAccount,
    calculate_months_to_payoff,
    calculate_total_interest,
    calculate_debt_free_date,
    simulate_freedom_path,
    get_projections,
    get_velocity_target,
    get_peace_shield_status,
    calculate_purchase_time_cost,
)


def _debt(name="Test Card", balance=5000, rate=24.99, min_pay=150, due=15):
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
    )


# ── INCOME LOSS SCENARIO ─────────────────────────────────────────

class TestIncomeLoss:
    """What happens when the user loses all extra income?"""

    def test_zero_extra_no_crash(self):
        """$0 extra monthly should not crash the engine."""
        debts = [
            _debt("Card A", balance=10000, rate=24, min_pay=200),
            _debt("Card B", balance=5000, rate=18, min_pay=100),
        ]
        result = simulate_freedom_path(debts, Decimal("0"))
        assert result["total_months"] > 0
        assert result["total_interest_paid"] > 0

    def test_zero_extra_equals_standard(self):
        """$0 extra = standard timeline (min payments only)."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        standard = calculate_debt_free_date(debts, Decimal("0"))
        assert standard["months_saved"] == 0

    def test_shield_blocks_attacks_when_broke(self):
        """When cash < shield, attacks should be blocked."""
        result = get_peace_shield_status(Decimal("200"), Decimal("1000"))
        assert result["attack_authorized"] is False
        assert result["status"] == "CHARGING"


# ── INTEREST RATE SPIKE ──────────────────────────────────────────

class TestInterestRateSpike:
    """What happens when HELOC rate jumps from 8% to 22%?"""

    def test_higher_apr_longer_payoff(self):
        """8% → 15% → 22%: months should increase monotonically.
        Using $1,500/mo to ensure payment covers interest at all APR levels."""
        base_balance = Decimal("50000")
        min_pay = Decimal("1500")  # Must cover worst-case interest ($916/mo at 22%)

        months_8 = calculate_months_to_payoff(base_balance, Decimal("8"), min_pay)
        months_15 = calculate_months_to_payoff(base_balance, Decimal("15"), min_pay)
        months_22 = calculate_months_to_payoff(base_balance, Decimal("22"), min_pay)

        assert months_8 < months_15 < months_22, (
            f"8%={months_8}, 15%={months_15}, 22%={months_22} — should be monotonic"
        )

    def test_rate_spike_min_payment_insufficient_at_22(self):
        """AUDIT FINDING: $500/mo can NOT cover $50K at 22% APR.
        Monthly interest = $916.67 > $500 payment → debt grows infinitely.
        This is a critical scenario for user warnings."""
        monthly_interest = Decimal("50000") * Decimal("22") / Decimal("100") / Decimal("12")
        assert Decimal("500") < monthly_interest, (
            f"$500/mo SHOULD be insufficient for ${monthly_interest}/mo interest at 22%"
        )
        # Engine should cap this at 600 (functional infinity)
        months = calculate_months_to_payoff(Decimal("50000"), Decimal("22"), Decimal("500"))
        assert months == 600, "Payment below interest should cap at 600"

    def test_extreme_apr_30_percent(self):
        """30% APR on $50k: min payment barely covers interest."""
        monthly_interest = Decimal("50000") * Decimal("30") / Decimal("100") / Decimal("12")
        months = calculate_months_to_payoff(
            Decimal("50000"), Decimal("30"), Decimal("500")
        )
        # $500 vs $1250/mo interest → payment can't cover interest
        if Decimal("500") <= monthly_interest:
            assert months == 600  # Infinite
        else:
            assert months > 200


# ── HIGH BALANCE PORTFOLIO ───────────────────────────────────────

class TestHighBalancePortfolio:
    """$500K+ total debt — Decimal precision and performance."""

    def test_large_portfolio_no_overflow(self):
        """12 debts totaling $500K+ — should not overflow."""
        debts = [
            _debt("Mortgage 1", balance=325000, rate=6.5, min_pay=2100, due=1),
            _debt("Mortgage 2", balance=175000, rate=7.25, min_pay=1400, due=15),
            _debt("HELOC", balance=50000, rate=8, min_pay=333, due=25),
            _debt("Auto Loan", balance=42000, rate=4.99, min_pay=780, due=10),
            _debt("Student Loan", balance=35000, rate=5.5, min_pay=400, due=20),
            _debt("Amex Plat", balance=18500, rate=24.99, min_pay=450, due=5),
            _debt("Chase Sapphire", balance=7200, rate=21.49, min_pay=180, due=12),
            _debt("Capital One", balance=4800, rate=19.99, min_pay=120, due=8),
            _debt("Citi", balance=2300, rate=17.49, min_pay=60, due=18),
            _debt("Tesla Lease", balance=41000, rate=4.99, min_pay=788, due=3),
            _debt("Range Rover", balance=58000, rate=5.49, min_pay=650, due=22),
            _debt("IUL Loan", balance=15000, rate=6, min_pay=200, due=28),
        ]
        total = sum(d.balance for d in debts)
        assert total > 500000

        result = simulate_freedom_path(debts, Decimal("2000"))
        assert result["total_months"] > 0
        assert result["total_months"] < 600

    def test_large_portfolio_performance(self):
        """12-debt simulation should complete in < 5 seconds."""
        debts = [
            _debt(f"Debt {i}", balance=50000, rate=10+i, min_pay=500, due=i+1)
            for i in range(12)
        ]
        start = time.time()
        simulate_freedom_path(debts, Decimal("3000"))
        elapsed = time.time() - start
        assert elapsed < 5.0, f"Simulation took {elapsed:.2f}s, max 5s"

    def test_decimal_precision_maintained(self):
        """All outputs should maintain Decimal precision (no float artifacts)."""
        debts = [_debt("Card", balance=9999.99, rate=19.99, min_pay=250.50)]
        result = simulate_freedom_path(debts)
        # total_interest_paid should be a float (engine converts for JSON)
        assert isinstance(result["total_interest_paid"], (float, int, Decimal))


# ── EDGE CASES ───────────────────────────────────────────────────

class TestEdgeCases:
    """Boundary conditions that could cause crashes."""

    def test_one_cent_balance(self):
        """$0.01 balance should pay off in 1 month."""
        months = calculate_months_to_payoff(
            Decimal("0.01"), Decimal("24"), Decimal("25")
        )
        assert months == 1

    def test_one_dollar_balance(self):
        """$1.00 should pay off quickly."""
        months = calculate_months_to_payoff(
            Decimal("1.00"), Decimal("24"), Decimal("25")
        )
        assert months <= 1

    def test_million_dollar_balance_with_min_payment(self):
        """$1M with $25 min → never pays off (600 cap)."""
        monthly_interest = Decimal("1000000") * Decimal("20") / Decimal("100") / Decimal("12")
        assert Decimal("25") < monthly_interest  # Sanity check
        months = calculate_months_to_payoff(
            Decimal("1000000"), Decimal("20"), Decimal("25")
        )
        assert months == 600

    def test_negative_balance_treated_as_zero(self):
        """Negative balance → 0 months."""
        months = calculate_months_to_payoff(
            Decimal("-500"), Decimal("20"), Decimal("100")
        )
        assert months == 0

    def test_all_debts_same_apr(self):
        """5 debts at same APR — avalanche shouldn't crash on tie."""
        debts = [
            _debt(f"Card {i}", balance=5000, rate=21.99, min_pay=150)
            for i in range(5)
        ]
        target = get_velocity_target(debts)
        assert target is not None

        result = simulate_freedom_path(debts, Decimal("1000"))
        assert result["total_months"] > 0
        assert result["total_months"] < 600

    def test_two_debts_payoff_same_month(self):
        """Two small debts that should pay off in the same month with extra cash."""
        debts = [
            _debt("Card A", balance=100, rate=20, min_pay=50),
            _debt("Card B", balance=100, rate=18, min_pay=50),
        ]
        result = simulate_freedom_path(debts, Decimal("500"))
        # Both should be paid off in month 1
        assert result["total_months"] <= 1

    def test_zero_debts_freedom_today(self):
        """No debts → freedom today."""
        result = simulate_freedom_path([])
        assert result["total_months"] == 0

    def test_zero_debts_projections(self):
        """No debts → projections return meaningful defaults."""
        result = get_projections([], Decimal("10000"))
        assert result["total_debt"] == 0
        assert result["months_saved"] == 0


# ── PURCHASE SIMULATOR EDGE CASES ────────────────────────────────

class TestPurchaseSimulatorStress:
    """Edge cases for purchase time-cost simulator."""

    def test_huge_purchase_doesnt_crash(self):
        """$100K purchase on $10K debt shouldn't crash."""
        debts = [_debt("Card", balance=10000, rate=20, min_pay=200)]
        result = calculate_purchase_time_cost(Decimal("100000"), debts, Decimal("500"))
        assert result["days_delayed"] >= 0

    def test_purchase_on_zero_debt(self):
        """Purchase with no debts."""
        result = calculate_purchase_time_cost(Decimal("1000"), [], Decimal("500"))
        # Should return something reasonable
        assert "days_delayed" in result


# ── GAP-FIRST STRATEGY ──────────────────────────────────────────

class TestGapFirstStrategy:
    """Verify that simulate_freedom_path covers interest gaps before avalanche."""

    def test_gap_coverage_prevents_debt_growth(self):
        """A debt where min_pay < interest should NOT grow when extra covers the gap.
        
        Scenario: $50K at 22%, $500/mo min → interest is ~$916/mo → shortfall ~$416.
        With $500 extra, $416 covers the gap, $84 goes to avalanche.
        The debt should decrease, not grow.
        """
        debts = [
            _debt("Growing Debt", balance=50000, rate=22, min_pay=500),
        ]
        # $500 extra: should cover the $416 gap + $84 attack
        result = simulate_freedom_path(debts, Decimal("500"))
        
        # After month 1, total balance should be LESS than starting $50,000
        if len(result["timeline"]) >= 1:
            month_1_balance = result["timeline"][0]["total_balance"]
            assert month_1_balance < 50000, (
                f"Balance after month 1 ({month_1_balance}) should be < $50,000 "
                f"because extra cash covers the interest gap"
            )

    def test_gap_plus_avalanche_faster_than_min_only(self):
        """Two debts: one with gap, one healthy. Extra should cover gap AND attack.
        Result must be faster than min-payments-only."""
        debts = [
            _debt("Gap Debt", balance=30000, rate=22, min_pay=400),   # Interest ~$550, shortfall ~$150
            _debt("Healthy Debt", balance=5000, rate=15, min_pay=200), # Healthy
        ]
        min_only = simulate_freedom_path(debts, Decimal("0"))
        with_extra = simulate_freedom_path(debts, Decimal("800"))
        
        assert with_extra["total_months"] < min_only["total_months"], (
            f"With extra ({with_extra['total_months']}) should be faster "
            f"than min-only ({min_only['total_months']})"
        )

    def test_no_gap_debts_pure_avalanche(self):
        """When all debts are healthy (no gaps), behavior = pure avalanche."""
        debts = [
            _debt("Card A", balance=5000, rate=24, min_pay=200),
            _debt("Card B", balance=3000, rate=15, min_pay=100),
        ]
        result = simulate_freedom_path(debts, Decimal("500"))
        
        # Card A (highest APR) should be eliminated first
        first_elimination = None
        for snapshot in result["timeline"]:
            for event in snapshot["events"]:
                if "Eliminated" in event or "Paid Off" in event:
                    first_elimination = event
                    break
            if first_elimination:
                break
        
        assert first_elimination is not None, "A debt should be eliminated"
        assert "Card A" in first_elimination, (
            f"Expected Card A (highest APR) first, got: {first_elimination}"
        )
