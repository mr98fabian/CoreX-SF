"""Guardian: the savings-estimate's invented 40% "velocity acceleration" is dead. No source
file may bring back VELOCITY_ACCELERATION or a 0.40 savings factor; real savings come only
from compare_paths (GET /api/velocity/compare)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SELF = Path(__file__).resolve()
SKIP = {"venv", ".venv", "node_modules", "dist", "build", "__pycache__", ".git", "android", "ios"}


def _sources():
    for base in (ROOT / "backend", ROOT / "frontend" / "src", ROOT / "mcp"):
        for p in base.rglob("*"):
            if p.suffix in (".py", ".ts", ".tsx", ".js") and not SKIP.intersection(p.parts) and p.resolve() != SELF:
                yield p


def test_no_velocity_acceleration_anywhere():
    hits = [str(p) for p in _sources() if "VELOCITY_ACCELERATION" in p.read_text(encoding="utf-8", errors="ignore")]
    assert hits == []


def test_no_040_savings_factor():
    factor = re.compile(r"(?<![\d.])0?\.40?(?![\d])")
    hits = []
    for p in _sources():
        for n, line in enumerate(p.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if re.search(r"0\.40(?!\d)", line) or (factor.search(line) and re.search(r"saving|ahorr|acceler|aceler", line, re.I)):
                hits.append(f"{p.relative_to(ROOT)}:{n}: {line.strip()}")
    assert hits == []


def test_savings_estimate_returns_only_real_fields(client):
    from decimal import Decimal
    from sqlmodel import Session, select
    import database
    from auth import get_current_user_id
    from main import app
    from models import Account
    uid = "c3c3c3c3-c3c3-4c3c-a3c3-c3c3c3c3c3c3"
    app.dependency_overrides[get_current_user_id] = lambda: uid
    dead = {"annual_savings", "monthly_savings", "roi_days", "years_without", "years_with",
            "total_interest_without", "total_interest_with"}
    try:
        for seed in (False, True):  # without and with debts
            if seed:
                with Session(database.engine) as s:
                    s.add(Account(user_id=uid, name="Visa", type="debt", balance=Decimal("4000"), interest_rate=Decimal("24"),
                                  min_payment=Decimal("120"), debt_subtype="credit_card"))
                    s.commit()
            body = client.get("/api/subscriptions/savings-estimate").json()
            assert body["has_data"] is seed
            assert (body["daily_interest_all"] > 0) is seed
            for plan in body["plans"].values():
                assert dead.isdisjoint(plan) and set(plan) == {"accounts_used", "daily_interest_burning", "plan_cost_annual"}
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
        with Session(database.engine) as s:
            for row in s.exec(select(Account).where(Account.user_id == uid)).all():
                s.delete(row)
            s.commit()
