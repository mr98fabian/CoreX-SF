"""
Analytics Router — Spending insights, trends, and category breakdowns.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from decimal import Decimal
from datetime import date, timedelta
from collections import defaultdict

from database import engine
from models import Transaction
from auth import get_current_user_id

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
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff, Transaction.amount < 0)
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
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff)
        ).all()

        monthly: dict[str, dict] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
        for tx in txs:
            key = tx.date.strftime("%Y-%m")
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
            .where(Transaction.user_id == user_id, Transaction.date >= cutoff_3m, Transaction.amount < 0)
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
