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
import re
from contextvars import ContextVar
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

import database
from database import request_session
from auth import API_TOKEN_PREFIX, get_current_user_id
from models import ApiToken, ApiTokenAudit
from plan_guard import ai_access_for

SCOPES = {
    "read:accounts": "Ver mis cuentas",
    "read:dashboard": "Ver mi panel y ajustes",
    "read:plan": "Ver mi plan de acción",
    "write:payments": "Registrar pagos",
    "write:accounts": "Agregar cuentas",
    "run:simulations": "Simular compras",
}
RATE_LIMIT_PER_MIN = 60

# What an AI write changed (perf/actividad-detalle 2026-11-05). require_scope
# installs a holder for kx_ requests; the handler fills it with audit_summary();
# require_scope writes ONE audit row per request with it. With a normal session
# there is no holder and audit_summary() does nothing (the audit is AI-only).
_audit_holder: ContextVar = ContextVar("kx_audit_holder", default=None)
NOTE_MAX = 140
SUMMARY_MAX = 300
_CTRL = re.compile(r"[\x00-\x1f\x7f<>]")


def audit_summary(text: str) -> None:
    """Record what this write changed (plain words; no emails or UUIDs)."""
    holder = _audit_holder.get()
    if holder is not None and text:
        holder["summary"] = text[:SUMMARY_MAX]


def sanitize_note(raw: Optional[str]) -> Optional[str]:
    """X-Korex-Note: the AI's short reason. HTTP headers are ASCII, so non-ASCII
    text travels percent-encoded (UTF-8) and is decoded here. Control chars and
    angle brackets stripped, whitespace collapsed, ≤ 140 characters; empty → None."""
    if not raw:
        return None
    from urllib.parse import unquote
    clean = " ".join(_CTRL.sub(" ", unquote(raw)).split())[:NOTE_MAX].strip()
    return clean or None
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
    with request_session() as session:
        row = session.exec(select(ApiToken).where(ApiToken.token_hash == hash_token(raw))).first()
        if not row or row.revoked_at is not None:
            raise HTTPException(status_code=401, detail="Invalid or revoked API token")
        if scope not in (row.scopes or []):
            raise HTTPException(status_code=403, detail=f"Token lacks scope {scope}")
        # Checked on every request, not only at creation: a cancelled/expired plan
        # stops existing tokens on the very next call (and a webhook upgrade revives them)
        if not ai_access_for(session, row.user_id)[0]:
            raise HTTPException(status_code=403, detail="AI connection requires a paid plan")
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
            holder = {"summary": None}
            ctx = _audit_holder.set(holder)
            try:
                yield token.user_id
                if scope.startswith("write:"):  # reached only if the endpoint didn't raise
                    with request_session() as session:
                        session.add(ApiTokenAudit(token_id=token.id, user_id=token.user_id,
                                                  action=f"{request.method} {request.url.path}", detail=scope,
                                                  summary=holder["summary"], note=sanitize_note(request.headers.get("X-Korex-Note"))))
                        session.commit()
            finally:
                try:
                    _audit_holder.reset(ctx)
                except ValueError:
                    pass
        else:
            # Called directly (not via Depends), so honour test overrides explicitly
            auth_fn = request.app.dependency_overrides.get(get_current_user_id, get_current_user_id)
            uid = await auth_fn(authorization) if auth_fn is get_current_user_id else auth_fn()
            request.state.auth_user_id = uid
            yield uid

    return dependency

