"""
Strategy Router — Velocity banking, Peace Shield, tactical GPS,
command center, purchase simulator, and cashflow intelligence.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from typing import List

from database import engine
from models import Account, CashflowItem, Transaction, User, MovementLog
from schemas import MovementExecute, SimulatorRequest
from helpers import bypass_fk, accounts_to_debt_objects, accounts_to_active_debt_objects
from auth import get_current_user_id

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

from velocity_engine import (
    DebtAccount, CashflowTactical, VelocityWeapon,
    get_projections, get_velocity_target, get_peace_shield_status,
    calculate_safe_attack_equity, simulate_freedom_path,
    generate_action_plan, calculate_purchase_time_cost,
    detect_debt_alerts,
    detect_float_kill_opportunities, get_closing_day_intelligence,
    get_hybrid_kill_target, detect_interest_rate_arbitrage,
    calculate_risky_opportunity,
    DEFAULT_PEACE_SHIELD,
)
from transaction_classifier import classify_transaction, classify_batch, get_cashflow_summary

router = APIRouter(prefix="/api", tags=["strategy"])


# ── PEACE SHIELD ───────────────────────────────────────────────

@router.get("/peace-shield")
async def get_peace_shield_data(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        liquid_cash = sum(acc.balance for acc in accounts if acc.type in ["checking", "savings"])
        return get_peace_shield_status(Decimal(str(liquid_cash)), shield_target)


@router.put("/user/me/shield")
def update_shield_target(data: dict):
    target = data.get("target", 5000)
    with Session(engine) as session:
        user = session.exec(select(User)).first()
        if not user:
            user = User(email="user@korex.io", shield_target=Decimal(str(target)))
            session.add(user)
        else:
            user.shield_target = Decimal(str(target))
            session.add(user)
        session.commit()
        return {"ok": True}


# ── VELOCITY PROJECTIONS ───────────────────────────────────────

@router.get("/velocity/projections")
async def get_velocity_projections(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """Calculate real velocity banking projections from account data."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        return get_projections(debts, Decimal(str(liquid_cash)))


