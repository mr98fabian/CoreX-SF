"""
Coach — the facts the user's own AI (via MCP) needs to coach in KoreX's voice.

  GET/PATCH /api/coach-profile  tone, the name the user gave their AI, payday weekday
  GET       /api/logros         achievements computed HERE from real data; the AI only narrates

The backend computes, the AI speaks — never the other way round. A figure that
can't be computed from today's data is null with a note, never estimated.
Open to the app session and to kx_ tokens (read:dashboard / write:accounts).
"""
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from api_tokens import audit_summary, require_scope
from database import request_session
from helpers import accounts_to_active_debt_objects, get_attack_percentage, get_cashflow_surplus, get_liquid_cash
from models import Account, CoachProfile, Transaction
from plan_guard import scoped_plan_limit
from velocity_engine import get_projections

router = APIRouter(prefix="/api", tags=["coach"])

TONE_LABEL = {"calido": "Cálido", "directo": "Directo", "pesado": "Modo pesado"}
WEEKDAYS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
PAYMENT_CATEGORIES = ("payment", "debt payment")


def _profile(session, user_id: str) -> CoachProfile:
    p = session.exec(select(CoachProfile).where(CoachProfile.user_id == user_id)).first()
    if not p:
        p = CoachProfile(user_id=user_id)
        session.add(p)
        session.commit()
        session.refresh(p)
    return p


def _out(p: CoachProfile) -> dict:
    return {"tone": p.tone, "tone_label": TONE_LABEL[p.tone], "ai_name": p.ai_name,
            "payday_weekday": p.payday_weekday,
            "payday_label": WEEKDAYS[p.payday_weekday] if p.payday_weekday is not None else None}


class CoachPatch(BaseModel):
    tone: Optional[Literal["calido", "directo", "pesado"]] = None
    ai_name: Optional[str] = PField(default=None, max_length=40)
    payday_weekday: Optional[int] = PField(default=None, ge=0, le=6)


@router.get("/coach-profile")
async def get_coach_profile(user_id: str = Depends(require_scope("read:dashboard"))):
    with request_session() as session:
        return _out(_profile(session, user_id))


@router.patch("/coach-profile")
async def patch_coach_profile(body: CoachPatch, user_id: str = Depends(require_scope("write:accounts"))):
    sent = body.model_dump(exclude_unset=True)
    with request_session() as session:
        p = _profile(session, user_id)
        if "tone" in sent and sent["tone"] is not None:
            p.tone = sent["tone"]
        if "ai_name" in sent:
            p.ai_name = (sent["ai_name"] or "").strip() or None
        if "payday_weekday" in sent:
            p.payday_weekday = sent["payday_weekday"]
        p.updated_at = datetime.utcnow()
        session.add(p)
        session.commit()
        session.refresh(p)
        audit_summary(f"Perfil de coach: tono {TONE_LABEL[p.tone]}" + (f", nombre {p.ai_name}" if p.ai_name else ""))
        return _out(p)


def _money(x) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


@router.get("/logros")
async def get_logros(user_id: str = Depends(require_scope("read:dashboard")),
                     plan_limit: int | None = Depends(scoped_plan_limit)):
    with request_session() as session:
        accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
        debt_ids = {a.id for a in accounts if a.type == "debt"}
        payments = [t for t in session.exec(select(Transaction).where(Transaction.user_id == user_id)).all()
                    if (t.category or "").lower() in PAYMENT_CATEGORIES and Decimal(str(t.amount)) > 0]
        total_paid = sum((Decimal(str(t.amount)) for t in payments), Decimal("0"))
        debts_all = [a for a in accounts if a.type == "debt"]
        at_zero = sum(1 for a in debts_all if Decimal(str(a.balance)) <= 0)

        # Same engine path as the command center's freedom counter
        debts = accounts_to_active_debt_objects(accounts, plan_limit)
        proj = get_projections(debts, Decimal(str(get_liquid_cash(accounts))), get_attack_percentage(session, user_id),
                               extra_monthly=get_cashflow_surplus(session, user_id, debts))
        free_date = proj.get("velocity_debt_free_date") if debts else None

    def item(value, label: str, note: Optional[str] = None):
        return {"valor": value, "etiqueta": label, **({"nota": note} if note else {})}

    return {
        "total_pagado": item(_money(total_paid), "Total pagado a tus deudas registrado en KoreX"),
        "num_pagos": item(len(payments), "Pagos registrados"),
        "deudas_en_cero": item(at_zero, "Deudas en $0"),
        "deudas_totales": item(len(debts_all), "Deudas registradas"),
        "interes_evitado": item(_money(proj.get("interest_saved", 0)),
                                "Interés que evitas con tu plan frente a pagar solo los mínimos (estimado)"),
        "interes_plan": item(_money(proj.get("velocity_interest", 0)),
                             "Interés que aún pagarás siguiendo tu plan (estimado)"),
        "fecha_libre": item(free_date, "Fecha estimada en que quedas libre de deudas"),
        "racha_cortes_cero": item(None, "Cortes seguidos reportando $0",
                                  "Disponible cuando exista el historial de cortes; hoy no se calcula."),
        "fuente": "KoreX calcula estas cifras con tus datos reales; son estimaciones, no promesas.",
    }
