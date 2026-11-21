"""
KoreX's own OAuth 2.1 authorization server, for the remote MCP (mcp_remote.py).

A thin issuing layer over api_tokens: the access token IS an ApiToken row (source='oauth'),
so it inherits sha256 storage, revocation, the 60/min rate limit, the write audit and the
paid-plan check on every request. Nothing here grants more than the Kit IA scopes:
write:payments is unreachable (asking for it = invalid_scope).

  GET  /.well-known/oauth-protected-resource[/mcp]   RFC 9728
  GET  /.well-known/oauth-authorization-server       RFC 8414
  POST /oauth/register                                RFC 7591 (public clients, no user)
  GET  /oauth/authorize                               PKCE S256 only → consent in the SPA
  POST /api/oauth/consent/{details,approve,deny}      KoreX session (the SPA holds it)
  POST /oauth/token                                   authorization_code | refresh_token (rotation + reuse detection)
  POST /oauth/revoke                                  RFC 7009

Fail-closed: without MCP_REMOTE_ENABLED every endpoint answers 503. Codes, handles and
tokens are opaque, stored as sha256 only, never logged, never accepted in a query string.
"""
import base64, hashlib, logging, os, re, secrets, uuid
from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import select

from api_tokens import SCOPES, generate_token, hash_token
from auth import DEMO_USER_ID, get_current_user_id
from database import request_session
from models import ApiToken, OAuthClient, OAuthCode, OAuthRefreshToken
from plan_guard import ai_access_for

logger = logging.getLogger("korex.oauth")
router = APIRouter(tags=["oauth"])
limiter = Limiter(key_func=get_remote_address)

DEFAULT_ISSUER = "https://corex-sf-production.up.railway.app"
# The only scopes OAuth can ever grant = frontend lib/aiKit.ts KIT_TOKEN_SCOPES (guard test keeps them equal).
KIT_SCOPES = ["read:accounts", "read:dashboard", "read:plan", "run:simulations", "write:accounts"]
ACCESS_TTL = timedelta(hours=1)
REFRESH_TTL = timedelta(days=60)
SHORT_TTL = timedelta(minutes=10)  # consent handle and authorization code
MAX_ACTIVE_TOKENS = 10  # same cap as routers/tokens.py: OAuth connections count in it
_PKCE = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")
_LOOPBACK = {"localhost", "127.0.0.1", "[::1]", "::1"}


def enabled() -> bool:
    return os.getenv("MCP_REMOTE_ENABLED", "").strip().lower() in ("1", "true", "yes", "on")


def issuer() -> str:
    return (os.getenv("OAUTH_ISSUER_URL", "").strip() or DEFAULT_ISSUER).rstrip("/")


def mcp_url() -> str:
    return f"{issuer()}/mcp"


def frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "https://korexf.com").rstrip("/")


def _off() -> JSONResponse:
    return JSONResponse(status_code=503, content={"error": "temporarily_unavailable",
                                                  "error_description": "Connecting by link isn't available yet."})


def _err(code: str, description: str, status: int = 400) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "error_description": description},
                        headers={"Cache-Control": "no-store", "Pragma": "no-cache"})


def _now() -> datetime:
    return datetime.utcnow()


def _with_query(url: str, params: dict) -> str:
    clean = {k: v for k, v in params.items() if v is not None}
    return f"{url}{'&' if urlparse(url).query else '?'}{urlencode(clean)}"


# ── Discovery ────────────────────────────────────────────────────────────────────────

def _resource_metadata() -> dict:
    return {"resource": mcp_url(), "authorization_servers": [issuer()], "scopes_supported": KIT_SCOPES,
            "bearer_methods_supported": ["header"], "resource_name": "KoreX"}


@router.get("/.well-known/oauth-protected-resource")
def protected_resource():
    return _resource_metadata() if enabled() else _off()


@router.get("/.well-known/oauth-protected-resource/mcp")
def protected_resource_mcp():  # the path-inserted form (RFC 9728 §3.1) the MCP 401 points to
    return _resource_metadata() if enabled() else _off()


