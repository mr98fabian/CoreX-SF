"""Daily series of the projection (misión 2026-11-23-calendario-serie-diaria).
velocity_engine.daily_series places the monthly simulation's own flows on their real
day (interest at the cut, minimum at the due day, attack on paydays). Criteria:
  1. each month's close == timeline[i].total_balance, month by month;
  2. freedom day = the first day the daily series reaches 0 (no pace estimate)."""
from datetime import date, timedelta
from decimal import Decimal as D

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, CashflowItem, Subscription
from velocity_engine import DebtAccount, daily_series, simulate_freedom_path

U = "d5d5d5d5-d5d5-4d5d-a5d5-d5d5d5d5d5d5"
H = {"Authorization": "Bearer x"}


def debt(name, bal, apr, minp, sub="credit_card", due=None, cut=0):
    return DebtAccount(name=name, balance=D(str(bal)), interest_rate=D(str(apr)), min_payment=D(str(minp)),
                       debt_subtype=sub, due_day=due, closing_day=cut)


def semi_monthly(d: date) -> bool:
    return d.day in (1, 15)


def weekly_friday(d: date) -> bool:
    return d.weekday() == 4


USERS = {
    "cards_with_cut_and_due": ([debt("Visa", 4200, 26.99, 120, due=12, cut=20), debt("Amex", 1800, 29.5, 60, due=3, cut=8)],
                               "650", semi_monthly),
    "fixed_loan_and_card": ([debt("Carro", 15325.11, 20.29, 641.12, "auto_loan", due=5), debt("Fortiva", 92.38, 36, 25, due=28, cut=1)],
                            "400", weekly_friday),
    "no_paydays_no_days_loaded": ([debt("Upstart", 9463.94, 32.30, 331.04, "personal_loan"), debt("Store", 640, 24, 35)],
                                  "250", None),
    "end_of_month_due_31": ([debt("Chase", 3000, 22, 90, due=31, cut=30)], "500", semi_monthly),
}


def month_closes(points):
    """YYYY-MM -> balance of that month's last listed point (the month-end point)."""
    out = {}
    for p in points:
        out[p["date"][:7]] = p["total_balance"]
    return out


def expand(points, until: date):
    """Step series -> {date: balance} for every day from the first point to `until`."""
    listed = {date.fromisoformat(p["date"]): p["total_balance"] for p in points}
    day, value, out = date.fromisoformat(points[0]["date"]), points[0]["total_balance"], {}
    while day <= until:
        value = listed.get(day, value)
        out[day] = value
        day += timedelta(days=1)
    return out


@pytest.mark.parametrize("today", [date(2026, 11, 1), date(2026, 11, 23), date(2027, 2, 14)])
@pytest.mark.parametrize("user", sorted(USERS))
def test_month_close_matches_timeline(user, today):
    debts, extra, payday = USERS[user]
    r = daily_series(debts, D(extra), payday, today)
    plan = simulate_freedom_path(debts, D(extra), start=today)
    assert r["timeline"] == plan["timeline"]  # the monthly contract is untouched
    closes = month_closes(r["daily_series"])
    assert [closes[t["date"]] for t in plan["timeline"]] == [t["total_balance"] for t in plan["timeline"]]
    assert set(closes) == {t["date"] for t in plan["timeline"]}
    # starts at today's total, never goes negative, and is flat before `today`
    series = expand(r["daily_series"], date.fromisoformat(r["daily_series"][-1]["date"]))
    total = float(sum((d.balance for d in debts), D("0")))
    assert r["daily_series"][0] == {"date": today.replace(day=1).isoformat(), "total_balance": total}
    assert all(v >= 0 for v in series.values())
    assert all(series[today.replace(day=k)] == total for k in range(1, today.day))


