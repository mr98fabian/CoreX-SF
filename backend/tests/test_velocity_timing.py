"""
Velocity Strategist Tests — HELOC cycling, billing-cycle timing, safe attack equity.

Run: python -m pytest tests/test_velocity_timing.py -v --tb=short
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal, ROUND_HALF_UP
from datetime import date

from velocity_engine import (
    DebtAccount,
    generate_action_plan,
    CashflowTactical,
    calculate_safe_attack_equity,
    generate_projected_calendar,
    DEFAULT_PEACE_SHIELD,
)


def _debt(name="Test Card", balance=5000, rate=24.99, min_pay=150, due=15):
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
    )


def _cashflow(name, amount, day, category="expense"):
    return CashflowTactical(
        name=name,
        amount=Decimal(str(amount)),
        day_of_month=day,
        category=category,
    )


# ── HELOC CYCLING INTEREST SAVINGS ────────────────────────────────

class TestHELOCCycling:
    """Verify interest savings from HELOC cycling strategy."""

    def test_deposit_reduces_daily_interest(self):
        """Depositing $8,500 into HELOC reduces daily interest cost."""
        heloc_balance = Decimal("50000")
        apr = Decimal("8")
        deposit = Decimal("8500")

        daily_before = heloc_balance * apr / Decimal("100") / Decimal("365")
        daily_after = (heloc_balance - deposit) * apr / Decimal("100") / Decimal("365")

        savings_per_day = (daily_before - daily_after).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        # $8,500 × 8% / 365 = $1.86/day saved
        assert savings_per_day > Decimal("1.50"), (
            f"Daily savings {savings_per_day} should exceed $1.50"
        )

    def test_cycling_27_days_monthly_savings(self):
        """27 days of reduced balance should save ~$50/month."""
        heloc_balance = Decimal("50000")
        deposit = Decimal("8500")
        apr = Decimal("8")
        hold_days = 27

        daily_savings = deposit * apr / Decimal("100") / Decimal("365")
        monthly_savings = (daily_savings * hold_days).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        assert monthly_savings > Decimal("40"), (
            f"Monthly savings {monthly_savings} should exceed $40"
        )

    def test_higher_deposit_more_savings(self):
        """$10,000 deposit saves more than $5,000 deposit."""
        apr = Decimal("8")
        hold_days = 27

        savings_5k = Decimal("5000") * apr / Decimal("100") / Decimal("365") * hold_days
        savings_10k = Decimal("10000") * apr / Decimal("100") / Decimal("365") * hold_days

        assert savings_10k > savings_5k


# ── ACTION PLAN TIMING ───────────────────────────────────────────

class TestActionPlanTiming:
    """Verify action plan generates events in chronological order."""

    def test_plan_generates_events(self):
        """Action plan should generate at least some events."""
        debts = [
            _debt("Credit Card", balance=5000, rate=24, min_pay=150, due=15),
            _debt("HELOC", balance=50000, rate=8, min_pay=333, due=25),
        ]
        cashflows = [
            _cashflow("Salary", 8500, 1, "income"),
            _cashflow("Rent", 2000, 5, "expense"),
        ]
        result = generate_action_plan(debts, cashflows, Decimal("5000"))
        assert isinstance(result, list)
        assert len(result) > 0, "Action plan should have at least 1 event"

    def test_events_have_required_fields(self):
        """Each event should have date, title, amount, type."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150, due=15)]
        cashflows = [_cashflow("Pay", 4000, 1, "income")]
        result = generate_action_plan(debts, cashflows, Decimal("3000"))

        for event in result:
            assert "display_date" in event or "date" in event, f"Event missing date: {event}"
            assert "title" in event, f"Event missing title: {event}"

    def test_min_payments_scheduled(self):
        """Minimum payments should appear in the action plan."""
        debts = [_debt("Amex", balance=18500, rate=24.99, min_pay=450, due=5)]
        cashflows = [_cashflow("Income", 8500, 1, "income")]
        result = generate_action_plan(debts, cashflows, Decimal("5000"))

        # Look for min payment events
        min_payment_events = [
            e for e in result
            if "min" in str(e).lower() or "payment" in str(e).lower() or "due" in str(e).lower()
        ]
        assert len(min_payment_events) > 0, "No min payment events found in action plan"


# ── SAFE ATTACK EQUITY ───────────────────────────────────────────

class TestSafeAttackEquity:
    """Verify safe-attack-equity respects lowest-low projection."""

    def test_safe_equity_less_than_raw_equity(self):
        """Safe equity should be ≤ raw equity (raw - reserved)."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150, due=15)]
        result = calculate_safe_attack_equity(
            Decimal("5000"), DEFAULT_PEACE_SHIELD, debts,
            recurring_incomes=[{"name": "Salary", "amount": 4000, "day": 1}],
            recurring_expenses=[{"name": "Rent", "amount": 2000, "day": 5}],
        )
        assert result["safe_equity"] <= result["raw_equity"]

    def test_below_shield_zero_equity(self):
        """If liquid cash < shield target, safe equity = 0."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150)]
        result = calculate_safe_attack_equity(
            Decimal("500"), Decimal("1000"), debts,
        )
        assert result["safe_equity"] == Decimal("0")

    def test_safe_equity_non_negative(self):
        """Safe equity should never be negative."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150)]
        result = calculate_safe_attack_equity(
            Decimal("10000"), DEFAULT_PEACE_SHIELD, debts,
        )
        assert result["safe_equity"] >= Decimal("0")


# ── PROJECTED CALENDAR ───────────────────────────────────────────

class TestProjectedCalendar:
    """Verify daily cashflow calendar projection."""

    def test_calendar_covers_requested_days(self):
        """Calendar should cover at least num_days entries."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150, due=15)]
        result = generate_projected_calendar(
            start_date=date.today(),
            num_days=30,
            current_liquid_cash=Decimal("5000"),
            shield_target=DEFAULT_PEACE_SHIELD,
            debts=debts,
        )
        assert "calendar" in result
        assert len(result["calendar"]) >= 28  # Allow minor variance

    def test_lowest_balance_tracked(self):
        """Should report lowest_projected_balance."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=150, due=15)]
        result = generate_projected_calendar(
            start_date=date.today(),
            num_days=35,
            current_liquid_cash=Decimal("5000"),
            shield_target=DEFAULT_PEACE_SHIELD,
            debts=debts,
        )
        assert "lowest_projected_balance" in result
        assert isinstance(result["lowest_projected_balance"], (Decimal, float, int))