@router.get("/.well-known/oauth-authorization-server")
def authorization_server():
    if not enabled():
        return _off()
    base = issuer()
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "revocation_endpoint": f"{base}/oauth/revoke",
        "scopes_supported": KIT_SCOPES,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_basic"],
        "revocation_endpoint_auth_methods_supported": ["none", "client_secret_basic"],
        "authorization_response_iss_parameter_supported": True,
    }


# ── Dynamic client registration (RFC 7591) ───────────────────────────────────────────

def _valid_redirect(uri: str) -> bool:
    try:
        p = urlparse(uri)
    except ValueError:
        return False
    if p.fragment or not p.netloc:
        return False
    if p.scheme == "https":
        return True
    return p.scheme == "http" and (p.hostname or "") in _LOOPBACK  # native clients (RFC 8252)


@router.post("/oauth/register", status_code=201)
@limiter.limit("10/minute")
async def register_client(request: Request):
    if not enabled():
        return _off()
    try:
        meta = await request.json()
    except Exception:
        return _err("invalid_client_metadata", "Body must be JSON client metadata.")
    if not isinstance(meta, dict):
        return _err("invalid_client_metadata", "Body must be a JSON object.")
    uris = meta.get("redirect_uris")
    if not isinstance(uris, list) or not uris or not all(isinstance(u, str) for u in uris):
        return _err("invalid_redirect_uri", "redirect_uris is required.")
    if not all(_valid_redirect(u) for u in uris):
        return _err("invalid_redirect_uri", "Redirect URIs must be https, or http on localhost.")
    grants = meta.get("grant_types") or ["authorization_code", "refresh_token"]
    if not isinstance(grants, list) or not set(grants) <= {"authorization_code", "refresh_token"}:
        return _err("invalid_client_metadata", "Only authorization_code and refresh_token are supported.")
    responses = meta.get("response_types") or ["code"]
    if not isinstance(responses, list) or set(responses) != {"code"}:
        return _err("invalid_client_metadata", "Only response_type code is supported.")
    method = meta.get("token_endpoint_auth_method") or "none"
    if method not in ("none", "client_secret_basic"):
        return _err("invalid_client_metadata", "token_endpoint_auth_method must be none or client_secret_basic.")
    scope = meta.get("scope")
    if scope is not None and (not isinstance(scope, str) or not set(scope.split()) <= set(KIT_SCOPES)):
        return _err("invalid_client_metadata", "Requested scopes aren't available.")
    name = str(meta.get("client_name") or "Tu asistente").strip()[:60] or "Tu asistente"

    client_id = "kxc_" + secrets.token_urlsafe(16)
    secret = secrets.token_urlsafe(32) if method == "client_secret_basic" else None
    stored = {"redirect_uris": uris, "grant_types": grants, "response_types": ["code"],
              "token_endpoint_auth_method": method, "client_name": name}
    if scope:
        stored["scope"] = scope
    with request_session() as s:
        s.add(OAuthClient(client_id=client_id, client_name=name, client_metadata=stored,
                          secret_hash=hash_token(secret) if secret else None))
        s.commit()
    logger.info(f"OAuth client registered: {name}")
    body = {"client_id": client_id, "client_id_issued_at": int(_now().timestamp()), **stored}
    if secret:
        body["client_secret"] = secret  # shown once, stored hashed
        body["client_secret_expires_at"] = 0
    return JSONResponse(status_code=201, content=body, headers={"Cache-Control": "no-store"})


def _client(client_id: Optional[str]) -> Optional[OAuthClient]:
    if not client_id:
        return None
    with request_session() as s:
        row = s.exec(select(OAuthClient).where(OAuthClient.client_id == client_id)).first()
        if row:
            s.expunge(row)
        return row


# ── Authorize → consent handle ───────────────────────────────────────────────────────

