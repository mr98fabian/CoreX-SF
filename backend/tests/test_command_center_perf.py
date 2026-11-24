"""Command-center (misión 2026-11-22-command-center-cache).
1. Same response as the ORIGINAL composition: `_original` below is the endpoint body as it was
   before the mission, copied verbatim (same helpers, each loading its own rows). The slim endpoint
   must answer the same JSON for every persona.
2. No table is read twice in one request (in production each statement is a ~55 ms round trip)."""
import re
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

import pytest
from fastapi.encoders import jsonable_encoder
from sqlalchemy import event
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from database import request_session
from helpers import (
    accounts_to_active_debt_objects, build_daily_mission, calc_attack_streak, funding_accounts,
    get_attack_percentage, get_cashflow_breakdown, get_cashflow_surplus, get_liquid_cash, get_shield_target,
)
from main import app
from models import (Account, CashflowItem, CutHistory, MovementLog, RecurringSubscription, Subscription,
                    Transaction, UserSettings)
from plan_guard import plan_limit_for
from routers.demo import MARIA, STRESS, _seed_impl
from velocity_engine import (
    attack_impact, calculate_risky_opportunity, debt_daily_interest, detect_debt_alerts,
    detect_interest_rate_arbitrage, get_closing_day_intelligence, get_peace_shield_status, get_projections,
    mission_json, monthly_attack,
)

U = "c7c7c7c7-c7c7-4c7c-a7c7-c7c7c7c7c7c7"
H = {"Authorization": "Bearer x"}
TABLES = (Transaction, CutHistory, MovementLog, CashflowItem, RecurringSubscription, UserSettings, Account, Subscription)


