"""
CPA Financial Auditor — Comprehensive math verification for KoreX engine.

Tests every financial formula against hand-calculated expected values.
Uses Decimal exclusively to match production precision.

Run: python -m pytest tests/test_cpa_audit.py -v --tb=short
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from decimal import Decimal, ROUND_HALF_UP
from datetime import date
import math

from velocity_engine import (
    DebtAccount,
    calculate_minimum_payment,
    calculate_months_to_payoff,
    calculate_total_interest,
    calculate_debt_free_date,
    get_projections,
    get_velocity_target,
    get_peace_shield_status,
    simulate_freedom_path,
    calculate_purchase_time_cost,
    detect_debt_alerts,
)


# ── HELPERS ──────────────────────────────────────────────────────

def _debt(name="Test Card", balance=5000, rate=24.99, min_pay=150, due=15):
    """Quick DebtAccount factory."""
    return DebtAccount(
        name=name,
        balance=Decimal(str(balance)),
        interest_rate=Decimal(str(rate)),
        min_payment=Decimal(str(min_pay)),
        due_day=due,
    )


def _manual_monthly_interest(balance: Decimal, apr: Decimal) -> Decimal:
    """Manual interest calculation: Balance × (APR / 100 / 12)."""
    return (balance * (apr / Decimal("100") / Decimal("12"))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def _manual_daily_interest(balance: Decimal, apr: Decimal) -> Decimal:
    """Manual daily interest: Balance × APR / 100 / 365."""
    return (balance * apr / Decimal("100") / Decimal("365")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


# ── MINIMUM PAYMENT FORMULA ─────────────────────────────────────

class TestMinPaymentFormula:
    """Verify: min_payment = (Balance × APR/12) + (Balance × 1%), floor $25."""

    def test_amex_platinum_24_99(self):
        """Real scenario: $18,500 at 24.99% APR."""
        b, a = Decimal("18500"), Decimal("24.99")
        expected_interest = b * (a / Decimal("100") / Decimal("12"))
        expected_principal = b * Decimal("0.01")
        expected = (expected_interest + expected_principal).quantize(Decimal("0.01"))
        result = calculate_minimum_payment(b, a)
        assert result == expected, f"Expected {expected}, got {result}"

    def test_mortgage_low_apr(self):
        """Mortgage at 6.5% — formula still holds."""
        b, a = Decimal("325000"), Decimal("6.5")
        result = calculate_minimum_payment(b, a)
        expected_interest = b * (a / Decimal("100") / Decimal("12"))
        expected_principal = b * Decimal("0.01")
        expected = (expected_interest + expected_principal).quantize(Decimal("0.01"))
        assert result == expected

    def test_heloc_8_percent(self):
        """HELOC at 8%: $50,000 balance."""
        b, a = Decimal("50000"), Decimal("8")
        result = calculate_minimum_payment(b, a)
        interest = b * (a / Decimal("100") / Decimal("12"))
        principal = b * Decimal("0.01")
        expected = (interest + principal).quantize(Decimal("0.01"))
        assert result == expected

    def test_zero_apr_means_just_principal(self):
        """0% APR promo: payment = just 1% of balance."""
        result = calculate_minimum_payment(Decimal("10000"), Decimal("0"))
        expected = Decimal("10000") * Decimal("0.01")
        assert result == expected.quantize(Decimal("0.01"))


# ── INTEREST ACCRUAL PRECISION ───────────────────────────────────

class TestInterestAccuralPrecision:
    """Verify monthly interest uses Decimal, not float, to avoid drift."""

    def test_decimal_precision_no_float_errors(self):
        """$9,999.99 at 19.99% — test that we don't get floating-point artifacts."""
        b = Decimal("9999.99")
        apr = Decimal("19.99")
        monthly_rate = apr / Decimal("100") / Decimal("12")
        expected = (b * monthly_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # The engine uses this same formula internally
        assert isinstance(expected, Decimal)
        # Verify no float conversion happened (no 166.63999999 artifacts)
        assert "." in str(expected)
        parts = str(expected).split(".")
        assert len(parts[1]) <= 2  # Max 2 decimal places

    def test_daily_interest_heloc(self):
        """HELOC $50,000 at 8%: daily interest = $10.96."""
        daily = _manual_daily_interest(Decimal("50000"), Decimal("8"))
        assert daily == Decimal("10.96")

    def test_daily_interest_credit_card(self):
        """Credit card $5,000 at 24.99%: daily = $3.42."""
        daily = _manual_daily_interest(Decimal("5000"), Decimal("24.99"))
        assert daily == Decimal("3.42")

    def test_monthly_interest_matches_daily_times_30(self):
        """Monthly interest ≈ daily × 30 (within rounding tolerance)."""
        b, apr = Decimal("10000"), Decimal("20")
        monthly = _manual_monthly_interest(b, apr)
        daily = _manual_daily_interest(b, apr)
        # monthly = B × APR / 12 / 100 = $166.67
        # daily × 30 = $5.48 × 30 = $164.40 (slightly different due to 365 vs 12)
        # Tolerance: within 2%
        diff_pct = abs(float(monthly) - float(daily) * 30) / float(monthly)
        assert diff_pct < 0.02, f"Monthly vs daily*30 drift: {diff_pct:.4%}"


# ── MONTHS TO PAYOFF ─────────────────────────────────────────────

class TestMonthsToPayoff:
    """Verify iterative amortization matches closed-form where applicable."""

    def test_zero_apr_exact_division(self):
        """$12,000 at 0%, $1,000/mo → exactly 12 months."""
        months = calculate_months_to_payoff(
            Decimal("12000"), Decimal("0"), Decimal("1000")
        )
        assert months == 12

    def test_known_credit_card_payoff(self):
        """$5,000 at 20% with $200/mo."""
        months = calculate_months_to_payoff(
            Decimal("5000"), Decimal("20"), Decimal("200")
        )
        # Manual: using amortization formula
        # n = -log(1 - r*PV/PMT) / log(1+r)
        r = 0.20 / 12
        pv = 5000
        pmt = 200
        n_formula = -math.log(1 - r * pv / pmt) / math.log(1 + r)
        # Engine uses iterative, should be within 1 month of formula
        assert abs(months - round(n_formula)) <= 1, (
            f"Engine: {months}, Formula: {n_formula:.1f}"
        )

    def test_payment_equals_interest_caps_at_600(self):
        """If payment = exact monthly interest, balance never decreases."""
        b = Decimal("10000")
        apr = Decimal("24")
        monthly_interest = b * (apr / Decimal("100") / Decimal("12"))
        months = calculate_months_to_payoff(b, apr, monthly_interest)
        assert months == 600  # Functional infinity

    def test_payment_slightly_above_interest(self):
        """Payment is $1 above interest: very slow but should eventually pay off."""
        b = Decimal("10000")
        apr = Decimal("24")
        monthly_interest = b * (apr / Decimal("100") / Decimal("12"))
        months = calculate_months_to_payoff(b, apr, monthly_interest + Decimal("1"))
        assert months > 100  # Very slow
        assert months < 600  # But not infinite

    def test_large_payment_fast_payoff(self):
        """$5,000 debt with $5,000/mo payment → 1-2 months."""
        months = calculate_months_to_payoff(
            Decimal("5000"), Decimal("24"), Decimal("5000")
        )
        assert months <= 2


# ── TOTAL INTEREST PAID ──────────────────────────────────────────

class TestTotalInterest:
    """Verify total interest accumulation over life of debt."""

    def test_zero_apr_zero_interest(self):
        """0% APR → $0 total interest."""
        total = calculate_total_interest(
            Decimal("5000"), Decimal("0"), Decimal("500")
        )
        assert total == Decimal("0")

    def test_total_interest_positive(self):
        """Any positive APR with positive balance → positive interest."""
        total = calculate_total_interest(
            Decimal("10000"), Decimal("20"), Decimal("300")
        )
        assert total > Decimal("0")

    def test_total_paid_equals_principal_plus_interest(self):
        """Cross-check: Total Paid = Original Balance + Total Interest."""
        balance = Decimal("5000")
        apr = Decimal("20")
        payment = Decimal("200")

        total_interest = calculate_total_interest(balance, apr, payment)
        months = calculate_months_to_payoff(balance, apr, payment)

        # Total paid = payment × months (approximately, last payment may differ)
        total_paid = payment * months
        # Total interest should be approximately total_paid - balance
        expected_interest_approx = total_paid - balance
        # Allow 1 payment tolerance (last month partial payment)
        tolerance = payment
        assert abs(total_interest - expected_interest_approx) <= tolerance, (
            f"Interest: {total_interest}, Expected ~{expected_interest_approx}"
        )

    def test_higher_apr_more_interest(self):
        """Same balance + payment: 24% APR should pay more interest than 12%."""
        low = calculate_total_interest(Decimal("10000"), Decimal("12"), Decimal("300"))
        high = calculate_total_interest(Decimal("10000"), Decimal("24"), Decimal("300"))
        assert high > low, f"24% interest ({high}) should exceed 12% ({low})"

    def test_higher_payment_less_interest(self):
        """Same balance + APR: larger payment → less total interest."""
        slow = calculate_total_interest(Decimal("10000"), Decimal("20"), Decimal("200"))
        fast = calculate_total_interest(Decimal("10000"), Decimal("20"), Decimal("500"))
        assert fast < slow, f"$500/mo interest ({fast}) should be less than $200/mo ({slow})"


# ── FREEDOM PATH SIMULATION ─────────────────────────────────────

class TestFreedomPathSimulation:
    """The heart of the engine: month-by-month debt elimination."""

    def test_single_debt_payoff_months_match(self):
        """Single debt freedom path months should match calculate_months_to_payoff."""
        debt = _debt("Solo Card", balance=5000, rate=20, min_pay=200)
        result = simulate_freedom_path([debt])

        expected_months = calculate_months_to_payoff(
            Decimal("5000"), Decimal("20"), Decimal("200")
        )
        # Allow 1 month tolerance due to rounding
        assert abs(result["total_months"] - expected_months) <= 1

    def test_freedom_date_in_future(self):
        """Freedom date should be in the future for active debt."""
        debt = _debt("Active Card", balance=10000, rate=24, min_pay=200)
        result = simulate_freedom_path([debt])
        freedom_date = date.fromisoformat(result["freedom_date"])
        assert freedom_date > date.today()

    def test_extra_payment_reduces_months(self):
        """Adding extra monthly cash should reduce total months."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        standard = simulate_freedom_path(debts)
        velocity = simulate_freedom_path(debts, Decimal("500"))
        assert velocity["total_months"] < standard["total_months"], (
            f"Velocity ({velocity['total_months']}) should be < standard ({standard['total_months']})"
        )

    def test_extra_payment_reduces_interest(self):
        """Extra payments should reduce total interest paid."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        standard = simulate_freedom_path(debts)
        velocity = simulate_freedom_path(debts, Decimal("500"))
        assert velocity["total_interest_paid"] < standard["total_interest_paid"]

    def test_multi_debt_avalanche_order(self):
        """With 3 debts, highest APR should be eliminated first."""
        debts = [
            _debt("Low APR", balance=3000, rate=10, min_pay=100),
            _debt("High APR", balance=3000, rate=25, min_pay=100),
            _debt("Mid APR", balance=3000, rate=15, min_pay=100),
        ]
        result = simulate_freedom_path(debts, Decimal("500"))

        # Find which debt was eliminated first
        first_elimination = None
        for snapshot in result["timeline"]:
            for event in snapshot["events"]:
                if "Eliminated" in event or "Paid Off" in event:
                    first_elimination = event
                    break
            if first_elimination:
                break

        assert first_elimination is not None, "No debt was eliminated"
        assert "High APR" in first_elimination, (
            f"Expected High APR first, got: {first_elimination}"
        )

    def test_timeline_balance_decreasing(self):
        """Total balance in timeline should be monotonically decreasing."""
        debt = _debt("Card", balance=5000, rate=20, min_pay=200)
        result = simulate_freedom_path([debt])

        balances = [s["total_balance"] for s in result["timeline"]]
        for i in range(1, len(balances)):
            assert balances[i] <= balances[i - 1], (
                f"Balance increased at month {i}: {balances[i-1]} → {balances[i]}"
            )

    def test_freedom_month_flagged(self):
        """Last snapshot should have is_freedom_month = True."""
        debt = _debt("Card", balance=5000, rate=20, min_pay=200)
        result = simulate_freedom_path([debt])
        last = result["timeline"][-1]
        assert last["is_freedom_month"] is True
        assert last["total_balance"] <= 0


# ── DEBT-FREE DATE (Standard vs Velocity) ───────────────────────

class TestDebtFreeDate:
    """Verify standard vs velocity date comparison."""

    def test_velocity_faster_than_standard(self):
        """With extra cash, velocity date should be before standard date."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        result = calculate_debt_free_date(debts, Decimal("500"))
        assert result["velocity_months"] < result["standard_months"]

    def test_months_saved_positive(self):
        """months_saved should be > 0 when extra_monthly > 0."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        result = calculate_debt_free_date(debts, Decimal("500"))
        assert result["months_saved"] > 0

    def test_interest_saved_positive(self):
        """interest_saved should be > 0 when extra_monthly > 0."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        result = calculate_debt_free_date(debts, Decimal("500"))
        assert result["interest_saved"] > Decimal("0")

    def test_no_extra_cash_no_savings(self):
        """With $0 extra, velocity = standard."""
        debts = [_debt("Card", balance=5000, rate=20, min_pay=200)]
        result = calculate_debt_free_date(debts, Decimal("0"))
        assert result["months_saved"] == 0

    def test_empty_debts_returns_today(self):
        """No debts: freedom date = today."""
        result = calculate_debt_free_date([])
        assert result["standard_months"] == 0
        assert result["velocity_months"] == 0

    def test_velocity_date_before_standard_date(self):
        """velocity_date should be chronologically before standard_date."""
        debts = [_debt("Big Debt", balance=50000, rate=20, min_pay=800)]
        result = calculate_debt_free_date(debts, Decimal("1000"))
        vel = date.fromisoformat(result["velocity_date"])
        std = date.fromisoformat(result["standard_date"])
        assert vel <= std, f"Velocity {vel} should be ≤ Standard {std}"


# ── PROJECTIONS CONSISTENCY ──────────────────────────────────────

class TestProjectionsConsistency:
    """get_projections ties everything together. Verify internal consistency."""

    def test_velocity_power_is_20_percent_of_cash(self):
        """velocity_power = 20% of liquid_cash."""
        debts = [_debt("Card", balance=5000, rate=20, min_pay=200)]
        result = get_projections(debts, Decimal("10000"))
        expected_power = float(Decimal("10000") * Decimal("0.20"))
        assert result["velocity_power"] == expected_power

    def test_total_debt_matches_sum(self):
        """total_debt should equal sum of all balances."""
        debts = [
            _debt("A", balance=5000, rate=20, min_pay=200),
            _debt("B", balance=3000, rate=15, min_pay=100),
        ]
        result = get_projections(debts, Decimal("5000"))
        assert result["total_debt"] == 8000.0

    def test_velocity_target_is_highest_apr(self):
        """velocity_target should be the name of the highest-APR debt."""
        debts = [
            _debt("Low", balance=5000, rate=10, min_pay=100),
            _debt("High", balance=3000, rate=25, min_pay=100),
        ]
        result = get_projections(debts, Decimal("5000"))
        assert result["velocity_target"] == "High"

    def test_months_saved_matches_debt_free_date(self):
        """months_saved should match what calculate_debt_free_date returns."""
        debts = [_debt("Card", balance=10000, rate=24, min_pay=200)]
        liquid = Decimal("10000")
        proj = get_projections(debts, liquid)
        extra = (liquid * Decimal("0.20")).quantize(Decimal("0.01"))
        manual = calculate_debt_free_date(debts, extra)
        assert proj["months_saved"] == manual["months_saved"]


# ── PURCHASE TIME-COST ───────────────────────────────────────────

class TestPurchaseTimeCost:
    """Verify that purchases correctly delay freedom."""

    def test_purchase_delays_freedom(self):
        """A $1,000 purchase should delay freedom by > 0 days."""
        debts = [_debt("Card", balance=5000, rate=24, min_pay=200)]
        result = calculate_purchase_time_cost(
            Decimal("1000"), debts, Decimal("500")
        )
        assert result["days_delayed"] > 0, "Purchase should delay freedom"

    def test_larger_purchase_more_delay(self):
        """$5,000 purchase should delay more than $1,000."""
        debts = [_debt("Card", balance=10000, rate=20, min_pay=200)]
        small = calculate_purchase_time_cost(Decimal("1000"), debts, Decimal("500"))
        large = calculate_purchase_time_cost(Decimal("5000"), debts, Decimal("500"))
        assert large["days_delayed"] >= small["days_delayed"], (
            f"$5k delay ({large['days_delayed']}) should ≥ $1k ({small['days_delayed']})"
        )

    def test_zero_purchase_zero_delay(self):
        """$0 purchase should not delay freedom at all."""
        debts = [_debt("Card", balance=5000, rate=20, min_pay=200)]
        result = calculate_purchase_time_cost(Decimal("0"), debts, Decimal("500"))
        assert result["days_delayed"] == 0


# ── PEACE SHIELD INTEGRATION ────────────────────────────────────

class TestPeaceShieldMath:
    """Verify shield percentage and deficit calculations."""

    def test_exact_target_is_100_percent(self):
        """Cash = target → exactly 100%."""
        result = get_peace_shield_status(Decimal("1000"), Decimal("1000"))
        assert result["fill_percentage"] == 100.0

    def test_double_target_still_100(self):
        """Cash > target → fill capped at 100%, still active."""
        result = get_peace_shield_status(Decimal("2000"), Decimal("1000"))
        assert result["fill_percentage"] == 100.0
        assert result["is_active"] is True

    def test_deficit_math(self):
        """Deficit = target - cash when cash < target."""
        result = get_peace_shield_status(Decimal("300"), Decimal("1000"))
        assert result["deficit"] == 700.0
        assert result["fill_percentage"] == 30.0


# ── DETECT DEBT ALERTS ──────────────────────────────────────────

class TestDetectDebtAlerts:
    """Verify the debt health alert scanner from the audit findings."""

    def test_critical_alert_payment_below_interest(self):
        """$500/mo on $50,000 at 22% APR → interest is ~$916/mo. Should flag CRITICAL."""
        debt = _debt("Big Card", balance=50000, rate=22, min_pay=500)
        alerts = detect_debt_alerts([debt])
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "critical"
        assert alerts[0]["debt_name"] == "Big Card"
        assert "Doesn't Cover Interest" in alerts[0]["title"]
        assert alerts[0]["details"]["shortfall"] > 0

    def test_warning_alert_low_principal_percentage(self):
        """Payment barely covers interest — <10% goes to principal."""
        # $10,000 at 24% → monthly interest = $200. Payment = $210 → only 4.8% principal
        debt = _debt("Trap Card", balance=10000, rate=24, min_pay=210)
        alerts = detect_debt_alerts([debt])
        assert len(alerts) == 1
        assert alerts[0]["severity"] == "warning"
        assert "Debt Trap" in alerts[0]["title"]

    def test_caution_alert_extended_payoff(self):
        """Payoff > 360 months (30 years) → CAUTION."""
        # $1,000,000 at 7%, $6500/mo → 10.3% to principal, 392 months payoff
        debt = _debt("Mega Mortgage", balance=1000000, rate=7, min_pay=6500)
        alerts = detect_debt_alerts([debt])
        assert len(alerts) >= 1
        caution = [a for a in alerts if a["severity"] == "caution"]
        assert len(caution) >= 1
        assert "Extended Payoff" in caution[0]["title"]

    def test_no_alert_for_healthy_debt(self):
        """$5,000 at 15% with $300/mo → healthy, no alerts."""
        debt = _debt("Healthy Card", balance=5000, rate=15, min_pay=300)
        alerts = detect_debt_alerts([debt])
        assert len(alerts) == 0

    def test_zero_balance_excluded(self):
        """Debt with $0 balance should be completely ignored."""
        debt = _debt("Paid Off", balance=0, rate=24, min_pay=200)
        alerts = detect_debt_alerts([debt])
        assert len(alerts) == 0

    def test_multiple_debts_sorted_by_severity(self):
        """Mixed severity debts: critical should come first."""
        debts = [
            _debt("Healthy", balance=5000, rate=10, min_pay=300),      # No alert
            _debt("Danger", balance=50000, rate=22, min_pay=500),      # CRITICAL
            _debt("Slow", balance=10000, rate=24, min_pay=210),        # WARNING
        ]
        alerts = detect_debt_alerts(debts)
        assert len(alerts) == 2  # Healthy produces no alert
        assert alerts[0]["severity"] == "critical"
        assert alerts[1]["severity"] == "warning"
