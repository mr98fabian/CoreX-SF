"""
POST /api/codes/redeem — session only (get_current_user_id already rejects kx_ API
tokens). Rate limited 5/min per IP and per session; errors are generic so the
endpoint never reveals whether a code exists.
"""
import hashlib
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field as PField
from slowapi import Limiter
from slowapi.util import get_remote_address

from access_codes import CodesDisabled, RedeemError, redeem
from auth import DEMO_USER_ID, get_current_user_id
from database import request_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/codes", tags=["codes"])
limiter = Limiter(key_func=get_remote_address)

GENERIC = "Invalid or unavailable code."


def _session_key(request: Request) -> str:
    """Per-user bucket without decoding the JWT here: a hash of the bearer token."""
    auth = request.headers.get("authorization", "")
    return "s:" + hashlib.sha256(auth.encode("utf-8")).hexdigest()[:32]


class RedeemRequest(BaseModel):
    code: str = PField(min_length=1, max_length=64)


@router.post("/redeem")
@limiter.limit("5/minute")
@limiter.limit("5/minute", key_func=_session_key)
def redeem_code(request: Request, body: RedeemRequest, user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=403, detail="Demo accounts can't redeem codes")
    try:
        with request_session() as session:
            grant = redeem(session, body.code, user_id)
    except CodesDisabled:
        raise HTTPException(status_code=503, detail="Codes are not available right now.")
    except RedeemError:
        raise HTTPException(status_code=400, detail=GENERIC)
    logger.info("Access code redeemed: user=%s code_id=%s plan=%s", user_id, grant.code_id, grant.plan)
    return {"plan": grant.plan, "permanent": grant.ends_at is None,
            "starts_at": grant.starts_at.isoformat() + "Z",
            "ends_at": grant.ends_at.isoformat() + "Z" if grant.ends_at else None}
