"""
Tokens Router — create, list and revoke personal API tokens (see api_tokens.py).

Managed only with the app's normal session: a token can never mint or revoke
tokens. The shared demo user can't create them either (its sandbox is public).
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

import database
from api_tokens import SCOPES, generate_token, hash_token
from auth import get_current_user_id, DEMO_USER_ID
from models import ApiToken

router = APIRouter(prefix="/api/tokens", tags=["tokens"])
MAX_ACTIVE_TOKENS = 10


class TokenCreate(BaseModel):
    name: str = PField(min_length=1, max_length=60)
    scopes: List[str] = PField(min_length=1)


def _public(t: ApiToken) -> dict:
    return {
        "id": t.id, "name": t.name, "scopes": t.scopes,
        "created_at": t.created_at, "last_used_at": t.last_used_at, "revoked_at": t.revoked_at,
        "active": t.revoked_at is None,
    }


@router.get("/scopes")
def list_scopes():
    return [{"scope": k, "label": v} for k, v in SCOPES.items()]


@router.post("")
def create_token(body: TokenCreate, user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=403, detail="Demo accounts can't create API tokens")
    unknown = set(body.scopes) - set(SCOPES)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown scopes: {sorted(unknown)}")
    with Session(database.engine) as session:
        active = session.exec(select(ApiToken).where(ApiToken.user_id == user_id, ApiToken.revoked_at == None)).all()  # noqa: E711
        if len(active) >= MAX_ACTIVE_TOKENS:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_ACTIVE_TOKENS} active tokens")
        plain = generate_token()
        row = ApiToken(user_id=user_id, name=body.name.strip(), token_hash=hash_token(plain),
                       scopes=sorted(set(body.scopes)))
        session.add(row)
        session.commit()
        session.refresh(row)
        # The only time the plain token leaves the server
        return {"token": plain, **_public(row)}


@router.get("")
def list_tokens(user_id: str = Depends(get_current_user_id)):
    with Session(database.engine) as session:
        rows = session.exec(select(ApiToken).where(ApiToken.user_id == user_id).order_by(ApiToken.created_at.desc())).all()
        return [_public(t) for t in rows]


@router.delete("/{token_id}")
def revoke_token(token_id: int, user_id: str = Depends(get_current_user_id)):
    with Session(database.engine) as session:
        row = session.exec(select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == user_id)).first()
        if not row:
            raise HTTPException(status_code=404, detail="Token not found")
        if row.revoked_at is None:
            row.revoked_at = datetime.utcnow()
            session.add(row)
            session.commit()
            session.refresh(row)
        return _public(row)