@router.get("/oauth/authorize")
@limiter.limit("30/minute")
def authorize(request: Request, client_id: Optional[str] = None, redirect_uri: Optional[str] = None,
              response_type: Optional[str] = None, code_challenge: Optional[str] = None,
              code_challenge_method: Optional[str] = None, scope: Optional[str] = None,
              state: Optional[str] = None, resource: Optional[str] = None):
    if not enabled():
        return _off()
    client = _client(client_id)
    if client is None:  # never redirect to an unverified place
        return _err("invalid_client", "Unknown client_id.")
    registered = client.client_metadata.get("redirect_uris") or []
    if redirect_uri is None and len(registered) == 1:
        redirect_uri = registered[0]
    if redirect_uri not in registered:  # exact match only
        return _err("invalid_request", "redirect_uri doesn't match a registered one.")

    def back(error: str, description: str):
        return RedirectResponse(_with_query(redirect_uri, {"error": error, "error_description": description,
                                                           "state": state, "iss": issuer()}), status_code=302)

    if response_type != "code":
        return back("unsupported_response_type", "Only response_type=code is supported.")
    if not code_challenge or code_challenge_method != "S256" or not _PKCE.match(code_challenge):
        return back("invalid_request", "PKCE with code_challenge_method=S256 is required.")
    requested = scope.split() if scope and scope.strip() else list(KIT_SCOPES)
    if not set(requested) <= set(KIT_SCOPES):
        return back("invalid_scope", "Only the Kit IA scopes can be granted; payments never.")
    if resource is not None and resource.rstrip("/") != mcp_url():
        return back("invalid_target", "Unknown resource.")

    handle = secrets.token_urlsafe(32)
    with request_session() as s:
        s.add(OAuthCode(kind="request", token_hash=hash_token(handle), client_id=client.client_id,
                        redirect_uri=redirect_uri, code_challenge=code_challenge,
                        scopes=sorted(set(requested), key=KIT_SCOPES.index), state=state,
                        resource=mcp_url(), expires_at=_now() + SHORT_TTL))
        s.commit()
    return RedirectResponse(f"{frontend_url()}/oauth/consent?{urlencode({'request': handle})}", status_code=302)


class ConsentBody(BaseModel):
    request: str


def _pending(handle: str, user_id: str, s) -> OAuthCode:
    row = s.exec(select(OAuthCode).where(OAuthCode.token_hash == hash_token(handle), OAuthCode.kind == "request")).first()
    if row is None or row.used_at is not None or row.expires_at <= _now():
        raise HTTPException(status_code=404, detail="This connection request expired. Start again from your assistant.")
    if row.user_id is not None and row.user_id != user_id:
        raise HTTPException(status_code=404, detail="This connection request expired. Start again from your assistant.")
    return row


def _access(s, user_id: str) -> Optional[str]:
    """None = may connect; else the reason the consent screen shows."""
    if user_id == DEMO_USER_ID:
        return "demo"
    return None if ai_access_for(s, user_id)[0] else "free_plan"


@router.post("/api/oauth/consent/details")
def consent_details(body: ConsentBody, user_id: str = Depends(get_current_user_id)):
    if not enabled():
        return _off()
    with request_session() as s:
        row = _pending(body.request, user_id, s)
        if row.user_id is None:  # the first signed-in viewer owns the request
            row.user_id = user_id
            s.add(row)
            s.commit()
            s.refresh(row)
        client = s.exec(select(OAuthClient).where(OAuthClient.client_id == row.client_id)).first()
        return {"client_name": client.client_name if client else "Tu asistente",
                "redirect_host": urlparse(row.redirect_uri).hostname,
                "scopes": [{"scope": sc, "label": SCOPES[sc]} for sc in row.scopes],
                "blocked": _access(s, user_id)}


@router.post("/api/oauth/consent/approve")
def consent_approve(body: ConsentBody, user_id: str = Depends(get_current_user_id)):
    if not enabled():
        return _off()
    with request_session() as s:
        row = _pending(body.request, user_id, s)
        blocked = _access(s, user_id)
        if blocked:
            raise HTTPException(status_code=403, detail="AI connection requires a paid plan" if blocked == "free_plan"
                                else "Demo accounts can't connect an AI")
        active = s.exec(select(ApiToken).where(ApiToken.user_id == user_id, ApiToken.revoked_at == None)).all()  # noqa: E711
        if len(active) >= MAX_ACTIVE_TOKENS:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_ACTIVE_TOKENS} active connections. Revoke one in Ajustes → Conecta tu IA.")
        if not set(row.scopes) <= set(KIT_SCOPES):  # defence in depth: never payments
            raise HTTPException(status_code=400, detail="invalid_scope")
        row.used_at = _now()
        code = "kxa_" + secrets.token_urlsafe(32)
        s.add(row)
        s.add(OAuthCode(kind="code", token_hash=hash_token(code), client_id=row.client_id, user_id=user_id,
                        redirect_uri=row.redirect_uri, code_challenge=row.code_challenge, scopes=row.scopes,
                        state=row.state, resource=row.resource, expires_at=_now() + SHORT_TTL))
        s.commit()
        return {"redirect_to": _with_query(row.redirect_uri, {"code": code, "state": row.state, "iss": issuer()})}


