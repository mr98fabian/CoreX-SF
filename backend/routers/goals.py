"""
Sección Metas: the user's own savings goals (the house goal stays in house.py).

  GET    /api/goals                     list with progress (read:dashboard)
  POST   /api/goals                     create (write:accounts)
  PATCH  /api/goals/{id}                edit (write:accounts)
  DELETE /api/goals/{id}                delete (write:accounts)
  POST   /api/goals/{id}/add-savings    {amount > 0} adds to saved_amount (write:accounts)

Progress (pct, remaining, ETA) comes from velocity_engine.goal_progress; this router
only reads, writes and serializes. The ETA is an estimate from the declared pace.
"""
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from api_tokens import audit_summary, require_scope
from database import request_session
from models import Goal
from velocity_engine import goal_progress

router = APIRouter(prefix="/api", tags=["goals"])
EST = "estimado"


class GoalIn(BaseModel):
    name: str = PField(min_length=1, max_length=80)
    target_amount: Decimal = PField(gt=0, max_digits=14, decimal_places=2)
    saved_amount: Decimal = PField(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    monthly_saving: Optional[Decimal] = PField(default=None, ge=0, max_digits=14, decimal_places=2)
    deadline: Optional[date] = None


class GoalPatch(BaseModel):
    name: Optional[str] = PField(default=None, min_length=1, max_length=80)
    target_amount: Optional[Decimal] = PField(default=None, gt=0, max_digits=14, decimal_places=2)
    saved_amount: Optional[Decimal] = PField(default=None, ge=0, max_digits=14, decimal_places=2)
    monthly_saving: Optional[Decimal] = PField(default=None, ge=0, max_digits=14, decimal_places=2)
    deadline: Optional[date] = None


class SavingsIn(BaseModel):
    amount: Decimal = PField(gt=0, max_digits=14, decimal_places=2)


def _m(x) -> Optional[float]:
    return None if x is None else float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _view(g: Goal) -> dict:
    p = goal_progress(Decimal(g.target_amount), Decimal(g.saved_amount),
                      Decimal(g.monthly_saving) if g.monthly_saving is not None else None)
    return {
        "id": g.id, "name": g.name,
        "target_amount": _m(g.target_amount), "saved_amount": _m(g.saved_amount),
        "monthly_saving": _m(g.monthly_saving),
        "deadline": g.deadline.isoformat() if g.deadline else None,
        "pct": float(p["pct"]), "remaining": _m(p["remaining"]), "completed": p["completed"],
        "eta_months": p["eta_months"],
        "eta_date": p["eta_date"].isoformat() if p["eta_date"] else None,
        "eta_etiqueta": EST,
        "eta_nota": None if p["eta_months"] is not None else "Sin ritmo de ahorro mensual no se puede estimar la fecha.",
    }


def _own(session, user_id: str, goal_id: int) -> Goal:
    g = session.get(Goal, goal_id)
    if not g or g.user_id != user_id:
        raise HTTPException(status_code=404, detail="Meta no encontrada.")
    return g


@router.get("/goals")
async def list_goals(user_id: str = Depends(require_scope("read:dashboard"))):
    with request_session() as session:
        goals = session.exec(select(Goal).where(Goal.user_id == user_id).order_by(Goal.created_at)).all()
        return {"goals": [_view(g) for g in goals],
                "fuente": "Fechas estimadas con el ahorro mensual que declaraste; no son una promesa."}


@router.post("/goals", status_code=201)
async def create_goal(body: GoalIn, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        g = Goal(user_id=user_id, **body.model_dump())
        session.add(g)
        session.commit()
        session.refresh(g)
        audit_summary(f"Meta creada: {g.name}")
        return _view(g)


@router.patch("/goals/{goal_id}")
async def edit_goal(goal_id: int, body: GoalPatch, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        g = _own(session, user_id, goal_id)
        for k, v in body.model_dump(exclude_unset=True).items():
            setattr(g, k, v)
        g.updated_at = datetime.utcnow()
        session.add(g)
        session.commit()
        session.refresh(g)
        audit_summary(f"Meta editada: {g.name}")
        return _view(g)


@router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: int, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        g = _own(session, user_id, goal_id)
        name = g.name
        session.delete(g)
        session.commit()
        audit_summary(f"Meta borrada: {name}")
        return {"deleted": goal_id}


@router.post("/goals/{goal_id}/add-savings")
async def add_savings(goal_id: int, body: SavingsIn, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        g = _own(session, user_id, goal_id)
        g.saved_amount = Decimal(g.saved_amount) + body.amount
        g.updated_at = datetime.utcnow()
        session.add(g)
        session.commit()
        session.refresh(g)
        audit_summary(f"Ahorro registrado en {g.name}: ${_m(body.amount):,.2f}")
        return _view(g)
