"""
Sync Router — when the user's bank data syncs (Plaid publishes in batches,
1–4 times a day) and when it last did. Today the sync is operated by the
user's AI, which calls POST /mark after each run.

The explanation is built HERE from stored data: a sync time is only stated
if one was recorded. Open to the app session and to kx_ tokens.
"""
from datetime import datetime, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import select

from database import request_session
from api_tokens import require_scope, audit_summary
from models import SyncState

router = APIRouter(prefix="/api/sync", tags=["sync"])

CADENCE = {"min": 1, "max": 4}
WINDOWS = [{"label": "Tanda de la mañana", "time": "07:00"},
           {"label": "Tanda de la tarde", "time": "17:15"}]
MONTHS = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
          "agosto", "septiembre", "octubre", "noviembre", "diciembre")
BASE_ES = ("Tus datos bancarios se sincronizan en tandas: tu banco publica movimientos "
           "de 1 a 4 veces al día y KoreX los recoge a las 07:00 y a las 17:15.")


class MarkBody(BaseModel):
    source: Literal["operador-ia", "automatica"] = "operador-ia"


def _zone(tz: Optional[str]):
    try:
        return ZoneInfo(tz) if tz else timezone.utc
    except Exception:
        return timezone.utc


def human_es(when_utc: datetime, tz: Optional[str] = None) -> str:
    """'6 de noviembre de 2026, 07:02 (UTC)' — the zone is always named."""
    zone = _zone(tz)
    local = when_utc.replace(tzinfo=timezone.utc).astimezone(zone)
    name = "UTC" if zone is timezone.utc else tz
    return f"{local.day} de {MONTHS[local.month - 1]} de {local.year}, {local:%H:%M} ({name})"


def explanation_es(last: Optional[datetime], tz: Optional[str] = None) -> str:
    if last is None:
        return f"{BASE_ES} Todavía no se registra una primera sincronización."
    return f"{BASE_ES} Última sincronización: {human_es(last, tz)}."


def _status(user_id: str, tz: Optional[str]) -> dict:
    with request_session() as s:
        row = s.exec(select(SyncState).where(SyncState.user_id == user_id)).first()
        last = row.last_sync_at if row else None
        source = row.last_source if row else None
    return {
        "provider": "plaid",
        "mode": "operada_por_ia",
        "cadence": CADENCE,
        "windows": WINDOWS,
        "last_sync_at": last.replace(tzinfo=timezone.utc).isoformat() if last else None,
        "last_source": source,
        "explanation_es": explanation_es(last, tz),
    }


@router.get("/status")
def sync_status(tz: Optional[str] = Query(None, max_length=64),
                user_id: str = Depends(require_scope("read:dashboard"))):
    return _status(user_id, tz)


@router.post("/mark")
def sync_mark(body: MarkBody, tz: Optional[str] = Query(None, max_length=64),
              user_id: str = Depends(require_scope("write:accounts"))):
    source = body.source
    now = datetime.utcnow()
    with request_session() as s:
        row = s.exec(select(SyncState).where(SyncState.user_id == user_id)).first() or SyncState(user_id=user_id)
        row.last_sync_at, row.last_source = now, source
        s.add(row)
        s.commit()
    audit_summary(f"Sincronización registrada · {source}")
    return _status(user_id, tz)