@router.post("/api/oauth/consent/deny")
def consent_deny(body: ConsentBody, user_id: str = Depends(get_current_user_id)):
    if not enabled():
        return _off()
    with request_session() as s:
        row = _pending(body.request, user_id, s)
        row.used_at = _now()
        s.add(row)
        s.commit()
        return {"redirect_to": _with_query(row.redirect_uri, {"error": "access_denied", "state": row.state, "iss": issuer()})}


# ── Token endpoint ───────────────────────────────────────────────────────────────────

def _basic(request: Request) -> tuple[Optional[str], Optional[str]]:
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("basic "):
        return None, None
    try:
        raw = base64.b64decode(auth[6:]).decode("utf-8")
    except Exception:
        return None, None
    cid, _, secret = raw.partition(":")
    from urllib.parse import unquote
    return unquote(cid), unquote(secret)


def _authenticate_client(request: Request, form_client_id: Optional[str]) -> tuple[Optional[OAuthClient], Optional[JSONResponse]]:
    basic_id, basic_secret = _basic(request)
    client = _client(basic_id or form_client_id)
    if client is None:
        return None, _err("invalid_client", "Unknown client.", 401)
    if client.secret_hash:
        if not basic_secret or not secrets.compare_digest(hash_token(basic_secret), client.secret_hash):
            return None, _err("invalid_client", "Client authentication failed.", 401)
    return client, None


def _pkce_ok(verifier: Optional[str], challenge: str) -> bool:
    if not verifier or not _PKCE.match(verifier):
        return False
    digest = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")
    return secrets.compare_digest(digest, challenge)


def _revoke_family(s, family_id: Optional[str], api_token_id: Optional[int]) -> None:
    now = _now()
    if family_id:
        for r in s.exec(select(OAuthRefreshToken).where(OAuthRefreshToken.family_id == family_id)).all():
            if r.revoked_at is None:
                r.revoked_at = now
                s.add(r)
    if api_token_id:
        tok = s.get(ApiToken, api_token_id)
        if tok and tok.revoked_at is None:
            tok.revoked_at = now
            s.add(tok)
    s.commit()


def _issue(s, client: OAuthClient, user_id: str, scopes: List[str], api_token: Optional[ApiToken], family_id: str,
           previous: Optional[OAuthRefreshToken] = None) -> dict:
    access = generate_token()
    if api_token is None:  # the consent's credential: an ApiToken like any other (Ajustes lists and revokes it)
        api_token = ApiToken(user_id=user_id, name=client.client_name, token_hash=hash_token(access),
                             scopes=list(scopes), source="oauth", expires_at=_now() + ACCESS_TTL)
    else:  # rotation: same row, new secret; the old access token dies now
        api_token.token_hash = hash_token(access)
        api_token.expires_at = _now() + ACCESS_TTL
    s.add(api_token)
    s.commit()
    s.refresh(api_token)
    refresh = "kxr_" + secrets.token_urlsafe(32)
    new = OAuthRefreshToken(token_hash=hash_token(refresh), client_id=client.client_id, user_id=user_id,
                            api_token_id=api_token.id, family_id=family_id, scopes=list(scopes),
                            expires_at=_now() + REFRESH_TTL)
    s.add(new)
    s.commit()
    s.refresh(new)
    if previous is not None:
        previous.replaced_by_id = new.id
        s.add(previous)
        s.commit()
    return {"access_token": access, "token_type": "Bearer", "expires_in": int(ACCESS_TTL.total_seconds()),
            "scope": " ".join(scopes), "refresh_token": refresh}


def _tokens(body: dict) -> JSONResponse:
    return JSONResponse(content=body, headers={"Cache-Control": "no-store", "Pragma": "no-cache"})