@router.get("/velocity/freedom-path")
async def get_freedom_path(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """Get the month-by-month freedom path simulation."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        velocity_amount = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        return simulate_freedom_path(debts, velocity_amount)


@router.get("/velocity/simulate")
async def get_simulation(
    extra_cash: float,
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """Simulate payoff with custom extra monthly cash."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        base_velocity = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        total_monthly_power = base_velocity + Decimal(str(extra_cash))
        return simulate_freedom_path(debts, total_monthly_power)


# ── TACTICAL GPS & EXECUTION ──────────────────────────────────

@router.get("/strategy/tactical-gps")
async def get_tactical_gps(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """Generate a 2-month action plan with impact metrics."""
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        cashflows = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)

        cf_tactical = [
            CashflowTactical(
                name=cf.name,
                amount=cf.amount,
                day_of_month=cf.day_of_month,
                category=cf.category,
            )
            for cf in cashflows
        ]

        checking_balance = sum(acc.balance for acc in accounts if acc.type == "checking")

        # Dynamic Funding Source Selection
        asset_accounts = [acc for acc in accounts if acc.type in ["checking", "savings"] and acc.balance > 0]
        asset_accounts.sort(key=lambda x: x.balance, reverse=True)
        funding_name = asset_accounts[0].name if asset_accounts else "Checking"

        # Get User Shield Target
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        # Detect Velocity Weapons (HELOCs/UILs with available credit)
        weapons = [
            VelocityWeapon(
                name=acc.name,
                balance=Decimal(str(acc.balance)),
                credit_limit=Decimal(str(acc.credit_limit or 0)),
                interest_rate=Decimal(str(acc.interest_rate)),
                weapon_type=acc.debt_subtype or "heloc",
            )
            for acc in accounts
            if acc.type == "debt"
            and acc.debt_subtype in ("heloc", "uil")
            and (acc.credit_limit or 0) > acc.balance
        ]

        movements = generate_action_plan(debts, cf_tactical, checking_balance, funding_name, shield_target, weapons)

        # Velocity weapons summary for frontend
        weapons_summary = [
            {
                "name": w.name,
                "weapon_type": w.weapon_type,
                "balance": float(w.balance),
                "credit_limit": float(w.credit_limit),
                "available_credit": float(w.available_credit),
                "interest_rate": float(w.interest_rate),
            }
            for w in weapons
        ]

        # Freedom date projections (reuse existing engine function)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        projections = get_projections(debts, Decimal(str(liquid_cash)))

        return {
            "movements": movements,
            "velocity_weapons": weapons_summary,
            "freedom_date_velocity": projections.get("velocity_debt_free_date"),
            "freedom_date_standard": projections.get("standard_debt_free_date"),
            "months_saved": projections.get("months_saved", 0),
            "interest_saved": projections.get("interest_saved", 0),
        }


@router.post("/strategy/execute")
async def execute_movement(data: MovementExecute, user_id: str = Depends(get_current_user_id)):
    """Executes a tactical movement by creating a transaction and UPDATING BALANCES.

    Includes fuzzy account name matching as fallback for cases where the
    Action Plan generates slightly different names than what's stored in DB.
    """
    import logging
    logger = logging.getLogger("corex.execute")

    with Session(engine) as session:
        amount = Decimal(str(data.amount))

        # Load ALL user accounts once for efficient matching
        all_accounts = session.exec(
            select(Account).where(Account.user_id == user_id)
        ).all()

        def find_account(name: str) -> Account | None:
            """Try exact match first, then case-insensitive, then partial match."""
            # 1. Exact match
            for acc in all_accounts:
                if acc.name == name:
                    return acc
            # 2. Case-insensitive match
            name_lower = name.lower().strip()
            for acc in all_accounts:
                if acc.name.lower().strip() == name_lower:
                    return acc
            # 3. Partial match (name contains or is contained by)
            for acc in all_accounts:
                if name_lower in acc.name.lower() or acc.name.lower() in name_lower:
                    return acc
            return None

        # 1. Find Source Account (e.g. "Marcus Savings (Investment)")
        source_acc = find_account(data.source)
        if source_acc:
            # Guard: prevent negative balance on source account
            if source_acc.balance < amount:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "code": "INSUFFICIENT_FUNDS",
                        "message": f"Fondos insuficientes. {source_acc.name} tiene ${source_acc.balance:.2f}, no se puede deducir ${amount:.2f}.",
                        "account_name": source_acc.name,
                        "current_balance": float(source_acc.balance),
                        "requested_amount": float(amount),
                    },
                )
            source_acc.balance -= amount
            session.add(source_acc)

        # 2. Find Destination Account (e.g. "Amex Platinum Business")
        dest_acc = find_account(data.destination)
        if dest_acc:
            # Debt accounts: paying debt reduces balance (subtract)
            # Non-debt accounts (checking/savings): receiving money increases balance (add)
            if dest_acc.type == "debt":
                # Cap debt payment at outstanding balance
                capped_amount = min(amount, dest_acc.balance)
                dest_acc.balance -= capped_amount
                dest_acc.min_payment = calculate_minimum_payment(
                    dest_acc.balance, dest_acc.interest_rate,
                )
            else:
                dest_acc.balance += amount
            session.add(dest_acc)

        # 3. Validate at least one account was found
        if not source_acc and not dest_acc:
            available = [f"'{a.name}' ({a.type})" for a in all_accounts]
            logger.warning(
                f"Execute failed for user {user_id}: "
                f"source='{data.source}' dest='{data.destination}' not found. "
                f"Available: {available}"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Neither source '{data.source}' nor destination '{data.destination}' "
                    f"found in your accounts."
                ),
            )

        # 4. Record Transaction
        primary_account_id = source_acc.id if source_acc else dest_acc.id  # type: ignore[union-attr]

        try:
            tx = Transaction(
                date=date.today().isoformat(),
                amount=amount,
                description=f"Velocity Execution: {data.title}",
                category="Debt Payment" if dest_acc else "Transfer",
                account_id=primary_account_id,
                user_id=user_id,
            )
            session.add(tx)
            with bypass_fk(session):
                session.commit()

            logger.info(
                f"Movement executed: user={user_id} amount={amount} "
                f"src={'✓' if source_acc else '✗'} dest={'✓' if dest_acc else '✗'}"
            )

            return {
                "status": "executed",
                "new_balance_source": float(source_acc.balance) if source_acc else "N/A",
                "new_balance_dest": float(dest_acc.balance) if dest_acc else "N/A",
                "source_found": bool(source_acc),
                "dest_found": bool(dest_acc),
            }
        except Exception as e:
            logger.error(f"Execute commit failed: user={user_id} error={e}")
            raise HTTPException(status_code=400, detail=f"Execution Failed: {str(e)}")


