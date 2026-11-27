"""
POST /api/codes/redeem — session only (get_current_user_id already rejects kx_ API
tokens). Rate limited 5/min per session (rate_limit.py: per user, never per proxy IP); errors are generic so the
endpoint never reveals whether a code exists.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field as PField

from access_codes import CodesDisabled, RedeemError, redeem
from auth import DEMO_USER_ID, get_current_user_id
from database import request_session
from rate_limit import limiter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/codes", tags=["codes"])

GENERIC = "Invalid or unavailable code."


class RedeemRequest(BaseModel):
    code: str = PField(min_length=1, max_length=64)


@router.post("/redeem")
@limiter.limit("5/minute")  # key: the session (rate_limit.rate_limit_key)
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