@router.post("/oauth/token")
@limiter.limit("60/minute")
def token(request: Request, grant_type: Optional[str] = Form(None), code: Optional[str] = Form(None),
          redirect_uri: Optional[str] = Form(None), code_verifier: Optional[str] = Form(None),
          client_id: Optional[str] = Form(None), refresh_token: Optional[str] = Form(None),
          scope: Optional[str] = Form(None), resource: Optional[str] = Form(None)):
    if not enabled():
        return _off()
    client, failure = _authenticate_client(request, client_id)
    if failure:
        return failure
    if resource is not None and resource.rstrip("/") != mcp_url():
        return _err("invalid_target", "Unknown resource.")

    if grant_type == "authorization_code":
        with request_session() as s:
            row = s.exec(select(OAuthCode).where(OAuthCode.token_hash == hash_token(code or ""), OAuthCode.kind == "code")).first()
            if row is None or row.used_at is not None or row.expires_at <= _now():
                return _err("invalid_grant", "The authorization code is invalid, used or expired.")
            # one use: burnt before anything is issued, whatever happens next
            row.used_at = _now()
            s.add(row)
            s.commit()
            if row.client_id != client.client_id or redirect_uri != row.redirect_uri:
                return _err("invalid_grant", "Code was issued to another client or redirect_uri.")
            if not _pkce_ok(code_verifier, row.code_challenge):
                return _err("invalid_grant", "PKCE verification failed.")
            if not set(row.scopes) <= set(KIT_SCOPES):
                return _err("invalid_scope", "Scope not grantable.")
            if _access(s, row.user_id):
                return _err("invalid_grant", "AI connection requires a paid plan.")
            return _tokens(_issue(s, client, row.user_id, row.scopes, None, uuid.uuid4().hex))

    if grant_type == "refresh_token":
        with request_session() as s:
            old = s.exec(select(OAuthRefreshToken).where(OAuthRefreshToken.token_hash == hash_token(refresh_token or ""))).first()
            if old is None or old.client_id != client.client_id:
                return _err("invalid_grant", "Invalid refresh token.")
            if old.revoked_at is not None or old.replaced_by_id is not None:
                # a rotated/revoked refresh came back: assume theft, kill the whole consent
                logger.warning("OAuth refresh token reuse detected; family revoked")
                _revoke_family(s, old.family_id, old.api_token_id)
                return _err("invalid_grant", "Refresh token was already used.")
            if old.expires_at <= _now():
                return _err("invalid_grant", "Refresh token expired.")
            api_token = s.get(ApiToken, old.api_token_id)
            if api_token is None or api_token.revoked_at is not None:
                _revoke_family(s, old.family_id, None)
                return _err("invalid_grant", "This connection was revoked.")
            if _access(s, old.user_id):
                return _err("invalid_grant", "AI connection requires a paid plan.")
            scopes = old.scopes
            if scope and scope.strip():
                narrowed = scope.split()
                if not set(narrowed) <= set(old.scopes):
                    return _err("invalid_scope", "Can't widen scopes on refresh.")
                scopes = [sc for sc in old.scopes if sc in narrowed]
                api_token.scopes = scopes
            return _tokens(_issue(s, client, old.user_id, scopes, api_token, old.family_id, previous=old))

    return _err("unsupported_grant_type", "Use authorization_code or refresh_token.")


@router.post("/oauth/revoke")
@limiter.limit("60/minute")
def revoke(request: Request, token: Optional[str] = Form(None), token_type_hint: Optional[str] = Form(None),
           client_id: Optional[str] = Form(None)):
    if not enabled():
        return _off()
    if token:
        with request_session() as s:
            h = hash_token(token)
            access = s.exec(select(ApiToken).where(ApiToken.token_hash == h)).first()
            if access is not None:
                fam = s.exec(select(OAuthRefreshToken).where(OAuthRefreshToken.api_token_id == access.id)).first()
                _revoke_family(s, fam.family_id if fam else None, access.id)
            else:
                ref = s.exec(select(OAuthRefreshToken).where(OAuthRefreshToken.token_hash == h)).first()
                if ref is not None:
                    _revoke_family(s, ref.family_id, ref.api_token_id)
    return JSONResponse(status_code=200, content={}, headers={"Cache-Control": "no-store"})
