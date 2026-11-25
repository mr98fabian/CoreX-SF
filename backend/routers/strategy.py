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
    find_account_by_name, calc_attack_streak, update_account_balance, get_attack_percentage, get_cashflow_surplus, get_cashflow_breakdown, funding_accounts,
    build_daily_mission, dated_cashflow, filter_active_debt_accounts, mission_accounts_for,
    load_cashflow_inputs, payday_rule, get_plan_settings, build_plan_path, weapons_for,
)
import helpers
from auth import get_current_user_id
from api_tokens import require_scope
from plan_guard import effective_plan_limit, scoped_plan_limit

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

from velocity_engine import debt_daily_interest
from velocity_engine import (
    VelocityWeapon, get_projections, MISSION_WINDOW_DAYS, get_velocity_target,
    get_peace_shield_status, calculate_safe_attack_equity, simulate_freedom_path, monthly_attack, attack_impact,
    generate_action_plan, calculate_purchase_time_cost, detect_debt_alerts,
    get_closing_day_intelligence,
    detect_interest_rate_arbitrage, calculate_risky_opportunity,
    DEFAULT_PEACE_SHIELD, DEFAULT_ATTACK_PERCENTAGE, mission_json, compare_paths,
    daily_series, monthly_surplus,
)
from transaction_classifier import classify_batch, get_cashflow_summary

from routers.engagement import award_once

router = APIRouter(prefix="/api", tags=["strategy"])


# ── Peace Shield ─────────────────────────────────────────────

