"""
Modo Compra de Casa: down-payment thermometer and DTI guard.

  GET /api/house-goal   {active: false} without a goal; with one: progress,
                        breakdown, ETA and estimated DTI (all labelled "estimado")
  PUT /api/house-goal   create/replace the goal (session or kx_ write:accounts)

The math lives in velocity_engine.house_goal_estimate; this router only reads
and presents. A figure that cannot be computed is null with a note.
"""
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from api_tokens import audit_summary, require_scope
from database import request_session
from helpers import accounts_to_active_debt_objects
from models import Account, CashflowItem, HouseGoal
from velocity_engine import (HOUSE_INSURANCE_PCT, HOUSE_RATE, HOUSE_TAX_PCT, house_goal_estimate,
                             monthly_income, plan_minimum)

router = APIRouter(prefix="/api", tags=["house"])
EST = "estimado"


class HouseGoalIn(BaseModel):
    target_total: Decimal = PField(gt=0, max_digits=14, decimal_places=2)
    home_price: Decimal = PField(gt=0, max_digits=14, decimal_places=2)
    down_pct: Decimal = PField(default=Decimal("3.5"), ge=0, le=50)
    closing_pct: Decimal = PField(default=Decimal("3.0"), ge=0, le=50)
    saved_amount: Decimal = PField(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    monthly_saving: Optional[Decimal] = PField(default=None, ge=0, max_digits=14, decimal_places=2)


def _m(x: Optional[Decimal]) -> Optional[float]:
    return None if x is None else float(Decimal(x).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _pct(x: Decimal) -> float:
    return float(x.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def _add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, min(d.day, 28))


def _view(session, user_id: str, g: HouseGoal) -> dict:
    accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    minimums = sum((plan_minimum(d) for d in accounts_to_active_debt_objects(accounts) if d.balance > 0), Decimal("0"))
    items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
    income = monthly_income([(i.amount, i.frequency, bool(i.is_income or i.category == "income")) for i in items])
    pace = Decimal(g.monthly_saving) if g.monthly_saving is not None else None
    e = house_goal_estimate(Decimal(g.target_total), Decimal(g.home_price), Decimal(g.down_pct), Decimal(g.closing_pct),
                            Decimal(g.saved_amount), pace, minimums, income)
    eta = e["eta_months"]
    dti = {
        "valor": _pct(e["dti"]) if e["dti"] is not None else None,
        "piti": _m(e["piti"]), "minimos_deudas": _m(minimums), "ingreso_mensual": _m(income),
        "etiqueta": EST,
        "supuestos": f"Hipoteca {HOUSE_RATE}% a 30 años, impuestos {HOUSE_TAX_PCT}% y seguro {HOUSE_INSURANCE_PCT}% "
                     "anuales sobre el precio; no incluye seguro hipotecario (MIP/PMI).",
    }
    if e["dti"] is None:
        dti["nota"] = "Sin ingreso en tu flujo de caja no se puede estimar el DTI."
    return {
        "active": True,
        "saved": _m(g.saved_amount), "target": _m(g.target_total), "home_price": _m(g.home_price),
        "down_pct": float(g.down_pct), "closing_pct": float(g.closing_pct), "monthly_saving": _m(pace),
        "pct": _pct(e["pct"]), "missing": _m(e["missing"]),
        "desglose": {"inicial": _m(e["down"]), "cierre": _m(e["closing"]), "reserva": _m(e["reserve"]), "etiqueta": EST},
        "eta_months": eta,
        "eta_date": _add_months(date.today(), eta).isoformat() if eta is not None else None,
        "eta_nota": None if eta is not None else "Sin ritmo de ahorro mensual no se puede estimar la fecha.",
        "dti": dti,
        "fuente": "Cifras estimadas por KoreX con tus datos; no son una precalificación ni una oferta de crédito.",
    }


@router.get("/house-goal")
async def get_house_goal(user_id: str = Depends(require_scope("read:dashboard"))):
    with request_session() as session:
        g = session.exec(select(HouseGoal).where(HouseGoal.user_id == user_id)).first()
        return _view(session, user_id, g) if g else {"active": False}


@router.put("/house-goal")
async def put_house_goal(body: HouseGoalIn, user_id: str = Depends(require_scope("write:accounts"))):
    data = body.model_dump()
    with request_session() as session:
        g = session.exec(select(HouseGoal).where(HouseGoal.user_id == user_id)).first() or HouseGoal(user_id=user_id, **data)
        for k, v in data.items():
            setattr(g, k, v)
        g.updated_at = datetime.utcnow()
        session.add(g)
        session.commit()
        session.refresh(g)
        audit_summary("Meta de compra de casa actualizada")
        return _view(session, user_id, g)
