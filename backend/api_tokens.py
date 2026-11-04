"""
Personal API tokens — how an AI agent (MCP server) acts on ONE user's KoreX.

Security model
- Format: "kx_" + 43 url-safe chars (256 bits). Only sha256(token) is stored;
  the plain token is returned once by POST /api/tokens and never logged.
- The user_id ALWAYS comes from the token row, never from the request.
- Default deny: get_current_user_id rejects kx_ tokens, so a token only works
  on endpoints that explicitly opt in with Depends(require_scope("...")).
- Missing scope → 403. Unknown or revoked token → 401.
- Rate limit: RATE_LIMIT_PER_MIN requests per token per rolling minute → 429.
  In-memory and per process (Railway runs a single instance); good enough as
  a basic abuse brake, not a billing-grade quota.
- Every request that uses a write:* scope with a token is recorded in
  api_token_audit after it succeeds (token, user, action, date).
"""
import hashlib
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

import database
from auth import API_TOKEN_PREFIX, get_current_user_id
from models import ApiToken, ApiTokenAudit

SCOPES = {
    "read:accounts": "Ver mis cuentas",
    "read:dashboard": "Ver mi panel y ajustes",
    "read:plan": "Ver mi plan de acción",
    "write:payments": "Registrar pagos",
    "write:accounts": "Agregar cuentas",
    "run:simulations": "Simular compras",
}
RATE_LIMIT_PER_MIN = 60
_hits: dict[int, deque] = defaultdict(deque)


def generate_token() -> str:
    return API_TOKEN_PREFIX + secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _rate_limited(token_id: int) -> bool:
    now = time.monotonic()
    window = _hits[token_id]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= RATE_LIMIT_PER_MIN:
        return True
    window.append(now)
    return False


def _authenticate_token(raw: str, scope: str) -> ApiToken:
    with Session(database.engine) as session:
        row = session.exec(select(ApiToken).where(ApiToken.token_hash == hash_token(raw))).first()
        if not row or row.revoked_at is not None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API token")
        if scope not in (row.scopes or []):
            raise HTTPException(status_code=403, detail=f"Token lacks scope {scope}")
        if _rate_limited(row.id):
            raise HTTPException(status_code=429, detail="Rate limit exceeded (60 requests/minute)")
        row.last_used_at = datetime.utcnow()
        session.add(row)
        session.commit()
        session.refresh(row)
        session.expunge(row)
        return row


def require_scope(scope: str):
    """Auth dependency for endpoints open to API tokens: accepts the app's
    normal session (JWT/demo) or a kx_ token carrying `scope`."""
    if scope not in SCOPES:
        raise ValueError(f"Unknown scope {scope}")

    async def dependency(request: Request, authorization: Optional[str] = Header(None)):
        raw = (authorization or "").removeprefix("Bearer ").strip()
        if raw.startswith(API_TOKEN_PREFIX):
            token = _authenticate_token(raw, scope)
            request.state.auth_user_id = token.user_id
            yield token.user_id
            if scope.startswith("write:"):  # reached only if the endpoint didn't raise
                with Session(database.engine) as session:
                    session.add(ApiTokenAudit(token_id=token.id, user_id=token.user_id,
                                              action=f"{request.method} {request.url.path}", detail=scope))
                    session.commit()
        else:
            # Called directly (not via Depends), so honour test overrides explicitly
            auth_fn = request.app.dependency_overrides.get(get_current_user_id, get_current_user_id)
            uid = await auth_fn(authorization) if auth_fn is get_current_user_id else auth_fn()
            request.state.auth_user_id = uid
            yield uid

    return dependency