@router.get("/strategy/executed-logs")
async def get_executed_logs(user_id: str = Depends(get_current_user_id)):
    """Retrieve all logged strategic movements for current user."""
    with Session(engine) as session:
        return session.exec(select(MovementLog).where(MovementLog.user_id == user_id)).all()


# ── PURCHASE SIMULATOR ────────────────────────────────────────

@router.post("/simulator/time-cost")
async def simulate_purchase_cost(
    req: SimulatorRequest,
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """Calculate how many days a purchase delays freedom."""
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive.")

    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        extra_monthly = (Decimal(str(liquid_cash)) * Decimal('0.20')).quantize(Decimal('0.01'))
        return calculate_purchase_time_cost(Decimal(str(req.amount)), debts, extra_monthly)


# ── TRANSACTION CLASSIFIER ────────────────────────────────────

@router.get("/transactions/classified")
async def get_classified_transactions(limit: int = 50, user_id: str = Depends(get_current_user_id)):
    """Return transactions with smart tags (income/debt/life)."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(limit)
        ).all()
        raw = [
            {"id": tx.id, "account_id": tx.account_id, "amount": float(tx.amount),
             "date": tx.date, "name": tx.description, "category": tx.category}
            for tx in txs
        ]
        return classify_batch(raw)


@router.get("/cashflow/summary")
async def get_cashflow_intelligence(user_id: str = Depends(get_current_user_id)):
    """Return the AI-classified cashflow summary."""
    with Session(engine) as session:
        txs = session.exec(
            select(Transaction).where(Transaction.user_id == user_id).order_by(Transaction.date.desc()).limit(100)
        ).all()
        raw = [
            {"amount": float(tx.amount), "name": tx.description, "category": tx.category}
            for tx in txs
        ]
        classified = classify_batch(raw)
        return get_cashflow_summary(classified)


# ── STRATEGY COMMAND CENTER ───────────────────────────────────

@router.get("/strategy/command-center")
async def get_strategy_command_center(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    """
    Consolidated Strategy Intelligence endpoint.
    Returns morning briefing, confidence meter, freedom counter,
    and attack streak — all in one call.
    """
    with Session(engine) as session:
        # --- 1. Load all user accounts ---
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        debt_accounts = accounts_to_active_debt_objects(accounts, plan_limit)
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")
        liquid_cash_dec = Decimal(str(liquid_cash))

        # --- 2. Shield status ---
        shield = get_peace_shield_status(liquid_cash_dec, shield_target)

        # --- 3. Safe Attack Equity ---
        safety_data = calculate_safe_attack_equity(liquid_cash_dec, shield_target, debt_accounts)
        attack_amount = safety_data["safe_equity"]

        # --- 4. Velocity Target (Avalanche) ---
        target = get_velocity_target(debt_accounts)

        # --- 5. Morning Briefing ---
        morning_briefing = None
        if target and attack_amount > 0:
            daily_interest = (target.balance * (target.interest_rate / Decimal('100'))) / Decimal('365')
            daily_interest = daily_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            # Detect interest gaps across all debts
            total_gap_cost = Decimal('0')
            gap_debts = []
            for d in debt_accounts:
                if d.balance <= 0:
                    continue
                mi = (d.balance * (d.interest_rate / Decimal('100'))) / Decimal('12')
                mi = mi.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                shortfall = mi - d.min_payment
                if shortfall > 0:
                    total_gap_cost += shortfall
                    gap_debts.append({
                        "name": d.name,
                        "shortfall": float(shortfall),
                        "apr": float(d.interest_rate),
                    })

            # Effective attack = total extra minus gap coverage
            effective_attack = max(attack_amount - total_gap_cost, Decimal('0'))

            interest_saved_monthly = (effective_attack * (target.interest_rate / Decimal('100'))) / Decimal('12')
            interest_saved_monthly = interest_saved_monthly.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            days_accelerated = 0
            if target.min_payment > 0:
                months_saved = effective_attack / target.min_payment
                days_accelerated = int((months_saved * Decimal('30')).quantize(Decimal('1')))

            hourly_rate = Decimal('25')
            annual_interest_saved = interest_saved_monthly * Decimal('12')
            freedom_hours = (annual_interest_saved / hourly_rate).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)

            # Build reason string with gap info
            if total_gap_cost > 0:
                reason = (
                    f"Gap-First Strategy: ${float(total_gap_cost):,.2f}/mo covers interest gaps on "
                    f"{len(gap_debts)} debt(s). Remaining ${float(effective_attack):,.2f} "
                    f"attacks {target.name} at {float(target.interest_rate)}% APR"
                )
            else:
                reason = (
                    f"Highest APR at {float(target.interest_rate)}% — "
                    f"costs ${float(daily_interest)}/day in interest"
                )

            morning_briefing = {
                "available_cash": float(liquid_cash_dec),
                "attack_amount": float(attack_amount),
                "shield_status": {
                    "percentage": shield.get("fill_percentage", 0),
                    "is_active": shield.get("is_active", False),
                    "health": shield.get("health", "unknown"),
                },
                "recommended_action": {
                    "amount": float(effective_attack),
                    "destination": target.name,
                    "destination_apr": float(target.interest_rate),
                    "destination_balance": float(target.balance),
                    "daily_cost": float(daily_interest),
                    "reason": reason,
                    "gap_coverage": {
                        "total_cost": float(total_gap_cost),
                        "debts": gap_debts,
                    } if total_gap_cost > 0 else None,
                },
                "impact": {
                    "days_accelerated": days_accelerated,
                    "interest_saved_monthly": float(interest_saved_monthly),
                    "freedom_hours_earned": float(freedom_hours),
                },
            }

        # --- 6. Confidence Meter (all debts ranked) ---
        confidence_meter = {"debts_ranked": [], "strategy": "avalanche", "explanation": ""}
        if debt_accounts:
            ranked = sorted(debt_accounts, key=lambda d: d.interest_rate, reverse=True)
            confidence_meter["debts_ranked"] = [
                {
                    "name": d.name, "apr": float(d.interest_rate),
                    "balance": float(d.balance),
                    "daily_cost": float((d.balance * (d.interest_rate / Decimal('100'))) / Decimal('365')),
                    "is_target": (target and d.name == target.name),
                }
                for d in ranked
            ]
            if len(ranked) >= 2:
                top, second = ranked[0], ranked[1]
                confidence_meter["explanation"] = (
                    f"Every $100 to {top.name} saves "
                    f"${float(top.interest_rate)}/yr vs "
                    f"${float(second.interest_rate)}/yr to {second.name}"
                )

        # --- 7. Freedom Counter ---
        projections = get_projections(debt_accounts, liquid_cash_dec)

        # Accurate days recovered = actual date diff (standard - velocity)
        std_date_str = projections.get("standard_debt_free_date", "N/A")
        vel_date_str = projections.get("velocity_debt_free_date", "N/A")
        try:
            from datetime import datetime as _dt
            std_dt = _dt.fromisoformat(std_date_str)
            vel_dt = _dt.fromisoformat(vel_date_str)
            days_recovered = max(0, (std_dt - vel_dt).days)
        except (ValueError, TypeError):
            days_recovered = projections.get("months_saved", 0) * 30

        freedom_counter = {
            "current_freedom_date": vel_date_str,
            "standard_freedom_date": std_date_str,
            "months_saved": projections.get("months_saved", 0),
            "interest_saved": projections.get("interest_saved", 0),
            "total_days_recovered": days_recovered,
            "velocity_power": projections.get("velocity_power", 0),
        }

        # --- 8. Attack Streak ---
        executed_logs = session.exec(
            select(MovementLog)
            .where(MovementLog.status.in_(["executed", "verified"]), MovementLog.user_id == user_id)
            .order_by(MovementLog.date_executed.desc())
        ).all()

        total_attacks = len(executed_logs)
        current_streak = 0
        if executed_logs:
            months_with_attacks = set()
            for log in executed_logs:
                if log.date_executed:
                    months_with_attacks.add(log.date_executed[:7])

            check_date = date.today().replace(day=1)
            for _ in range(24):
                month_key = check_date.strftime("%Y-%m")
                if month_key in months_with_attacks:
                    current_streak += 1
                    if check_date.month == 1:
                        check_date = date(check_date.year - 1, 12, 1)
                    else:
                        check_date = date(check_date.year, check_date.month - 1, 1)
                else:
                    break

        streak = {"current": current_streak, "total_attacks": total_attacks}

        # --- 9. Decision Helper Options ---
        decision_options = None
        if target and attack_amount > 0:
            full_attack_savings = float(
                (attack_amount * (target.interest_rate / Decimal('100'))) / Decimal('12')
            )
            shield_gap = max(Decimal('0'), shield_target - liquid_cash_dec)
            shield_boost_pct = min(
                Decimal('100'),
                ((liquid_cash_dec + attack_amount) / shield_target) * Decimal('100'),
            ) if shield_target > 0 else Decimal('100')

            half = attack_amount / Decimal('2')
            split_savings = float((half * (target.interest_rate / Decimal('100'))) / Decimal('12'))

            shield_pct = shield.get("fill_percentage", 100)
            if shield_pct < 50:
                recommended = "shield"
            elif shield_pct < 80:
                recommended = "split"
            else:
                recommended = "attack"

            decision_options = {
                "options": [
                    {
                        "id": "attack", "label": "Full Attack",
                        "amount": float(attack_amount),
                        "impact": f"Save ${full_attack_savings:.2f}/mo in interest",
                        "description": f"Apply all to {target.name}",
                    },
                    {
                        "id": "shield", "label": "Boost Shield",
                        "amount": float(attack_amount),
                        "impact": f"Shield reaches {float(shield_boost_pct):.0f}%",
                        "description": "Strengthen your emergency fund",
                    },
                    {
                        "id": "split", "label": "Balanced Split",
                        "amount": float(attack_amount),
                        "impact": f"Save ${split_savings:.2f}/mo + boost shield",
                        "description": "50% attack, 50% safety",
                    },
                ],
                "recommended": recommended,
            }

        # --- 10. Debt Health Alerts ---
        debt_alerts = detect_debt_alerts(debt_accounts)

        # --- 11. Float Kill Opportunities (Credit Card Grace Period) ---
        float_kills = detect_float_kill_opportunities(debt_accounts, attack_amount)

        # --- 12. Closing Day Intelligence (Purchase Timing) ---
        closing_intel = get_closing_day_intelligence(debt_accounts)

        # --- 13. Hybrid Kill Analysis (Snowball + Avalanche) ---
        hybrid_analysis = get_hybrid_kill_target(debt_accounts, attack_amount)

        # --- 14. Interest Rate Arbitrage (Savings vs Debt) ---
        savings_for_arbitrage = [
            {
                "name": acc.name,
                "balance": float(acc.balance),
                "apy": float(acc.apy) if acc.apy else 0.5,
            }
            for acc in accounts
            if acc.type in ("checking", "savings") and acc.balance > 0
        ]
        arbitrage_alerts = detect_interest_rate_arbitrage(savings_for_arbitrage, debt_accounts)

        # --- 15. Risky Opportunity (Shield Sacrifice) ---
        # Only calculate when no safe attack is available
        risky_opportunity = None
        if morning_briefing is None:
            # Find the best source account name for execution
            asset_accounts = [acc for acc in accounts if acc.type in ("checking", "savings") and acc.balance > 0]
            asset_accounts.sort(key=lambda x: x.balance, reverse=True)
            source_name = asset_accounts[0].name if asset_accounts else "Checking"

            risky_opportunity = calculate_risky_opportunity(
                liquid_cash_dec, shield_target, debt_accounts, source_name
            )

        return {
            "morning_briefing": morning_briefing,
            "confidence_meter": confidence_meter,
            "freedom_counter": freedom_counter,
            "streak": streak,
            "decision_options": decision_options,
            "debt_alerts": debt_alerts,
            "float_kills": float_kills,
            "closing_day_intelligence": closing_intel,
            "hybrid_kill_analysis": hybrid_analysis,
            "arbitrage_alerts": arbitrage_alerts,
            "risky_opportunity": risky_opportunity,
        }

