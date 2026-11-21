"""
Remote MCP server: the SAME 21 tools and INSTRUCTIONS as the local stdio server
(mcp/korex_mcp.py, the single source), over Streamable HTTP at /mcp, authorized by OAuth
(routers/oauth.py).

- Stateless (FastMCP stateless_http + json_response): every POST is self-contained, no
  sticky sessions, nothing kept in memory between requests.
- The tools are the local server's own Tool objects. Each call runs the original function
  in a worker thread with korex_mcp.REMOTE_SEND set, so its _call() sends the request
  in-process (httpx ASGITransport) to this same API with the Bearer the user authorized.
  Scopes, the paid plan, the 60/min rate limit and the write audit are enforced by the
  EXISTING path (require_scope → _authenticate_token); this layer adds no business logic.
- Before dispatching, the transport verifies the Bearer (sha256 lookup in api_tokens, not
  revoked, not expired). No/invalid token → 401 + WWW-Authenticate pointing to the protected
  resource metadata. A token in the query string never authenticates.
- Fail-closed: without MCP_REMOTE_ENABLED (or without mcp/korex_mcp.py next to backend/,
  i.e. Railway's root directory must be the repo root) /mcp answers 503.
"""
import importlib.util
import logging
import sys
from datetime import timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import anyio
import httpx
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import AnyHttpUrl
from sqlmodel import select
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.routing import Route

from mcp.server.auth.middleware.auth_context import AuthContextMiddleware, get_access_token
from mcp.server.auth.middleware.bearer_auth import BearerAuthBackend, RequireAuthMiddleware
from mcp.server.auth.provider import AccessToken
from mcp.server.auth.routes import build_resource_metadata_url
from mcp.server.fastmcp import FastMCP
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings

from api_tokens import hash_token
from auth import API_TOKEN_PREFIX
from database import request_session
from models import ApiToken
from routers.oauth import enabled, issuer, mcp_url

logger = logging.getLogger("korex.mcp_remote")
MCP_SOURCE = Path(__file__).resolve().parents[1] / "mcp" / "korex_mcp.py"
LOOPBACK_BASE = "http://korex-loopback"


def load_local_server():
    """mcp/korex_mcp.py as a module (it is not a package). None if it isn't deployed."""
    if "korex_mcp" in sys.modules:
        return sys.modules["korex_mcp"]
    if not MCP_SOURCE.exists():
        return None
    spec = importlib.util.spec_from_file_location("korex_mcp", MCP_SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules["korex_mcp"] = module
    spec.loader.exec_module(module)
    return module


class ApiTokenVerifier:
    """The transport's check: the Bearer must be a live ApiToken (OAuth or created by hand)."""

    async def verify_token(self, token: str) -> Optional[AccessToken]:
        if not token.startswith(API_TOKEN_PREFIX):
            return None
        from datetime import datetime
        with request_session() as s:
            row = s.exec(select(ApiToken).where(ApiToken.token_hash == hash_token(token))).first()
            if row is None or row.revoked_at is not None:
                return None
            if row.expires_at is not None and row.expires_at <= datetime.utcnow():
                return None
            expires = int(row.expires_at.replace(tzinfo=timezone.utc).timestamp()) if row.expires_at else None
            return AccessToken(token=token, client_id=f"api_token:{row.id}", scopes=list(row.scopes or []),
                               expires_at=expires, subject=row.user_id, resource=mcp_url())


def _transport_security() -> TransportSecuritySettings:
    base = urlparse(issuer())
    hosts = sorted({base.netloc, "korexf.com", "www.korexf.com"})
    origins = sorted({f"{base.scheme}://{base.netloc}", "https://korexf.com", "https://www.korexf.com"})
    return TransportSecuritySettings(enable_dns_rebinding_protection=True, allowed_hosts=hosts, allowed_origins=origins)


def build_server(app: FastAPI, local) -> FastMCP:
    """A FastMCP whose tools are the local server's, run with the caller's OAuth token."""
    # Auth is the middleware chain in RemoteMCPEndpoint (same SDK pieces FastMCP would mount)
    server = FastMCP("korex", instructions=local.INSTRUCTIONS, stateless_http=True, json_response=True,
                     streamable_http_path="/mcp", transport_security=_transport_security())

    async def loopback(token: str, method: str, path: str, json: Optional[dict]) -> httpx.Response:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=LOOPBACK_BASE, timeout=30) as c:
            return await c.request(method, path, json=json, headers={"Authorization": f"Bearer {token}"})

    def remote(fn):
        async def run(**kwargs):
            token = get_access_token()
            if token is None:  # unreachable behind RequireAuthMiddleware
                raise local.KorexError("Not authorized.")

            def send(method, path, json):  # runs in the worker thread; the request runs on the loop
                return anyio.from_thread.run(loopback, token.token, method, path, json)

            def work():
                reset = local.REMOTE_SEND.set(send)
                try:
                    return fn(**kwargs)
                finally:
                    local.REMOTE_SEND.reset(reset)

            return await anyio.to_thread.run_sync(work)
        return run

    for tool in local.mcp._tool_manager.list_tools():
        # Same name, description, parameters and result conversion: only the function runs remotely
        server._tool_manager._tools[tool.name] = tool.model_copy(update={"fn": remote(tool.fn), "is_async": True})
    return server


class _PerRequestMCP:
    """Stateless: a fresh session manager per request, so no lifespan / task group to keep alive."""

    def __init__(self, server: FastMCP):
        self.server = server

    async def __call__(self, scope, receive, send):
        manager = StreamableHTTPSessionManager(app=self.server._mcp_server, json_response=True, stateless=True,
                                               security_settings=self.server.settings.transport_security)
        async with manager.run():
            await manager.handle_request(scope, receive, send)


class RemoteMCPEndpoint:
    """ASGI endpoint at /mcp. Built on first use (and rebuilt if the issuer changes)."""

    def __init__(self, app: FastAPI):
        self.app = app
        self._built: Optional[tuple[str, object]] = None

    def _endpoint(self):
        key = issuer()
        if self._built is None or self._built[0] != key:
            local = load_local_server()
            if local is None:
                logger.error("Remote MCP: mcp/korex_mcp.py not found next to backend/ (Railway root must be the repo root)")
                return None
            server = build_server(self.app, local)
            protected = RequireAuthMiddleware(_PerRequestMCP(server), [], build_resource_metadata_url(AnyHttpUrl(mcp_url())))
            asgi = AuthenticationMiddleware(AuthContextMiddleware(protected), backend=BearerAuthBackend(ApiTokenVerifier()))
            self._built = (key, asgi)
        return self._built[1]

    async def __call__(self, scope, receive, send):
        endpoint = self._endpoint() if enabled() else None
        if endpoint is None:
            response = JSONResponse(status_code=503, content={"error": "temporarily_unavailable",
                                                              "error_description": "Connecting by link isn't available yet."})
            await response(scope, receive, send)
            return
        await endpoint(scope, receive, send)


def mount(app: FastAPI) -> None:
    app.router.routes.append(Route("/mcp", endpoint=RemoteMCPEndpoint(app)))

