"""
Dashboard Router — Main dashboard metrics and cashflow monitor.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from decimal import Decimal
from datetime import date, timedelta

from database import engine
from models import Account, CashflowItem, Transaction, User
from helpers import accounts_to_debt_objects, filter_active_debt_accounts, accounts_to_active_debt_objects
from auth import get_current_user_id
from velocity_engine import (
    DebtAccount, get_velocity_target, DEFAULT_PEACE_SHIELD,
    calculate_safe_attack_equity, detect_debt_alerts,
)

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core_engine.calculators import calculate_minimum_payment

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard_metrics(
    user_id: str = Depends(get_current_user_id),
    plan_limit: int | None = Query(None, description="Max active debt accounts per subscription plan"),
):
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        user = session.exec(select(User)).first()
        shield_target = user.shield_target if user else DEFAULT_PEACE_SHIELD

        # Plan-aware filtering: only active (unlocked) debts count
        # Note: only debts with balance > 0 are relevant (matches filter_active_debt_accounts)
        all_debts = [acc for acc in accounts if acc.type == "debt" and acc.balance > 0]
        active_debts = filter_active_debt_accounts(accounts, plan_limit)
        active_debt_ids = {id(a) for a in active_debts}

        total_debt = sum(acc.balance for acc in active_debts)
        total_all_debt = sum(acc.balance for acc in all_debts)
        unmonitored_debt = total_all_debt - total_debt
        liquid_cash = sum(acc.balance for acc in accounts if acc.type != "debt")

        # Calculate Chase Balance (or primary checking)
        chase_acc = next((acc for acc in accounts if "chase" in acc.name.lower() and acc.type == "checking"), None)
        if not chase_acc:
            chase_acc = next((acc for acc in accounts if acc.type == "checking"), None)

        chase_balance = chase_acc.balance if chase_acc else Decimal("0")

        # --- ATTACK EQUITY & SAFETY PROTOCOL ---
        debt_objects = accounts_to_active_debt_objects(accounts, plan_limit)

        # Fetch REAL cashflow items for accurate projection
        cashflow_items = session.exec(
            select(CashflowItem).where(CashflowItem.user_id == user_id)
        ).all()

        # Build recurring incomes list from actual DB data
        real_incomes = [
            {
                "name": item.name,
                "amount": Decimal(str(item.amount)),
                "day": item.day_of_month or 1,
            }
            for item in cashflow_items
            if item.category == "income" and item.frequency == "monthly"
        ]

        # Build recurring expenses list (non-debt bills: rent, utilities, etc.)
        real_expenses = [
            {
                "name": item.name,
                "amount": Decimal(str(item.amount)),
                "day": item.day_of_month or 1,
            }
            for item in cashflow_items
            if item.category == "expense" and item.frequency == "monthly"
        ]

        # Calculate Safe Attack Equity with REAL data
        safety_data = calculate_safe_attack_equity(
            liquid_cash, shield_target, debt_objects,
            recurring_incomes=real_incomes if real_incomes else None,
            recurring_expenses=real_expenses if real_expenses else None,
        )

        attack_equity = safety_data["safe_equity"]
        reserved_for_bills = safety_data["reserved_for_bills"]

        # Velocity Target (Highest Interest ACTIVE Debt)
        debts = active_debts
        velocity_target = None

        if debts:
            target_account = max(debts, key=lambda x: x.interest_rate)

            # --- SMART ADVICE LOGIC ---
            today = date.today()

            # 1. Find Next Payday (from Cashflow Items)
            incomes = [cf for cf in cashflow_items if cf.amount > 0]
            next_payday = today + timedelta(days=30)  # Default backup

            if incomes:
                candidates = []
                for inc in incomes:
                    try:
                        d = int(inc.day_of_month)
                        candidate_date = date(today.year, today.month, d)
                        if candidate_date < today:
                            if today.month == 12:
                                candidate_date = date(today.year + 1, 1, d)
                            else:
                                candidate_date = date(today.year, today.month + 1, d)
                        candidates.append(candidate_date)
                    except Exception:
                        pass
                if candidates:
                    next_payday = min(candidates)

            # 2. Determine Action Date
            has_surplus = attack_equity > 0
            action_date = today if has_surplus else next_payday

            # 3. Calculate Financials
            b = target_account.balance
            r = target_account.interest_rate
            daily_interest = b * (r / Decimal("100")) / Decimal("365")

            monthly_interest_cost = b * (r / Decimal("100")) / Decimal("12")
            principal_part = max(Decimal("0"), target_account.min_payment - monthly_interest_cost)

            # 4. Justification
            if has_surplus:
                why_text = (
                    f"Tienes un excedente SEGURO de ${float(attack_equity):,.2f}. "
                    f"(Ya reservamos ${float(reserved_for_bills):,.2f} para facturas próximas). "
                    f"Ataca hoy para eliminar interés diario."
                )
            else:
                if reserved_for_bills > 0:
                    why_text = (
                        f"Tu ataque está pausado por Seguridad. "
                        f"Reservando ${float(reserved_for_bills):,.2f} para pagos mínimos próximos. "
                        f"La prioridad es sobrevivir este mes."
                    )
                else:
                    why_text = "Tu ataque está recargando. Esperando ingresos."

            # --- MULTI-ACCOUNT ALLOCATION PLAN ---
            # Builds a breakdown: how much to take from EACH liquid account
            recommended_source = None
            attack_amount = float(attack_equity) if attack_equity > 0 else 0
            target_apr = float(r)
            target_balance = float(target_account.balance)
            checking_name = chase_acc.name if chase_acc else "Checking"

            if attack_amount > 0:
                # Gather ALL liquid accounts with positive balance
                liquid_accounts = [
                    acc for acc in accounts
                    if acc.type != "debt" and float(acc.balance) > 0
                ]
                # Priority: checking first, then savings, then by balance desc
                liquid_accounts.sort(
                    key=lambda a: (0 if a.type == "checking" else 1, -float(a.balance))
                )

                allocation_plan = []
                remaining = min(attack_amount, target_balance)
                total_allocated = 0

                for acc in liquid_accounts:
                    if remaining <= 0:
                        break
                    available = float(acc.balance)
                    take = round(min(available, remaining), 2)
                    if take > 0:
                        allocation_plan.append({
                            "source_name": acc.name,
                            "source_type": acc.type,
                            "amount": take,
                            "balance_after": round(available - take, 2),
                        })
                        remaining -= take
                        total_allocated += take

                # Check if we still need velocity weapons to cover the gap
                weapon_shortfall = target_balance - total_allocated
                weapon_allocations = []

                if weapon_shortfall > 0:
                    weapon_candidates = []
                    for acc in accounts:
                        if (acc.type == "debt"
                            and acc.debt_subtype in ("uil", "heloc")
                            and (acc.credit_limit or 0) > acc.balance
                            and float(acc.interest_rate) < target_apr):
                            avail_credit = float((acc.credit_limit or 0) - acc.balance)
                            spread = target_apr - float(acc.interest_rate)
                            weapon_candidates.append({
                                "type": acc.debt_subtype,
                                "source_name": acc.name,
                                "available": avail_credit,
                                "apr": float(acc.interest_rate),
                                "spread": spread,
                            })
                    weapon_candidates.sort(
                        key=lambda w: (0 if w["type"] == "uil" else 1, -w["spread"])
                    )

                    for w in weapon_candidates:
                        if weapon_shortfall <= 0:
                            break
                        take_w = round(min(w["available"], weapon_shortfall), 2)
                        if take_w > 0:
                            weapon_allocations.append({
                                "source_name": w["source_name"],
                                "source_type": w["type"],
                                "amount": take_w,
                                "apr": w["apr"],
                                "spread": w["spread"],
                            })
                            weapon_shortfall -= take_w
                            total_allocated += take_w

                # Build the recommended_source with full breakdown
                all_sources = [a["source_name"] for a in allocation_plan]
                all_sources += [w["source_name"] for w in weapon_allocations]

                # Determine type
                has_cash = len(allocation_plan) > 0
                has_weapons = len(weapon_allocations) > 0

                if has_cash and has_weapons:
                    rec_type = "combined"
                elif has_weapons:
                    rec_type = weapon_allocations[0]["source_type"]
                elif len(allocation_plan) == 1:
                    rec_type = "cash"
                else:
                    rec_type = "multi"

                # Build reason
                parts = []
                for a in allocation_plan:
                    parts.append(f"${a['amount']:,.2f} de {a['source_name']}")
                for w in weapon_allocations:
                    parts.append(
                        f"${w['amount']:,.2f} de {w['source_name']} "
                        f"({w['apr']}% APR, spread +{w['spread']:.1f}%)"
                    )
                reason = " + ".join(parts) if parts else "Sin fuentes disponibles"

                recommended_source = {
                    "type": rec_type,
                    "source_name": " + ".join(all_sources),
                    "amount": round(total_allocated, 2),
                    "reason_es": reason,
                    "interest_spread": target_apr,
                    "allocation_plan": allocation_plan,
                    "weapon_allocations": weapon_allocations,
                }

            velocity_target = {
                "name": target_account.name,
                "balance": float(target_account.balance),
                "interest_rate": float(target_account.interest_rate),
                "min_payment": float(target_account.min_payment),
                "action_date": action_date.strftime("%Y-%m-%d"),
                "priority_reason": f"Atacamos {target_account.name} (APR {float(r)}%) tras asegurar tus facturas.",
                "justification": why_text,
                "shield_note": f"🛡️ Shield: ${float(shield_target):,.0f} | 📅 Bills: ${float(reserved_for_bills):,.0f}",
                "daily_interest_saved": float(daily_interest),
                "next_payday": next_payday.strftime("%Y-%m-%d"),
                "recommended_source": recommended_source,
                "checking_account_name": checking_name,
            }

        # --- DEBT ALERTS (Phase 4 integration) ---
        debt_alerts = detect_debt_alerts(debt_objects) if debt_objects else []

        # --- TOTAL DAILY INTEREST (for DailyInterestTicker) ---
        total_daily_interest = sum(
            float(acc.balance * (acc.interest_rate / Decimal("100")) / Decimal("365"))
            for acc in active_debts
            if acc.interest_rate and acc.interest_rate > 0
        )

        # --- VELOCITY WEAPONS (HELOCs/UILs with available credit) ---
        velocity_weapons = [
            {
                "name": acc.name,
                "weapon_type": acc.debt_subtype,
                "balance": float(acc.balance),
                "credit_limit": float(acc.credit_limit or 0),
                "available_credit": float((acc.credit_limit or 0) - acc.balance),
                "interest_rate": float(acc.interest_rate),
            }
            for acc in accounts
            if acc.type == "debt"
            and acc.debt_subtype in ("heloc", "uil")
            and (acc.credit_limit or 0) > acc.balance
        ]

        return {
            "total_debt": total_debt,
            "liquid_cash": liquid_cash,
            "chase_balance": chase_balance,
            "shield_target": shield_target,
            "attack_equity": attack_equity,
            "reserved_for_bills": float(reserved_for_bills),
            "safety_breakdown": safety_data["breakdown"],
            "calendar": safety_data.get("projection_data", []),
            "velocity_target": velocity_target,
            "velocity_weapons": velocity_weapons,
            "unmonitored_debt": float(unmonitored_debt),
            "locked_account_count": len(all_debts) - len(active_debts),
            "debt_alerts": debt_alerts,
            "total_daily_interest": round(total_daily_interest, 2),
        }


@router.get("/dashboard/cashflow_monitor")
async def get_dashboard_monitor(timeframe: str = "monthly", type: str = "income", user_id: str = Depends(get_current_user_id)):
    """
    Calculate total cashflow (Income or Expense) for a specific timeframe.
    Timeframes: 'daily' (Today), 'weekly' (7d), 'monthly' (30d), 'annual' (365d).
    Type: 'income' (Inflows), 'expense' (Outflows).
    """
    with Session(engine) as session:
        today = date.today()
        start_date = today

        if timeframe == "weekly":
            start_date = today - timedelta(days=7)
        elif timeframe == "monthly":
            start_date = today - timedelta(days=30)
        elif timeframe == "annual":
            start_date = today - timedelta(days=365)

        query = select(Transaction).where(Transaction.date >= start_date, Transaction.user_id == user_id)
        all_txs_in_window = session.exec(query).all()

        if type == "income":
            filtered_txs = [tx for tx in all_txs_in_window if tx.amount > 0]
            total_amount = sum(tx.amount for tx in filtered_txs)
        else:
            filtered_txs = [tx for tx in all_txs_in_window if tx.amount < 0]
            total_amount = sum(abs(tx.amount) for tx in filtered_txs)

        return {
            "timeframe": timeframe,
            "type": type,
            "total_amount": total_amount,
            "transaction_count": len(filtered_txs),
        }
