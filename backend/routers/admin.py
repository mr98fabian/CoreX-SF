"""
Owner-only code administration. The owner is OWNER_USER_ID (Supabase uid) from the
environment — no roles table. Without the variable nobody is owner. Every action is logged.
"""
import logging
import os
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import select

from access_codes import CodesDisabled, code_status, create_code
from auth import get_current_user_id
from database import request_session
from models import AccessCode

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_owner(user_id: str = Depends(get_current_user_id)) -> str:
    owner = os.getenv("OWNER_USER_ID", "").strip()
    if not owner or user_id != owner:
        raise HTTPException(status_code=403, detail="Forbidden")
    return user_id


class CreateCode(BaseModel):
    kind: Literal["founder", "months"]
    months: Optional[int] = PField(default=None, ge=1, le=36)
    max_uses: int = PField(default=1, ge=1, le=100)
    expires_at: Optional[datetime] = None


def _public(row: AccessCode) -> dict:
    return {"id": row.id, "prefix": row.prefix, "kind": row.kind, "months": row.months, "plan": row.plan,
            "max_uses": row.max_uses, "uses_count": row.uses_count, "status": code_status(row),
            "expires_at": row.expires_at.isoformat() + "Z" if row.expires_at else None,
            "created_at": row.created_at.isoformat() + "Z" if row.created_at else None}


@router.post("/codes")
def create(body: CreateCode, owner: str = Depends(require_owner)):
    if body.kind == "months" and not body.months:
        raise HTTPException(status_code=422, detail="months is required for a gift code")
    expires = body.expires_at.replace(tzinfo=None) if body.expires_at else None
    try:
        with request_session() as session:
            row, plain = create_code(session, kind=body.kind, created_by=owner, months=body.months,
                                     max_uses=body.max_uses, expires_at=expires)
            out = _public(row)
    except CodesDisabled:
        raise HTTPException(status_code=503, detail="ACCESS_CODE_HMAC_KEY is not configured")
    logger.info("Access code created: id=%s kind=%s by owner", out["id"], body.kind)
    return {**out, "code": plain}  # the only time the plain code ever leaves the server


@router.get("/codes")
def list_codes(owner: str = Depends(require_owner)):
    with request_session() as session:
        rows = session.exec(select(AccessCode).order_by(AccessCode.created_at.desc())).all()
        return [_public(r) for r in rows]


@router.post("/codes/{code_id}/revoke")
def revoke(code_id: int, owner: str = Depends(require_owner)):
    with request_session() as session:
        row = session.get(AccessCode, code_id)
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        if not row.revoked_at:
            row.revoked_at = datetime.utcnow()
            session.add(row)
            session.commit()
            session.refresh(row)
        logger.info("Access code revoked: id=%s", code_id)
        return _public(row)