@router.get("/peace-shield")
def get_peace_shield_data(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        shield_target = get_shield_target(session, user_id)
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        return get_peace_shield_status(Decimal(str(get_liquid_cash(accounts))), shield_target)


@router.put("/user/me/shield")
def update_shield_target(data: dict, user_id: str = Depends(get_current_user_id)):
    target = Decimal(str(data.get("target", DEFAULT_PEACE_SHIELD)))
    with request_session() as session:
        settings = helpers.get_or_create_for_user(session, UserSettings, user_id)
        settings.shield_target = target
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
        settings = helpers.get_or_create_for_user(session, UserSettings, user_id)
        settings.attack_percentage = pct
        session.add(settings)
        with bypass_fk(session):
            session.commit()
        return {"ok": True}


# ── Velocity Projections ─────────────────────────────────────

@router.get("/velocity/projections")
def get_velocity_projections(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        data = load_cashflow_inputs(session, user_id)
        cf = get_cashflow_breakdown(session, user_id, debts, data=data)
        path = build_plan_path(session, user_id, accounts, plan_limit, today=helpers.today(), data=data)
        return get_projections(debts, Decimal(str(get_liquid_cash(accounts))),
                               get_attack_percentage(session, user_id),
                               extra_monthly=cf["surplus"], subscriptions_monthly=cf["subscriptions_monthly"],
                               eaten_by_subscriptions=cf["eaten_by_subscriptions"], plan_path=path)


@router.get("/velocity/freedom-path")
def get_freedom_path(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        # THE projection (velocity_engine.debt_path): the same result the plan, the GPS and the
        # command-center read. Monthly contract as before + daily_series + resumen_meses.
        path = build_plan_path(session, user_id, accounts, plan_limit, today=helpers.today())
        path.pop("movements", None)
        return path


@router.get("/velocity/compare")
def get_velocity_compare(
    user_id: str = Depends(require_scope("read:plan")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    """Inicio chart: plan vs minimums only. Same extra as /velocity/freedom-path,
    so plan.fecha_libre == freedom-path's date. Everything is computed in
    velocity_engine.compare_paths — the client computes nothing."""
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        data = load_cashflow_inputs(session, user_id)
        surplus = monthly_surplus(data["tuples"], debts, data["subscriptions"])
        velocity = monthly_attack(surplus, Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id))
        today = helpers.today()
        path = build_plan_path(session, user_id, accounts, plan_limit, today=today, data=data)
        return compare_paths(debts, velocity, start=today, plan_path=path,
                             fuente_aporte="excedente" if surplus is not None else "porcentaje_liquidez")


@router.get("/velocity/simulate")
def get_simulation(
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

def _month_totals(movements) -> dict:
    """Per month (YYYY-MM): what the GPS pays to debt by kind and what comes in. The Plan reads
    these; it never sums movements on the client (misión 17, spec §3)."""
    out: dict = {}
    keys = {"attack": "ataque", "obligation": "obligaciones", "min_payment": "minimos", "income": "ingresos",
            "shield": "escudo"}
    for m in movements:
        k = keys.get(m["type"])
        if k is None:
            continue
        row = out.setdefault(m["date"][:7], {v: Decimal("0") for v in keys.values()})
        row[k] += Decimal(str(m["amount"]))
    return {ym: {k: float(v.quantize(Decimal("0.01"))) for k, v in row.items()} for ym, row in out.items()}


@router.get("/strategy/tactical-gps")
def get_tactical_gps(
    user_id: str = Depends(require_scope("read:plan")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)

        weapons = weapons_for(accounts)
        # U-14 + misión 17: the GPS IS the cash leg of THE projection (debt_path), so its movements,
        # the Calendar and the freedom date come from one run. All liquid cash counts.
        data = load_cashflow_inputs(session, user_id)
        path = build_plan_path(session, user_id, accounts, plan_limit, today=helpers.today(), data=data)
        movements = path["movements"]
        projections = get_projections(debts, Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id),
                                      extra_monthly=monthly_surplus(data["tuples"], debts, data["subscriptions"]),
                                      plan_path=path)

        return {
            "movements": movements,
            "totales_mes": _month_totals(movements),
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
def execute_movement(data: MovementExecute, user_id: str = Depends(get_current_user_id)):
    import logging
    logger = logging.getLogger("korex.execute")

    with request_session() as session:
        amount = Decimal(str(data.amount))
        all_accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()

        source_acc = find_account_by_name(all_accounts, data.source)
        dest_acc = find_account_by_name(all_accounts, data.destination)

        # Two-sided law: no account loses more than the other receives. A payment
        # larger than the debt only applies up to the debt's balance; the source
        # loses exactly that applied amount, never the nominal one.
        applied = amount
        if dest_acc and dest_acc.type == "debt":
            applied = min(amount, Decimal(str(dest_acc.balance)))
            if applied <= 0:
                raise HTTPException(status_code=400, detail={
                    "code": "DEBT_ALREADY_PAID",
                    "message": f"{dest_acc.name} ya está en $0: no hay nada que pagar.",
                    "account_name": dest_acc.name,
                })

        if source_acc:
            if source_acc.balance < applied:
                raise HTTPException(status_code=400, detail={
                    "code": "INSUFFICIENT_FUNDS",
                    "message": f"Fondos insuficientes. {source_acc.name} tiene ${source_acc.balance:.2f}, no se puede deducir ${applied:.2f}.",
                    "account_name": source_acc.name,
                    "current_balance": float(source_acc.balance),
                    "requested_amount": float(applied),
                })
            source_acc.balance -= applied
            session.add(source_acc)

        if dest_acc:
            if dest_acc.type == "debt":
                dest_acc.balance -= applied
                dest_acc.min_payment = calculate_minimum_payment(dest_acc.balance, dest_acc.interest_rate)
            else:
                dest_acc.balance += applied
            session.add(dest_acc)

        if not source_acc and not dest_acc:
            logger.warning(f"Execute failed for user {user_id}: source='{data.source}' dest='{data.destination}' not found.")
            raise HTTPException(status_code=400, detail=f"Neither source '{data.source}' nor destination '{data.destination}' found in your accounts.")

        primary_id = source_acc.id if source_acc else dest_acc.id  # type: ignore[union-attr]
        try:
            capped = applied < amount
            tx = Transaction(date=date.today().isoformat(), amount=applied,
                             description=f"Velocity Execution: {data.title}"
                                         + (f" (aplicado ${applied:.2f} de ${amount:.2f}: la deuda llegó a $0)" if capped else ""),
                             category="Debt Payment" if dest_acc else "Transfer",
                             account_id=primary_id, user_id=user_id)
            session.add(tx)
            with bypass_fk(session):
                session.commit()
            if dest_acc and dest_acc.type == "debt":
                award_once(session, user_id, "payment", f"tx:{tx.id}")
                session.commit()
            logger.info(f"Movement executed: user={user_id} applied={applied} requested={amount}")
            return {
                "status": "executed",
                "amount_requested": float(amount),
                "amount_applied": float(applied),
                "new_balance_source": float(source_acc.balance) if source_acc else "N/A",
                "new_balance_dest": float(dest_acc.balance) if dest_acc else "N/A",
                "source_found": bool(source_acc), "dest_found": bool(dest_acc),
            }
        except Exception as e:
            logger.exception(f"Execute commit failed: user={user_id} error={e}")
            raise HTTPException(status_code=400, detail="Execution failed. No changes were saved.")


@router.get("/strategy/executed-logs")
def get_executed_logs(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        return session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()


# ── Purchase Simulator ───────────────────────────────────────

@router.post("/simulator/time-cost")
def simulate_purchase_cost(
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
def get_classified_transactions(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        txs = session.exec(select(Transaction).where(Transaction.user_id == user_id)
                          .order_by(Transaction.date.desc()).limit(limit)).all()
        return classify_batch([{"id": tx.id, "account_id": tx.account_id, "amount": float(tx.amount),
                                "date": tx.date, "name": tx.description, "category": tx.category} for tx in txs])


# ── Strategy Command Center ──────────────────────────────────

@router.get("/strategy/command-center")
def get_strategy_command_center(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Depends(effective_plan_limit),
):
    with request_session() as session:
        # Each table is read ONCE per request (perf 2026-11-22, misión command-center-cache): in
        # production every statement is a ~55 ms round trip. The rows travel as parameters to the
        # same helpers, so the answer is the one they always gave (tests/test_command_center_perf.py).
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        shield_target, attack_pct = get_plan_settings(session, user_id)
        debt_accounts = accounts_to_active_debt_objects(accounts, plan_limit)
        cf_data = load_cashflow_inputs(session, user_id)
        cf = get_cashflow_breakdown(session, user_id, debt_accounts, data=cf_data)
        surplus = cf["surplus"]  # == get_cashflow_surplus (same tuples, same subscriptions)
        liquid_cash = Decimal(str(get_liquid_cash(accounts)))
        shield = get_peace_shield_status(liquid_cash, shield_target)
        # One source with Inicio: obligations first, attack = what is left (engine)
        today = helpers.today()
        macc = mission_accounts_for(session, user_id, filter_active_debt_accounts(accounts, plan_limit), today)
        mission = build_daily_mission(session, user_id, accounts, plan_limit, today=today, shield_target=shield_target,
                                      cashflow=dated_cashflow(session, user_id, today, MISSION_WINDOW_DAYS, data=cf_data),
                                      data=cf_data, mission_accounts=macc)
        attack_amount = mission["ataque"]
        target = next((d for d in debt_accounts if d.name == mission["objetivo"]), None)

        # Morning Briefing
        morning_briefing = None
        if target and attack_amount > 0:
            daily_interest = debt_daily_interest(target.balance, target.interest_rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            gap_debts = [{"name": g["name"], "shortfall": float(g["shortfall"]), "apr": float(g["apr"])} for g in mission["gap_debts"]]
            # Engine: amount capped at the debt balance / cash; days from the same simulation route
            impact = attack_impact(debt_accounts, target, attack_amount, liquid_cash,
                                   monthly_attack(surplus, liquid_cash, attack_pct), start=today)
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
        path = build_plan_path(session, user_id, accounts, plan_limit, today=today, data=cf_data,
                               shield_target=shield_target, attack_percentage=attack_pct, mission_accounts=macc)
        projections = get_projections(debt_accounts, liquid_cash, attack_pct, extra_monthly=surplus, plan_path=path)
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