def test_zero_day_is_first_zero():
    """$1,000 at 0 %, minimum $100 on the 10th, $300 extra over paydays 1 and 15.
    Nov: 850 → 750 → 600 · Dec: 450 → 350 → 200 · Jan: 150 (1st) → 50 (10th) → 0 on the 15th.
    The old pace estimate (start 200 / pace 400 × 31 days) said the 16th."""
    r = daily_series([debt("Card", 1000, 0, 100, due=10)], D("300"), semi_monthly, date(2026, 11, 1))
    series = expand(r["daily_series"], date(2027, 1, 31))
    first_zero = min(d for d, v in series.items() if v == 0)
    assert first_zero == date(2027, 1, 15)
    assert r["freedom_date"] == "2027-01-01" and r["timeline"][-1]["date"] == "2027-01"
    assert [series[date(2026, 11, k)] for k in (1, 9, 10, 15, 30)] == [850, 850, 750, 600, 600]
    assert [series[date(2027, 1, k)] for k in (1, 10, 14)] == [150, 50, 50]


def test_events_before_today_land_today():
    """Mid-month start: a due day already past this month is applied today, not backdated."""
    r = daily_series([debt("Card", 1000, 0, 100, due=10)], D("0"), None, date(2026, 11, 23))
    s = expand(r["daily_series"], date(2026, 12, 31))
    assert s[date(2026, 11, 22)] == 1000 and s[date(2026, 11, 23)] == 900
    assert s[date(2026, 12, 9)] == 900 and s[date(2026, 12, 10)] == 800


def test_interest_never_posts_after_the_payoff_payment():
    """A card that dies this month: its cut (25th) comes after the payday (1st). The interest
    moves to the payday, so the total never shows $0 before it really is: 500 + 10 interest
    − 460 attack on the 1st = 50, and the $50 minimum clears it on the 20th."""
    r = daily_series([debt("Visa", 500, 24, 50, due=20, cut=25)], D("1000"), lambda d: d.day == 1, date(2026, 11, 1))
    s = expand(r["daily_series"], date(2026, 11, 30))
    assert [s[date(2026, 11, k)] for k in (1, 19, 20, 30)] == [50, 50, 0, 0]
    assert r["total_months"] == 1 and r["total_interest_paid"] == 10.0


def test_no_debts():
    r = daily_series([], D("300"), semi_monthly, date(2026, 11, 23))
    assert r["timeline"] == [] and r["daily_series"] == [{"date": "2026-11-01", "total_balance": 0.0}]


@pytest.fixture
def owner(client):
    app.dependency_overrides[get_current_user_id] = lambda: U
    with Session(database.engine) as s:
        s.add(Subscription(user_id=U, plan="accelerator", status="active"))
        s.add(Account(user_id=U, name="Checking", type="checking", balance=D("1500")))
        for name, bal, apr, mn, sub, due, cut in (("Amex", "3327.50", "28.74", "99.96", "credit_card", 5, 12),
                                                  ("Carro", "15325.11", "20.29", "641.12", "auto_loan", 18, None)):
            s.add(Account(user_id=U, name=name, type="debt", balance=D(bal), interest_rate=D(apr), min_payment=D(mn),
                          debt_subtype=sub, interest_type="fixed" if sub == "auto_loan" else "revolving",
                          due_day=due, closing_day=cut))
        s.add(CashflowItem(user_id=U, name="Nómina", amount=D("2100"), frequency="semi_monthly", is_income=True,
                           category="income", date_specific_1=1, date_specific_2=15))
        s.add(CashflowItem(user_id=U, name="Renta", amount=D("1700"), frequency="monthly", is_income=False,
                           category="expense", day_of_month=1))
        s.commit()
    yield client
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CashflowItem, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def test_endpoint_daily_matches_timeline(owner):
    path = owner.get("/api/velocity/freedom-path", headers=H).json()
    assert {"timeline", "freedom_date", "freedom_month_display", "total_interest_paid", "total_months"} <= set(path)
    closes = month_closes(path["daily_series"])
    assert [closes[t["date"]] for t in path["timeline"]] == [t["total_balance"] for t in path["timeline"]]
    # the attack lands on the paydays (1st and 15th), the minimums on the 5th and 18th
    later = [p for p in path["daily_series"] if p["date"] > date.today().isoformat()[:7] + "-31"]
    assert {p["date"][8:] for p in later} <= {"01", "05", "12", "15", "18", "28", "29", "30", "31"}
    # and freedom-path's monthly answer is the same as compare's (one source)
    c = owner.get("/api/velocity/compare", headers=H).json()
    assert [p["saldo"] for p in c["plan"]["puntos"][1:]] == [t["total_balance"] for t in path["timeline"]]
