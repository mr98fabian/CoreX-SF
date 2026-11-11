"""
Analytics Router — Spending insights, trends, and category breakdowns.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, timedelta
from collections import defaultdict

from database import engine
from models import Transaction
from auth import get_current_user_id
from api_tokens import require_scope
from plan_guard import scoped_plan_limit
from database import request_session

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/spending-by-category")
async def spending_by_category(
    months: int = 3,
    user_id: str = Depends(get_current_user_id),
):
    """
    Returns spending grouped by category for the last N months.
    Only includes expenses (negative amounts).
    """
    with Session(engine) as session:
        cutoff = date.today() - timedelta(days=months * 30)
        txs = session.exec(
            select(Transaction)
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff.isoformat(), Transaction.amount < 0)
        ).all()

        categories: dict[str, float] = defaultdict(float)
        for tx in txs:
            cat = tx.category or "Uncategorized"
            categories[cat] += float(abs(tx.amount))

        # Sort by amount descending
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)

        return {
            "months": months,
            "total_spent": sum(v for _, v in sorted_cats),
            "categories": [{"name": k, "amount": round(v, 2)} for k, v in sorted_cats],
        }


@router.get("/monthly-trend")
async def monthly_trend(
    months: int = 6,
    user_id: str = Depends(get_current_user_id),
):
    """
    Returns income vs expenses per month for the last N months.
    """
    with Session(engine) as session:
        cutoff = date.today() - timedelta(days=months * 30)
        txs = session.exec(
            select(Transaction)
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff.isoformat())
        ).all()

        monthly: dict[str, dict] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
        for tx in txs:
            key = str(tx.date)[:7]  # Transaction.date is ISO "YYYY-MM-DD" (str by design)
            if tx.amount > 0:
                monthly[key]["income"] += float(tx.amount)
            else:
                monthly[key]["expense"] += float(abs(tx.amount))

        # Sort by month ascending
        sorted_months = sorted(monthly.items())

        return {
            "months": months,
            "trend": [
                {
                    "month": k,
                    "income": round(v["income"], 2),
                    "expense": round(v["expense"], 2),
                    "net": round(v["income"] - v["expense"], 2),
                }
                for k, v in sorted_months
            ],
        }


@router.get("/summary")
async def analytics_summary(
    user_id: str = Depends(get_current_user_id),
):
    """
    Returns quick summary stats: average monthly spending, top category,
    spending velocity (trend direction).
    """
    with Session(engine) as session:
        cutoff_3m = date.today() - timedelta(days=90)
        txs = session.exec(
            select(Transaction)
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff_3m.isoformat(), Transaction.amount < 0)
        ).all()

        total_spent = sum(float(abs(tx.amount)) for tx in txs)
        avg_monthly = total_spent / 3 if txs else 0

        # Top category
        categories: dict[str, float] = defaultdict(float)
        for tx in txs:
            categories[tx.category or "Uncategorized"] += float(abs(tx.amount))

        top_category = max(categories.items(), key=lambda x: x[1]) if categories else ("None", 0)

        return {
            "avg_monthly_spending": round(avg_monthly, 2),
            "total_3m_spending": round(total_spent, 2),
            "top_category": top_category[0],
            "top_category_amount": round(top_category[1], 2),
            "transaction_count": len(txs),
        }


# ── Análisis v2: composed from the KoreX model, no transactions needed ──

TOP_BARS = 6
_C = Decimal("0.01")


@router.get("/v2")
async def analytics_v2(
    user_id: str = Depends(require_scope("read:dashboard")),
    plan_limit: int | None = Depends(scoped_plan_limit),
):
    """Every figure comes from an existing source; this endpoint only composes:
    - summary  = helpers.cashflow_summary_for (same as /api/cashflow/summary)
    - subscriptions = routers.recurring.summarize (same as /api/subscriptions)
    - debt payments = summary.debt_payments_monthly (plan_minimum)
    - daily interest = velocity_engine.daily_interest on the plan set (same as /api/dashboard)
    - avalanche target = velocity_engine.get_velocity_target
    - paid this month = transactions with helpers.PAYMENT_CATEGORIES, amount > 0
    Hero "Sale de tu bolsillo" = living expenses + active subscriptions (the
    summary reads only CashflowItem, so subscriptions are not counted twice)."""
    from helpers import (accounts_to_active_debt_objects, cashflow_summary_for, filter_active_debt_accounts,
                         is_payment_category)
    from models import Account, CashflowItem, RecurringSubscription
    from routers.recurring import summarize
    from velocity_engine import daily_interest, get_velocity_target, monthly_amount

    with request_session() as session:
        s = cashflow_summary_for(session, user_id, plan_limit)
        items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
        subs = session.exec(select(RecurringSubscription).where(RecurringSubscription.user_id == user_id)).all()
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        month = date.today().isoformat()[:7]
        paid = sum((Decimal(str(t.amount)) for t in session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
                    if is_payment_category(t.category) and Decimal(str(t.amount)) > 0 and str(t.date)[:7] == month), Decimal("0"))

    active_subs = [x for x in subs if x.status == "active"]
    subs_monthly = Decimal(summarize(subs)["monthly_total"])
    income, living, payments = s["income_monthly"], s["expenses_monthly"], s["debt_payments_monthly"]
    hero = living + subs_monthly

    # "En qué se va": one bar per recurring expense by name + one "Suscripciones"; top 6 + Otros
    bars = [{"nombre": i.name, "monto": monthly_amount(i.amount, i.frequency).quantize(_C, rounding=ROUND_HALF_UP), "tipo": "gasto"}
            for i in items if not (i.is_income or i.category == "income")]
    if subs_monthly > 0:
        bars.append({"nombre": "Suscripciones", "monto": subs_monthly, "tipo": "suscripciones"})
    bars.sort(key=lambda b: b["monto"], reverse=True)
    shown, hidden = bars[:TOP_BARS], bars[TOP_BARS:]
    if hidden:
        shown.append({"nombre": "Otros", "monto": hero - sum((b["monto"] for b in shown), Decimal("0")), "tipo": "otros"})
    elif shown:
        # per-bar rounding can drift a cent from the summary total: the largest bar absorbs it
        shown[0]["monto"] += hero - sum((b["monto"] for b in shown), Decimal("0"))

    debts = accounts_to_active_debt_objects(accounts, plan_limit)
    target = get_velocity_target(debts)
    daily = daily_interest(filter_active_debt_accounts(accounts, plan_limit))["total"]

    has_income = bool(s["has_income"])
    estado = "ok" if has_income else "vacio"
    motivo = None if has_income else ("sin_recurrentes" if not items else "sin_ingresos")
    f = lambda x: float(Decimal(x).quantize(_C, rounding=ROUND_HALF_UP))  # noqa: E731
    return {
        "estado": estado,
        "motivo": motivo,
        "etiqueta": "estimado",
        "heroe": {"sale_de_tu_bolsillo": f(hero)},
        "bloque": {
            "entra": f(income),
            "gastos_de_vida": f(living),
            "suscripciones": f(subs_monthly),
            "pagos_a_deudas": f(payments),
            "te_quedan": f(income - living - subs_monthly - payments),
        },
        "en_que_se_va": [{**b, "monto": f(b["monto"]), "pct": round(float(b["monto"] / hero * 100), 1) if hero > 0 else 0}
                         for b in shown],
        "deudas": {
            "interes_por_dia": f(daily),
            "objetivo": {"nombre": target.name, "apr": float(target.interest_rate)} if target else None,
            "pagado_este_mes": f(paid),
        },
        "suscripciones": {"activas": len(active_subs), "total_mensual": f(subs_monthly)},
    }