def _original(user_id, plan_limit):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        shield_target = get_shield_target(session, user_id)
        debt_accounts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = Decimal(str(get_liquid_cash(accounts)))
        shield = get_peace_shield_status(liquid_cash, shield_target)
        # One source with Inicio: obligations first, attack = what is left (engine)
        mission = build_daily_mission(session, user_id, accounts, plan_limit, shield_target=shield_target)
        attack_amount = mission["ataque"]
        target = next((d for d in debt_accounts if d.name == mission["objetivo"]), None)

        # Morning Briefing
        morning_briefing = None
        if target and attack_amount > 0:
            daily_interest = debt_daily_interest(target.balance, target.interest_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            gap_debts = [{"name": g["name"], "shortfall": float(g["shortfall"]), "apr": float(g["apr"])} for g in mission["gap_debts"]]
            # Engine: amount capped at the debt balance / cash; days from the same simulation route
            impact = attack_impact(debt_accounts, target, attack_amount, liquid_cash,
                                   monthly_attack(get_cashflow_surplus(session, user_id, debt_accounts),
                                                  liquid_cash, get_attack_percentage(session, user_id)))
            effective_attack = impact["amount"]
            interest_saved_monthly = impact["interest_saved_monthly"]
            days_accelerated = impact["days_accelerated"]
            freedom_hours = (interest_saved_monthly * Decimal('12') / Decimal('25')).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
            reason = f"Highest APR at {float(target.interest_rate)}% — costs ${float(daily_interest)}/day in interest"
            if gap_debts:
                reason += f". Warning: {len(gap_debts)} debt(s) grow because their minimum does not cover the interest"
            morning_briefing = {
                "available_cash": float(liquid_cash), "attack_amount": float(attack_amount),
                "shield_status": {"percentage": shield.get("fill_percentage", 0), "is_active": shield.get("is_active", False), "health": shield.get("health", "unknown")},
                "recommended_action": {
                    "amount": float(effective_attack), "destination": target.name,
                    "destination_apr": float(target.interest_rate), "destination_balance": float(target.balance),
                    "daily_cost": float(daily_interest), "reason": reason,
                    # debts whose minimum does not cover their interest: an alert, never paid ahead of the avalanche
                    "growing_debts": gap_debts or None,
                },
                "impact": {"days_accelerated": days_accelerated, "interest_saved_monthly": float(interest_saved_monthly),
                           "freedom_hours_earned": float(freedom_hours)},
            }

        # Confidence Meter
        confidence_meter = {"debts_ranked": [], "strategy": "avalanche", "explanation": ""}
        if debt_accounts:
            ranked = sorted(debt_accounts, key=lambda d: d.interest_rate, reverse=True)
            confidence_meter["debts_ranked"] = [
                {"name": d.name, "apr": float(d.interest_rate), "balance": float(d.balance),
                 "daily_cost": float(debt_daily_interest(d.balance, d.interest_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)),
                 "is_target": target and d.name == target.name} for d in ranked
            ]
            if len(ranked) >= 2:
                top, second = ranked[0], ranked[1]
                confidence_meter["explanation"] = f"Every $100 to {top.name} saves ${float(top.interest_rate)}/yr vs ${float(second.interest_rate)}/yr to {second.name}"

        # Freedom Counter
        projections = get_projections(debt_accounts, liquid_cash, get_attack_percentage(session, user_id),
                                      extra_monthly=get_cashflow_surplus(session, user_id, debt_accounts))
        std_date, vel_date = projections.get("standard_debt_free_date", "N/A"), projections.get("velocity_debt_free_date", "N/A")
        try:
            from datetime import datetime as _dt
            days_recovered = max(0, (_dt.fromisoformat(std_date) - _dt.fromisoformat(vel_date)).days)
        except (ValueError, TypeError):
            days_recovered = projections.get("months_saved", 0) * 30
        freedom_counter = {
            "current_freedom_date": vel_date, "standard_freedom_date": std_date,
            "months_saved": projections.get("months_saved", 0),
            "interest_saved": projections.get("interest_saved", 0),
            "total_days_recovered": days_recovered,
            "velocity_power": projections.get("velocity_power", 0),
        }

        # Attack Streak
        executed_logs = session.exec(
            select(MovementLog).where(MovementLog.status.in_(["executed", "verified"]), MovementLog.user_id == user_id)
            .order_by(MovementLog.date_executed.desc())
        ).all()
        streak = calc_attack_streak(executed_logs)

        # Decision Options
        decision_options = None
        if target and attack_amount > 0:
            full_attack = min(attack_amount, target.balance)  # never more than the target owes (D6)
            full_savings = float((full_attack * (target.interest_rate / Decimal('100'))) / Decimal('12'))
            shield_boost = min(Decimal('100'), ((liquid_cash + attack_amount) / shield_target) * Decimal('100')) if shield_target > 0 else Decimal('100')
            half_savings = float((attack_amount / Decimal('2') * (target.interest_rate / Decimal('100'))) / Decimal('12'))
            shield_pct = shield.get("fill_percentage", 100)
            recommended = "shield" if shield_pct < 50 else ("split" if shield_pct < 80 else "attack")
            decision_options = {
                "options": [
                    {"id": "attack", "label": "Full Attack", "amount": float(full_attack),
                     "impact": f"Save ${full_savings:.2f}/mo in interest", "description": f"Apply all to {target.name}"},
                    {"id": "shield", "label": "Boost Shield", "amount": float(attack_amount),
                     "impact": f"Shield reaches {float(shield_boost):.0f}%", "description": "Strengthen your emergency fund"},
                    {"id": "split", "label": "Balanced Split", "amount": float(attack_amount),
                     "impact": f"Save ${half_savings:.2f}/mo + boost shield", "description": "50% attack, 50% safety"},
                ],
                "recommended": recommended,
            }

        # Risky Opportunity
        risky_opportunity = None
        # Never suggest dipping into the shield while an obligation is pending
        if morning_briefing is None and mission["mision"] is None:
            asset_accounts = funding_accounts(accounts)
            risky_opportunity = calculate_risky_opportunity(liquid_cash, shield_target, debt_accounts,
                                                            asset_accounts[0].name if asset_accounts else "Checking")

        cf = get_cashflow_breakdown(session, user_id, debt_accounts)
        return {
            "excedente": {"mensual": float(cf["surplus"]) if cf["surplus"] is not None else None,
                          "suscripciones_mensuales": float(cf["subscriptions_monthly"]),
                          "comido_por_suscripciones": cf["eaten_by_subscriptions"]},
            "mision": mission_json(mission),
            "morning_briefing": morning_briefing,
            "confidence_meter": confidence_meter,
            "freedom_counter": freedom_counter,
            "streak": streak,
            "decision_options": decision_options,
            "debt_alerts": detect_debt_alerts(debt_accounts),
            "closing_day_intelligence": get_closing_day_intelligence(debt_accounts),
            "arbitrage_alerts": detect_interest_rate_arbitrage(
                [{"name": acc.name, "balance": float(acc.balance), "apy": float(acc.apy) if acc.apy else 0.5}
                 for acc in funding_accounts(accounts)], debt_accounts),
            "risky_opportunity": risky_opportunity,
        }


def _wipe():
    with Session(database.engine) as s:
        for model in TABLES:
            for row in s.exec(select(model).where(model.user_id == U)).all():
                s.delete(row)
        s.commit()


def _debt(s, name, bal, apr, mn, **kw):
    s.add(Account(user_id=U, name=name, type="debt", balance=Decimal(bal), interest_rate=Decimal(apr),
                  min_payment=Decimal(mn), debt_subtype=kw.pop("sub", "credit_card"), **kw))


def maria():
    _seed_impl(U, MARIA)


def stress():
    _seed_impl(U, STRESS)


def no_debts():
    with Session(database.engine) as s:
        s.add(Account(user_id=U, name="Checking", type="checking", balance=Decimal("2500")))
        s.commit()


def debts_without_cashflow():
    with Session(database.engine) as s:
        s.add(Account(user_id=U, name="Checking", type="checking", balance=Decimal("4000")))
        _debt(s, "Visa", "4200", "26.99", "120", due_day=12, closing_day=20)
        _debt(s, "Carro", "15325.11", "20.29", "641.12", sub="auto_loan", due_day=5)
        s.commit()


def low_shield_with_history():
    with Session(database.engine) as s:
        s.add(UserSettings(user_id=U, shield_target=Decimal("5000"), attack_percentage=Decimal("35")))
        s.add(Account(user_id=U, name="Checking", type="checking", balance=Decimal("1800"), apy=Decimal("4.1")))
        for name, bal, apr, mn, due, cut in (("Amex", "3327.50", "28.74", "99.96", 5, 12),
                                             ("Chase", "1200", "22", "40", 18, 25), ("Fortiva", "92.38", "36", "25", 28, 1)):
            _debt(s, name, bal, apr, mn, due_day=due, closing_day=cut)
        s.add(CashflowItem(user_id=U, name="Nómina", amount=Decimal("2100"), frequency="semi_monthly", is_income=True,
                           category="income", date_specific_1=1, date_specific_2=15))
        s.add(CashflowItem(user_id=U, name="Renta", amount=Decimal("1500"), frequency="monthly", category="expense", day_of_month=1))
        s.add(RecurringSubscription(user_id=U, name="Netflix", amount=Decimal("15.49"), frequency="monthly", status="active"))
        for d in ("2026-11-03", "2026-11-10", "2026-11-17"):
            s.add(MovementLog(user_id=U, movement_key=f"atk-{d}", title="Ataque", amount=Decimal("100"),
                              date_planned=d, date_executed=d, status="executed"))
        s.commit()
        amex = s.exec(select(Account).where(Account.user_id == U, Account.name == "Amex")).first()
        s.add(CutHistory(user_id=U, account_id=amex.id, cut_date=date(2026, 11, 12), reported_balance=Decimal("3400")))
        s.add(Transaction(user_id=U, account_id=amex.id, amount=Decimal("-60"), date="2026-11-14",
                          description="pago", category="payment"))
        s.commit()


PERSONAS = [maria, stress, no_debts, debts_without_cashflow, low_shield_with_history]


@pytest.fixture
def user(client):
    _wipe()
    app.dependency_overrides[get_current_user_id] = lambda: U
    yield client
    app.dependency_overrides.pop(get_current_user_id, None)
    _wipe()


@pytest.mark.parametrize("persona", PERSONAS, ids=lambda p: p.__name__)
def test_same_response_as_original(user, persona):
    persona()
    with Session(database.engine) as s:
        limit = plan_limit_for(s, U)
    expected = jsonable_encoder(_original(U, limit))
    got = user.get("/api/strategy/command-center", headers=H)
    assert got.status_code == 200
    assert got.json() == expected


@pytest.mark.parametrize("persona", [maria, low_shield_with_history], ids=lambda p: p.__name__)
def test_sql_statements(user, persona):
    persona()
    seen = []

    def on_sql(_conn, _cur, statement, *_a):
        m = re.search(r"\bFROM (\w+)", statement)
        if statement.lstrip().upper().startswith("SELECT") and m:
            seen.append(m.group(1))
    event.listen(database.engine, "before_cursor_execute", on_sql)
    try:
        assert user.get("/api/strategy/command-center", headers=H).status_code == 200
    finally:
        event.remove(database.engine, "before_cursor_execute", on_sql)
    repeated = sorted({t for t in seen if seen.count(t) > 1})
    assert repeated == [], (repeated, seen)
    # the endpoint's own reads (the plan lookup of effective_plan_limit is separate): one per table;
    # transactions only when a debt has a recorded cut (payments since it). Was 11 for María.
    own = [t for t in seen if t not in ("subscriptions", "access_grants", "users")]
    assert set(own) <= {"accounts", "user_settings", "cashflow_items", "recurring_subscriptions",
                        "cut_history", "transactions", "movement_log"}, own
    assert len(own) <= (6 if persona is maria else 7), own
