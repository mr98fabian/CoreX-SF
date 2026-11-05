"""
KoreX Financial System — Authentication Dependency
Extracted from main.py so all routers can import it directly.

Supabase JWTs are verified LOCALLY (perf 2026-11-05): the project signs them
with an asymmetric key (ES256), whose public JWKS is fetched once from
SUPABASE_URL/auth/v1/.well-known/jwks.json and cached (refreshed every 10 min
or on an unknown key id). Signature, expiry and audience are checked in
process — no HTTPS round trip per request.

Fallback (only if a token can't be verified locally, e.g. a legacy HS256 token
and no SUPABASE_JWT_SECRET): ask Supabase /auth/v1/user once with a shared
client and a 5 s timeout, then cache token→user_id for ≤ 60 s and never past
the token's exp. Invalid or expired tokens are never cached.

Trade-off: a locally verified token stays valid until its exp (Supabase
default ≈ 1 h) even if the session is revoked — the standard Supabase JWT model.
"""
import os
import threading
import time
from typing import Optional

import httpx
import jwt
from fastapi import HTTPException, Header


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")  # only for legacy HS256 projects

# Demo mode constants
DEMO_TOKEN = "demo-stress-test-token"
DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"
# Enabled by default — demo token only accesses a synthetic sandbox account
DEMO_MODE_ENABLED = os.getenv("DEMO_MODE_ENABLED", "true").lower() == "true"

# Personal API tokens (see api_tokens.py) start with this prefix
API_TOKEN_PREFIX = "kx_"

AUDIENCE = "authenticated"
JWKS_TTL_S = 600
JWKS_FORCE_MIN_S = 60  # unknown kids can force a refresh at most once a minute (no fetch-flood)
REMOTE_CACHE_TTL_S = 60
HTTP_TIMEOUT = httpx.Timeout(5.0)

_jwks: dict[str, jwt.PyJWK] = {}
_jwks_at = 0.0
_jwks_lock = threading.Lock()
_remote_cache: dict[str, tuple[str, float]] = {}  # token → (user_id, valid_until)
_http: Optional[httpx.AsyncClient] = None


def _client() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=HTTP_TIMEOUT)
    return _http


def _load_jwks(force: bool = False) -> dict[str, jwt.PyJWK]:
    global _jwks, _jwks_at
    with _jwks_lock:
        age = time.monotonic() - _jwks_at
        if _jwks and (age < JWKS_FORCE_MIN_S or (not force and age < JWKS_TTL_S)):
            return _jwks
        if not SUPABASE_URL:
            return _jwks
        try:
            r = httpx.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", timeout=HTTP_TIMEOUT)
            r.raise_for_status()
            keys = {k["kid"]: jwt.PyJWK(k) for k in r.json().get("keys", []) if k.get("kid")}
            if keys:
                _jwks, _jwks_at = keys, time.monotonic()
        except (httpx.HTTPError, ValueError, KeyError, jwt.PyJWTError):
            pass  # keep the previous keys; the token may still go to the fallback
        return _jwks


def _verify_locally(token: str) -> Optional[str]:
    """user_id if the token verifies locally; None if it can't be checked here
    (unknown alg/key). Raises 401 for expired / bad-signature / malformed."""
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    alg = header.get("alg", "")
    key = None
    if alg in ("ES256", "RS256"):
        kid = header.get("kid")
        key = _load_jwks().get(kid) or _load_jwks(force=True).get(kid)
        if key is None:
            return None
    elif alg == "HS256" and SUPABASE_JWT_SECRET:
        key = SUPABASE_JWT_SECRET
    else:
        return None
    try:
        claims = jwt.decode(token, key, algorithms=[alg], audience=AUDIENCE,
                            options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return claims["sub"]


async def _verify_remotely(token: str) -> str:
    now = time.time()
    hit = _remote_cache.get(token)
    if hit and hit[1] > now:
        return hit[0]
    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")
    try:
        resp = await _client().get(f"{SUPABASE_URL}/auth/v1/user",
                                   headers={"Authorization": f"Bearer {token}", "apikey": SUPABASE_ANON_KEY or token})
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="Auth service unreachable")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    uid = resp.json().get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="No user id in token")
    # Only valid tokens are cached, for ≤ 60 s and never past their own exp
    try:
        exp = float(jwt.decode(token, options={"verify_signature": False}).get("exp", 0))
    except jwt.PyJWTError:
        exp = 0
    until = min(now + REMOTE_CACHE_TTL_S, exp) if exp else now + REMOTE_CACHE_TTL_S
    if until > now:
        if len(_remote_cache) > 10_000:
            _remote_cache.clear()
        _remote_cache[token] = (uid, until)
    return uid


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate user_id from a Supabase JWT (verified locally)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    # Default deny for API tokens: only endpoints using api_tokens.require_scope accept them
    if token.startswith(API_TOKEN_PREFIX):
        raise HTTPException(status_code=403, detail="API tokens are not accepted on this endpoint")

    # -- Demo Mode Bypass (only when explicitly enabled via env var) --
    if DEMO_MODE_ENABLED and token == DEMO_TOKEN:
        return DEMO_USER_ID

    uid = _verify_locally(token)
    return uid if uid else await _verify_remotely(token)
