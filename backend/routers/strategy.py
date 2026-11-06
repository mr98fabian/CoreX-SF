"""
Strategy Router — Velocity banking, Peace Shield, tactical GPS,
command center, purchase simulator, and cashflow intelligence.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from decimal import Decimal, ROUND_HALF_UP
from datetime import date
from typing import List

from database import engine
from database import request_session
from models import Account, CashflowItem, Transaction, MovementLog, UserSettings
from schemas import MovementExecute, SimulatorRequest
from helpers import (
    bypass_fk, accounts_to_active_debt_objects, get_shield_target, get_liquid_cash,
    find_account_by_name, calc_attack_streak, update_account_balance, get_attack_percentage, get_cashflow_surplus,
)
from auth import get_current_user_id
from api_tokens import require_scope
from plan_guard import effective_plan_limit, scoped_plan_limit

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

from velocity_engine import (
    CashflowTactical, VelocityWeapon, get_projections, get_velocity_target,
    get_peace_shield_status, calculate_safe_attack_equity, simulate_freedom_path, monthly_attack, attack_impact,
    generate_action_plan, calculate_purchase_time_cost, detect_debt_alerts,
    detect_float_kill_opportunities, get_closing_day_intelligence,
    get_hybrid_kill_target, detect_interest_rate_arbitrage, calculate_risky_opportunity,
    DEFAULT_PEACE_SHIELD, DEFAULT_ATTACK_PERCENTAGE,
)
from transaction_classifier import classify_batch, get_cashflow_summary

router = APIRouter(prefix="/api", tags=["strategy"])


# ── Peace Shield ─────────────────────────────────────────────

@router.get("/peace-shield")
async def get_peace_shield_data(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        shield_target = get_shield_target(session, user_id)
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        return get_peace_shield_status(Decimal(str(get_liquid_cash(accounts))), shield_target)


@router.put("/user/me/shield")
def update_shield_target(data: dict, user_id: str = Depends(get_current_user_id)):
    target = Decimal(str(data.get("target", DEFAULT_PEACE_SHIELD)))
    with request_session() as session:
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        if settings:
            settings.shield_target = target
        else:
            settings = UserSettings(user_id=user_id, shield_target=target)
        session.add(settings)
        with bypass_fk(session):
            session.commit()
        return {"ok": True}


@router.put("/user/me/attack-percentage")
def update_attack_percentage(data: dict, user_id: str = Depends(get_current_user_id)):
    """User-configurable % of liquid cash attacked monthly — the assumption
    behind every velocity projection. Must stay user-editable, never a silent
    constant (see get_projections' assumptions block)."""
    pct = Decimal(str(data.get("percentage", DEFAULT_ATTACK_PERCENTAGE)))
    if pct < 0 or pct > 100:
        raise HTTPException(status_code=400, detail="percentage must be between 0 and 100.")
    with request_session() as session:
        settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        if settings:
            settings.attack_percentage = pct
        else:
            settings = UserSettings(user_id=user_id, attack_percentage=pct)
        session.add(settings)
        with bypass_fk(session):
            session.commit()
        return {"ok": True}


# ── Velocity Projections ─────────────────────────────────────

@router.get("/velocity/projections")
async def get_velocity_projections(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        return get_projections(debts, Decimal(str(get_liquid_cash(accounts))),
                               get_attack_percentage(session, user_id),
                               extra_monthly=get_cashflow_surplus(session, user_id, debts))


@router.get("/velocity/freedom-path")
async def get_freedom_path(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        velocity = monthly_attack(get_cashflow_surplus(session, user_id, debts),
                                  Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id))
        return simulate_freedom_path(debts, velocity)


@router.get("/velocity/simulate")
async def get_simulation(
    extra_cash: float,
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        base = monthly_attack(get_cashflow_surplus(session, user_id, debts),
                              Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id))
        return simulate_freedom_path(debts, base + Decimal(str(extra_cash)))


# ── Tactical GPS & Execution ─────────────────────────────────

@router.get("/strategy/tactical-gps")
async def get_tactical_gps(
    user_id: str = Depends(require_scope("read:plan")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        cashflows = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        cf_tactical = [CashflowTactical(name=cf.name, amount=cf.amount, day_of_month=cf.day_of_month, category=cf.category) for cf in cashflows]

        asset_accounts = sorted([acc for acc in accounts if acc.type != "debt" and acc.balance > 0],
                                key=lambda x: x.balance, reverse=True)
        funding_name = asset_accounts[0].name if asset_accounts else "Checking"
        shield_target = get_shield_target(session, user_id)

        weapons = [
            VelocityWeapon(name=acc.name, balance=Decimal(str(acc.balance)),
                           credit_limit=Decimal(str(acc.credit_limit or 0)),
                           interest_rate=Decimal(str(acc.interest_rate)), weapon_type=acc.debt_subtype or "heloc")
            for acc in accounts
            if acc.type == "debt" and acc.debt_subtype in ("heloc", "uil") and (acc.credit_limit or 0) > acc.balance
        ]

        # All liquid cash (checking + savings + cash), not just "checking": a cash-only user simulated from $0
        movements = generate_action_plan(debts, cf_tactical, Decimal(str(get_liquid_cash(accounts))),
                                         funding_name, shield_target, weapons)
        projections = get_projections(debts, Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id),
                                      extra_monthly=get_cashflow_surplus(session, user_id, debts))

        return {
            "movements": movements,
            "velocity_weapons": [
                {"name": w.name, "weapon_type": w.weapon_type, "balance": float(w.balance),
                 "credit_limit": float(w.credit_limit), "available_credit": float(w.available_credit),
                 "interest_rate": float(w.interest_rate)} for w in weapons
            ],
            "freedom_date_velocity": projections.get("velocity_debt_free_date"),
            "freedom_date_standard": projections.get("standard_debt_free_date"),
            "months_saved": projections.get("months_saved", 0),
            "interest_saved": projections.get("interest_saved", 0),
        }


@router.post("/strategy/execute")
async def execute_movement(data: MovementExecute, user_id: str = Depends(get_current_user_id)):
    import logging
    logger = logging.getLogger("korex.execute")

    with request_session() as session:
        amount = Decimal(str(data.amount))
        all_accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()

        source_acc = find_account_by_name(all_accounts, data.source)
        if source_acc:
            if source_acc.balance < amount:
                raise HTTPException(status_code=400, detail={
                    "code": "INSUFFICIENT_FUNDS",
                    "message": f"Fondos insuficientes. {source_acc.name} tiene ${source_acc.balance:.2f}, no se puede deducir ${amount:.2f}.",
                    "account_name": source_acc.name,
                    "current_balance": float(source_acc.balance),
                    "requested_amount": float(amount),
                })
            source_acc.balance -= amount
            session.add(source_acc)

        dest_acc = find_account_by_name(all_accounts, data.destination)
        if dest_acc:
            if dest_acc.type == "debt":
                dest_acc.balance -= min(amount, dest_acc.balance)
                dest_acc.min_payment = calculate_minimum_payment(dest_acc.balance, dest_acc.interest_rate)
            else:
                dest_acc.balance += amount
            session.add(dest_acc)

        if not source_acc and not dest_acc:
            logger.warning(f"Execute failed for user {user_id}: source='{data.source}' dest='{data.destination}' not found.")
            raise HTTPException(status_code=400, detail=f"Neither source '{data.source}' nor destination '{data.destination}' found in your accounts.")

        primary_id = source_acc.id if source_acc else dest_acc.id  # type: ignore[union-attr]
        try:
            tx = Transaction(date=date.today().isoformat(), amount=amount,
                             description=f"Velocity Execution: {data.title}",
                             category="Debt Payment" if dest_acc else "Transfer",
                             account_id=primary_id, user_id=user_id)
            session.add(tx)
            with bypass_fk(session):
                session.commit()
            logger.info(f"Movement executed: user={user_id} amount={amount}")
            return {
                "status": "executed",
                "new_balance_source": float(source_acc.balance) if source_acc else "N/A",
                "new_balance_dest": float(dest_acc.balance) if dest_acc else "N/A",
                "source_found": bool(source_acc), "dest_found": bool(dest_acc),
            }
        except Exception as e:
            logger.exception(f"Execute commit failed: user={user_id} error={e}")
            raise HTTPException(status_code=400, detail="Execution failed. No changes were saved.")


@router.get("/strategy/executed-logs")
async def get_executed_logs(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        return session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()


# ── Purchase Simulator ───────────────────────────────────────

@router.post("/simulator/time-cost")
async def simulate_purchase_cost(
    req: SimulatorRequest,
    user_id: str = Depends(require_scope("run:simulations")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        extra = (Decimal(str(get_liquid_cash(accounts))) * get_attack_percentage(session, user_id) / Decimal('100')).quantize(Decimal('0.01'))
        return calculate_purchase_time_cost(Decimal(str(req.amount)), debts, extra)


# ── Transaction Classifier ───────────────────────────────────

@router.get("/transactions/classified")
async def get_classified_transactions(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        txs = session.exec(select(Transaction).where(Transaction.user_id == user_id)
                          .order_by(Transaction.date.desc()).limit(limit)).all()
        return classify_batch([{"id": tx.id, "account_id": tx.account_id, "amount": float(tx.amount),
                                "date": tx.date, "name": tx.description, "category": tx.category} for tx in txs])


@router.get("/cashflow/summary")
async def get_cashflow_intelligence(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        txs = session.exec(select(Transaction).where(Transaction.user_id == user_id)
                          .order_by(Transaction.date.desc()).limit(100)).all()
        return get_cashflow_summary(classify_batch(
            [{"amount": float(tx.amount), "name": tx.description, "category": tx.category} for tx in txs]
        ))


# ── Strategy Command Center ──────────────────────────────────

@router.get("/strategy/command-center")
async def get_strategy_command_center(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        shield_target = get_shield_target(session, user_id)
        debt_accounts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = Decimal(str(get_liquid_cash(accounts)))
        shield = get_peace_shield_status(liquid_cash, shield_target)
        attack_amount = calculate_safe_attack_equity(liquid_cash, shield_target, debt_accounts)["safe_equity"]
        target = get_velocity_target(debt_accounts)

        # Morning Briefing
        morning_briefing = None
        if target and attack_amount > 0:
            daily_interest = ((target.balance * (target.interest_rate / Decimal('100'))) / Decimal('365')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total_gap_cost = Decimal('0')
            gap_debts = []
            for d in debt_accounts:
                if d.balance <= 0: continue
                mi = ((d.balance * (d.interest_rate / Decimal('100'))) / Decimal('12')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                shortfall = mi - d.min_payment
                if shortfall > 0:
                    total_gap_cost += shortfall
                    gap_debts.append({"name": d.name, "shortfall": float(shortfall), "apr": float(d.interest_rate)})
            effective_attack = max(attack_amount - total_gap_cost, Decimal('0'))
            # Engine: amount capped at the debt balance / cash; days from the same simulation route
            impact = attack_impact(debt_accounts, target, effective_attack, liquid_cash,
                                   monthly_attack(get_cashflow_surplus(session, user_id, debt_accounts),
                                                  liquid_cash, get_attack_percentage(session, user_id)))
            effective_attack = impact["amount"]
            interest_saved_monthly = impact["interest_saved_monthly"]
            days_accelerated = impact["days_accelerated"]
            freedom_hours = (interest_saved_monthly * Decimal('12') / Decimal('25')).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
            reason = (f"Gap-First Strategy: ${float(total_gap_cost):,.2f}/mo covers interest gaps on {len(gap_debts)} debt(s). "
                      f"Remaining ${float(effective_attack):,.2f} attacks {target.name} at {float(target.interest_rate)}% APR"
                      if total_gap_cost > 0 else
                      f"Highest APR at {float(target.interest_rate)}% — costs ${float(daily_interest)}/day in interest")
            morning_briefing = {
                "available_cash": float(liquid_cash), "attack_amount": float(attack_amount),
                "shield_status": {"percentage": shield.get("fill_percentage", 0), "is_active": shield.get("is_active", False), "health": shield.get("health", "unknown")},
                "recommended_action": {
                    "amount": float(effective_attack), "destination": target.name,
                    "destination_apr": float(target.interest_rate), "destination_balance": float(target.balance),
                    "daily_cost": float(daily_interest), "reason": reason,
                    "gap_coverage": {"total_cost": float(total_gap_cost), "debts": gap_debts} if total_gap_cost > 0 else None,
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
                 "daily_cost": float((d.balance * (d.interest_rate / Decimal('100'))) / Decimal('365')),
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
        if morning_briefing is None:
            asset_accounts = sorted([acc for acc in accounts if acc.type in ("checking", "savings") and acc.balance > 0],
                                    key=lambda x: x.balance, reverse=True)
            risky_opportunity = calculate_risky_opportunity(liquid_cash, shield_target, debt_accounts,
                                                            asset_accounts[0].name if asset_accounts else "Checking")

        return {
            "morning_briefing": morning_briefing,
            "confidence_meter": confidence_meter,
            "freedom_counter": freedom_counter,
            "streak": streak,
            "decision_options": decision_options,
            "debt_alerts": detect_debt_alerts(debt_accounts),
            "float_kills": detect_float_kill_opportunities(debt_accounts, attack_amount),
            "closing_day_intelligence": get_closing_day_intelligence(debt_accounts),
            "hybrid_kill_analysis": get_hybrid_kill_target(debt_accounts, attack_amount),
            "arbitrage_alerts": detect_interest_rate_arbitrage(
                [{"name": acc.name, "balance": float(acc.balance), "apy": float(acc.apy) if acc.apy else 0.5}
                 for acc in accounts if acc.type in ("checking", "savings") and acc.balance > 0], debt_accounts),
            "risky_opportunity": risky_opportunity,
        }
