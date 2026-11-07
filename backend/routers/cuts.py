"""
Cut history — what balance each debt reported at each statement cut.

  POST /api/cuts               record a cut (upsert by account + date)
  GET  /api/cuts?account_id=   the user's cuts, newest first

Base of the Corte en Cero ritual: `streak()` counts consecutive $0 cuts.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from api_tokens import audit_summary, require_scope
from database import request_session
from models import Account, CutHistory

router = APIRouter(prefix="/api", tags=["cuts"])


class CutIn(BaseModel):
    account_id: int
    cut_date: date
    reported_balance: Decimal = PField(ge=0, max_digits=14, decimal_places=2)
    source: Literal["operador-ia", "manual"] = "manual"


def _out(c: CutHistory) -> dict:
    return {"id": c.id, "account_id": c.account_id, "cut_date": c.cut_date.isoformat(),
            "reported_balance": float(c.reported_balance), "was_zero": c.was_zero, "source": c.source}


def streak(session, user_id: str) -> Optional[int]:
    """Consecutive $0 cuts going back from the user's most recent cut (all their
    cards, chronological). None when there is no cut at all."""
    cuts = session.exec(select(CutHistory).where(CutHistory.user_id == user_id)
                        .order_by(CutHistory.cut_date.desc(), CutHistory.id.desc())).all()
    if not cuts:
        return None
    n = 0
    for c in cuts:
        if not c.was_zero:
            break
        n += 1
    return n


def account_streaks(cuts: list[CutHistory]) -> dict[int, int]:
    """Per account: consecutive $0 cuts from its latest cut backwards."""
    out: dict[int, int] = {}
    done: set[int] = set()
    for c in sorted(cuts, key=lambda c: (c.cut_date, c.id or 0), reverse=True):
        if c.account_id in done:
            continue
        if c.was_zero:
            out[c.account_id] = out.get(c.account_id, 0) + 1
        else:
            out.setdefault(c.account_id, 0)
            done.add(c.account_id)
    return out


@router.post("/cuts")
async def record_cut(body: CutIn, user_id: str = Depends(require_scope("write:accounts"))):
    with request_session() as session:
        acc = session.exec(select(Account).where(Account.id == body.account_id, Account.user_id == user_id)).first()
        if not acc:
            raise HTTPException(status_code=404, detail="Account not found")
        if acc.type != "debt":
            raise HTTPException(status_code=422, detail="Cuts are only recorded for debts")
        cut = session.exec(select(CutHistory).where(CutHistory.account_id == acc.id,
                                                    CutHistory.cut_date == body.cut_date)).first()
        created = cut is None
        if created:
            cut = CutHistory(user_id=user_id, account_id=acc.id, cut_date=body.cut_date)
        cut.reported_balance = body.reported_balance
        cut.was_zero = body.reported_balance == 0
        cut.source = body.source
        session.add(cut)
        session.commit()
        session.refresh(cut)
        audit_summary(f"Corte de {acc.name} el {body.cut_date.isoformat()}: "
                      + ("$0" if cut.was_zero else "saldo reportado") + ("" if created else " (actualizado)"))
        return {**_out(cut), "created": created}


@router.get("/cuts")
async def list_cuts(account_id: Optional[int] = None, user_id: str = Depends(require_scope("read:accounts"))):
    with request_session() as session:
        q = select(CutHistory).where(CutHistory.user_id == user_id)
        if account_id is not None:
            q = q.where(CutHistory.account_id == account_id)
        cuts = session.exec(q.order_by(CutHistory.cut_date.desc(), CutHistory.id.desc())).all()
        streaks = account_streaks(cuts)
        return {"cuts": [_out(c) for c in cuts], "streaks": {str(k): v for k, v in streaks.items()}}
