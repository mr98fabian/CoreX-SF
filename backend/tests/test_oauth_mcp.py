"""S-02: remote MCP + OAuth. The whole flow with a protocol client (httpx against the app,
no browser): discovery, DCR, authorize → consent → code → tokens, refresh rotation and reuse
detection, revocation, and the remote MCP itself (401s, the same 21 tools, parity with REST,
audit). write:payments is unreachable on every path."""
import base64
import hashlib
import importlib.util
import json
import re
import secrets
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.operations import Operations
from alembic.script import ScriptDirectory
from sqlmodel import Session, select

import api_tokens
import database
import mcp_remote
from auth import get_current_user_id
from main import app
from models import (Account, ApiToken, ApiTokenAudit, Goal, OAuthClient, OAuthCode, OAuthRefreshToken,
                    Subscription)
from routers import oauth

U = "cccccccc-cccc-4ccc-accc-cccccccccccc"
FREE = "dddddddd-dddd-4ddd-addd-dddddddddddd"
REDIRECT = "https://claude.ai/api/mcp/auth_callback"
ROOT = Path(__file__).resolve().parents[2]
KIT = ["read:accounts", "read:dashboard", "read:plan", "run:simulations", "write:accounts"]
TOOLS = sorted(["list_accounts", "korex_list_subscriptions", "get_dashboard_summary", "get_settings", "korex_sync_status",
                "korex_coach_profile", "korex_logros", "korex_house_goal", "korex_goals", "get_action_plan",
                "korex_judge_purchase", "add_account", "update_account", "delete_account", "korex_upsert_subscription",
                "korex_set_coach_profile", "korex_set_house_goal", "korex_set_goal", "korex_add_goal_savings",
                "korex_record_cut", "register_payment"])


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("MCP_REMOTE_ENABLED", "1")
    monkeypatch.setenv("OAUTH_ISSUER_URL", "http://testserver")
    monkeypatch.setenv("FRONTEND_URL", "https://korexf.com")
    oauth.limiter.reset()
    api_tokens._hits.clear()
    with Session(database.engine) as s:
        for uid, plan in ((U, "freedom"), (FREE, "starter")):
            s.add(Subscription(user_id=uid, plan=plan, status="active"))
        s.add(Account(user_id=U, name="Visa Oro", type="debt", balance=Decimal("1200.00"), interest_rate=Decimal("24"),
                      min_payment=Decimal("40")))
        s.add(Account(user_id=U, name="Nómina", type="checking", balance=Decimal("2500.00"), interest_rate=Decimal("0"),
                      min_payment=Decimal("0")))
        s.commit()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (OAuthRefreshToken, OAuthCode, OAuthClient):
            for row in s.exec(select(model)).all():
                s.delete(row)
        for model in (ApiTokenAudit, ApiToken, Goal, Account, Subscription):
            for row in s.exec(select(model).where(model.user_id.in_([U, FREE]))).all():
                s.delete(row)
        s.commit()


def login(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def logout():
    app.dependency_overrides.pop(get_current_user_id, None)


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def register(client, **meta):
    body = {"client_name": "Claude", "redirect_uris": [REDIRECT], "token_endpoint_auth_method": "none", **meta}
    return client.post("/oauth/register", json=body)


def authorize(client, client_id, challenge, **params):
    q = {"client_id": client_id, "redirect_uri": REDIRECT, "response_type": "code", "code_challenge": challenge,
         "code_challenge_method": "S256", "state": "st-123", **params}
    return client.get("/oauth/authorize", params={k: v for k, v in q.items() if v is not None}, follow_redirects=False)


def query(location):
    return {k: v[0] for k, v in parse_qs(urlparse(location).query).items()}


def consent(client, handle, uid=U, approve=True):
    login(uid)
    details = client.post("/api/oauth/consent/details", json={"request": handle})
    action = client.post(f"/api/oauth/consent/{'approve' if approve else 'deny'}", json={"request": handle})
    logout()
    return details, action


def get_code(client, scope=None, uid=U):
    client_id = register(client).json()["client_id"]
    verifier, challenge = pkce()
    r = authorize(client, client_id, challenge, scope=scope)
    assert r.status_code == 302 and r.headers["location"].startswith("https://korexf.com/oauth/consent?request=")
    handle = query(r.headers["location"])["request"]
    _, approved = consent(client, handle, uid)
    assert approved.status_code == 200, approved.text
    q = query(approved.json()["redirect_to"])
    assert q["state"] == "st-123"
    return client_id, verifier, q["code"]


def exchange(client, client_id, verifier, code, redirect=REDIRECT):
    return client.post("/oauth/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect,
                                             "code_verifier": verifier, "client_id": client_id})


def connect(client, scope=None):
    client_id, verifier, code = get_code(client, scope)
    r = exchange(client, client_id, verifier, code)
    assert r.status_code == 200, r.text
    return client_id, r.json()


def refresh(client, client_id, refresh_token):
    return client.post("/oauth/token", data={"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": client_id})


def rpc(client, method, params=None, token=None, url="/mcp"):
    headers = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post(url, headers=headers, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}})


def call(client, token, tool_name, **args):
    r = rpc(client, "tools/call", {"name": tool_name, "arguments": args}, token)
    assert r.status_code == 200, r.text
    return r.json()["result"]


def manual_token(client, scopes=KIT):
    login(U)
    r = client.post("/api/tokens", json={"name": "a mano", "scopes": scopes})
    logout()
    assert r.status_code == 200, r.text
    return r.json()["token"]


def local_tool(client, token, tool_name, **args):
    """The LOCAL server's tool, against REST with a manual token (the stdio path's _call, same request)."""
    km = mcp_remote.load_local_server()
    reset = km.REMOTE_SEND.set(lambda m, p, j: client.request(m, p, json=j, headers={"Authorization": f"Bearer {token}"}))
    try:
        return km.mcp._tool_manager.get_tool(tool_name).fn(**args)
    finally:
        km.REMOTE_SEND.reset(reset)


# ── Discovery ────────────────────────────────────────────────────────────────────────

def test_discovery_documents_are_consistent(client):
    pr = client.get("/.well-known/oauth-protected-resource").json()
    assert pr == client.get("/.well-known/oauth-protected-resource/mcp").json()
    assert pr["resource"] == "http://testserver/mcp" and pr["authorization_servers"] == ["http://testserver"]
    assert pr["scopes_supported"] == KIT and pr["bearer_methods_supported"] == ["header"]
    md = client.get("/.well-known/oauth-authorization-server").json()
    assert md["issuer"] == "http://testserver"
    for key, path in (("authorization_endpoint", "/oauth/authorize"), ("token_endpoint", "/oauth/token"),
                      ("registration_endpoint", "/oauth/register"), ("revocation_endpoint", "/oauth/revoke")):
        assert md[key] == f"http://testserver{path}"
    assert md["code_challenge_methods_supported"] == ["S256"] and md["scopes_supported"] == KIT
    assert md["response_types_supported"] == ["code"]
    assert md["grant_types_supported"] == ["authorization_code", "refresh_token"]
    assert md["token_endpoint_auth_methods_supported"] == ["none", "client_secret_basic"]
    assert "write:payments" not in json.dumps([pr, md])


def test_kit_scopes_match_the_frontend_kit():
    src = (ROOT / "frontend" / "src" / "lib" / "aiKit.ts").read_text(encoding="utf-8")
    kit = re.search(r"KIT_TOKEN_SCOPES\s*=\s*\[([^\]]*)\]", src).group(1)
    assert re.findall(r"'([^']+)'", kit) == oauth.KIT_SCOPES == KIT


def test_without_the_switch_everything_is_503_and_the_rest_works(client, monkeypatch):
    monkeypatch.delenv("MCP_REMOTE_ENABLED")
    for r in (client.get("/.well-known/oauth-authorization-server"), client.get("/.well-known/oauth-protected-resource"),
              register(client), client.get("/oauth/authorize"), client.post("/oauth/token", data={}),
              client.post("/oauth/revoke", data={}), rpc(client, "tools/list")):
        assert r.status_code == 503
    assert client.get("/health").json() == {"status": "ok"}


# ── DCR ──────────────────────────────────────────────────────────────────────────────

def test_dcr_registers_a_public_client_and_rejects_bad_metadata(client):
    r = register(client)
    assert r.status_code == 201 and r.json()["client_id"].startswith("kxc_") and "client_secret" not in r.json()
    assert register(client, redirect_uris=[]).status_code == 400
    assert register(client, redirect_uris=["http://evil.example/cb"]).status_code == 400  # http only on loopback
    assert register(client, redirect_uris=["http://127.0.0.1:33418/cb"]).status_code == 201
    assert register(client, grant_types=["client_credentials"]).status_code == 400
    assert register(client, scope="read:accounts write:payments").status_code == 400  # tricky metadata
    confidential = register(client, token_endpoint_auth_method="client_secret_basic").json()
    with Session(database.engine) as s:
        row = s.exec(select(OAuthClient).where(OAuthClient.client_id == confidential["client_id"])).first()
        assert row.secret_hash == api_tokens.hash_token(confidential["client_secret"])


# ── Authorize ────────────────────────────────────────────────────────────────────────

def test_authorize_validates_before_consent(client):
    client_id = register(client).json()["client_id"]
    _, challenge = pkce()
    # unregistered redirect_uri / unknown client: error WITHOUT redirect
    r = authorize(client, client_id, challenge, redirect_uri="https://evil.example/cb")
    assert r.status_code == 400 and "location" not in r.headers
    assert authorize(client, "kxc_nope", challenge).status_code == 400
    # no PKCE, or plain → error to the (valid) redirect_uri
    for params in ({"code_challenge": None}, {"code_challenge_method": "plain"}):
        r = authorize(client, client_id, challenge, **params)
        assert r.status_code == 302 and query(r.headers["location"])["error"] == "invalid_request"
    # write:payments → invalid_scope, and nothing was created
    r = authorize(client, client_id, challenge, scope="read:accounts write:payments")
    assert query(r.headers["location"])["error"] == "invalid_scope" and query(r.headers["location"])["state"] == "st-123"
    assert authorize(client, client_id, challenge, resource="https://evil.example/mcp").headers["location"].count("invalid_target") == 1
    with Session(database.engine) as s:
        assert s.exec(select(OAuthCode)).all() == []
    # valid → the SPA's consent screen with an opaque handle (stored hashed)
    r = authorize(client, client_id, challenge, resource="http://testserver/mcp")
    handle = query(r.headers["location"])["request"]
    with Session(database.engine) as s:
        row = s.exec(select(OAuthCode)).one()
        assert row.kind == "request" and row.token_hash == api_tokens.hash_token(handle) and row.scopes == KIT


def test_consent_requires_a_session_and_shows_the_grant(client):
    client_id = register(client).json()["client_id"]
    _, challenge = pkce()
    handle = query(authorize(client, client_id, challenge, scope="read:accounts read:plan").headers["location"])["request"]
    assert client.post("/api/oauth/consent/details", json={"request": handle}).status_code == 401  # no session
    details, _ = consent(client, handle, approve=False)
    assert details.json()["client_name"] == "Claude" and details.json()["redirect_host"] == "claude.ai"
    assert details.json()["scopes"] == [{"scope": "read:accounts", "label": "Ver mis cuentas"},
                                        {"scope": "read:plan", "label": "Ver mi plan de acción"}]
    # the deny already ran: the request is spent
    login(U)
    assert client.post("/api/oauth/consent/approve", json={"request": handle}).status_code == 404


def test_cancel_redirects_access_denied_and_creates_nothing(client):
    client_id = register(client).json()["client_id"]
    _, challenge = pkce()
    handle = query(authorize(client, client_id, challenge).headers["location"])["request"]
    _, denied = consent(client, handle, approve=False)
    q = query(denied.json()["redirect_to"])
    assert q["error"] == "access_denied" and q["state"] == "st-123"
    with Session(database.engine) as s:
        assert s.exec(select(ApiToken).where(ApiToken.user_id == U)).all() == []


def test_free_plan_cannot_connect(client):
    client_id = register(client).json()["client_id"]
    _, challenge = pkce()
    handle = query(authorize(client, client_id, challenge).headers["location"])["request"]
    details, approved = consent(client, handle, uid=FREE)
    assert details.json()["blocked"] == "free_plan" and approved.status_code == 403


# ── Token ────────────────────────────────────────────────────────────────────────────

def test_code_exchange_issues_an_api_token(client):
    client_id, tokens = connect(client)
    assert tokens["token_type"] == "Bearer" and tokens["expires_in"] == 3600 and tokens["scope"] == " ".join(KIT)
    assert tokens["access_token"].startswith("kx_") and tokens["refresh_token"].startswith("kxr_")
    with Session(database.engine) as s:
        row = s.exec(select(ApiToken).where(ApiToken.user_id == U)).one()
        assert row.source == "oauth" and row.name == "Claude" and row.scopes == KIT and row.expires_at is not None
        assert row.token_hash == api_tokens.hash_token(tokens["access_token"])
        ref = s.exec(select(OAuthRefreshToken)).one()
        assert ref.token_hash == api_tokens.hash_token(tokens["refresh_token"]) and ref.api_token_id == row.id
    login(U)
    listed = client.get("/api/tokens").json()
    assert listed[0]["source"] == "oauth" and listed[0]["active"] is True


def test_code_exchange_rejects_bad_verifier_reuse_expiry_and_redirect(client):
    client_id, verifier, code = get_code(client)
    assert exchange(client, client_id, "x" * 50, code).json()["error"] == "invalid_grant"
    assert exchange(client, client_id, verifier, code).status_code == 400  # burnt by the failed attempt
    client_id, verifier, code = get_code(client)
    assert exchange(client, client_id, verifier, code).status_code == 200
    assert exchange(client, client_id, verifier, code).status_code == 400  # reused
    client_id, verifier, code = get_code(client)
    with Session(database.engine) as s:
        row = s.exec(select(OAuthCode).where(OAuthCode.token_hash == api_tokens.hash_token(code))).one()
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        s.add(row); s.commit()
    assert exchange(client, client_id, verifier, code).status_code == 400  # expired
    client_id, verifier, code = get_code(client)
    assert exchange(client, client_id, verifier, code, redirect="https://claude.ai/other").status_code == 400
    assert client.post("/oauth/token", data={"grant_type": "password", "client_id": client_id}).json()["error"] == "unsupported_grant_type"


def test_refresh_rotates_and_reuse_revokes_the_family(client):
    client_id, first = connect(client)
    second = refresh(client, client_id, first["refresh_token"])
    assert second.status_code == 200
    second = second.json()
    assert second["refresh_token"] != first["refresh_token"] and second["access_token"] != first["access_token"]
    assert rpc(client, "tools/list", token=first["access_token"]).status_code == 401  # old access died on rotation
    assert rpc(client, "tools/list", token=second["access_token"]).status_code == 200
    # the rotated refresh comes back → whole family revoked, the live access too
    reused = refresh(client, client_id, first["refresh_token"])
    assert reused.status_code == 400 and reused.json()["error"] == "invalid_grant"
    assert rpc(client, "tools/list", token=second["access_token"]).status_code == 401
    assert refresh(client, client_id, second["refresh_token"]).status_code == 400


def test_refresh_stops_when_the_plan_is_gone(client):
    client_id, tokens = connect(client)
    with Session(database.engine) as s:
        sub = s.exec(select(Subscription).where(Subscription.user_id == U)).one()
        sub.plan = "starter"
        s.add(sub); s.commit()
    assert refresh(client, client_id, tokens["refresh_token"]).json()["error"] == "invalid_grant"


def test_revoke_and_settings_delete_kill_the_connection(client):
    client_id, tokens = connect(client)
    assert client.post("/oauth/revoke", data={"token": tokens["access_token"]}).status_code == 200
    assert rpc(client, "tools/list", token=tokens["access_token"]).status_code == 401
    assert refresh(client, client_id, tokens["refresh_token"]).status_code == 400
    assert client.post("/oauth/revoke", data={"token": "kx_does_not_exist"}).status_code == 200
    # Ajustes → Conecta tu IA → Revocar: the same ApiToken row
    client_id, tokens = connect(client)
    with Session(database.engine) as s:
        row_id = s.exec(select(ApiToken).where(ApiToken.token_hash == api_tokens.hash_token(tokens["access_token"]))).one().id
    login(U)
    assert client.delete(f"/api/tokens/{row_id}").status_code == 200
    logout()
    assert rpc(client, "tools/list", token=tokens["access_token"]).status_code == 401
    assert refresh(client, client_id, tokens["refresh_token"]).status_code == 400


def test_no_path_ever_mints_write_payments(client):
    client_id, verifier, code = get_code(client, scope="read:accounts")
    tokens = exchange(client, client_id, verifier, code).json()
    widened = client.post("/oauth/token", data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"],
                                                "client_id": client_id, "scope": "read:accounts write:payments"})
    assert widened.json()["error"] == "invalid_scope"
    connect(client)  # default = the kit
    with Session(database.engine) as s:
        rows = s.exec(select(ApiToken).where(ApiToken.user_id == U)).all()
        assert rows and all("write:payments" not in (r.scopes or []) for r in rows)
        assert all("write:payments" not in (r.scopes or []) for r in s.exec(select(OAuthRefreshToken)).all())


# ── Remote MCP ───────────────────────────────────────────────────────────────────────

def test_mcp_needs_a_bearer_header(client):
    r = rpc(client, "tools/list")
    assert r.status_code == 401
    assert 'resource_metadata="http://testserver/.well-known/oauth-protected-resource/mcp"' in r.headers["www-authenticate"]
    assert rpc(client, "tools/list", token="kx_invalid").status_code == 401
    _, tokens = connect(client)
    in_query = rpc(client, "tools/list", url=f"/mcp?access_token={tokens['access_token']}")
    assert in_query.status_code == 401


def test_initialize_carries_the_shared_instructions(client):
    _, tokens = connect(client)
    r = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                   "clientInfo": {"name": "test", "version": "1"}}, tokens["access_token"])
    assert r.status_code == 200
    assert r.json()["result"]["instructions"] == mcp_remote.load_local_server().INSTRUCTIONS
    assert "PRIMERA CONEXIÓN" in r.json()["result"]["instructions"]


def test_tools_list_is_exactly_the_local_21(client):
    _, tokens = connect(client)
    remote = rpc(client, "tools/list", token=tokens["access_token"]).json()["result"]["tools"]
    local = mcp_remote.load_local_server().mcp._tool_manager.list_tools()
    assert sorted(t["name"] for t in remote) == sorted(t.name for t in local) == TOOLS
    by_name = {t.name: t for t in local}
    for t in remote:  # same parameters and descriptions
        assert t["inputSchema"] == by_name[t["name"]].parameters and t["description"] == by_name[t["name"]].description


def _result(res):
    sc = res.get("structuredContent")
    if sc is not None:
        return sc["result"] if set(sc) == {"result"} else sc
    return json.loads(res["content"][0]["text"])


def test_read_tools_match_rest_with_a_manual_token(client):
    _, tokens = connect(client)
    manual = manual_token(client)
    for name in ("list_accounts", "korex_list_subscriptions", "get_settings", "korex_coach_profile",
                 "korex_house_goal", "korex_goals", "get_action_plan", "korex_logros", "get_dashboard_summary"):
        res = call(client, tokens["access_token"], name)
        assert not res.get("isError"), (name, res)
        assert _result(res) == json.loads(json.dumps(local_tool(client, manual, name), default=str)), name
    assert [a["name"] for a in _result(call(client, tokens["access_token"], "list_accounts"))] == ["Visa Oro", "Nómina"]


def test_a_write_tool_leaves_the_same_audit_as_a_manual_token(client):
    _, tokens = connect(client)
    res = call(client, tokens["access_token"], "korex_set_goal", name="Fondo", target_amount=500)
    assert not res.get("isError"), res
    with Session(database.engine) as s:
        oauth_row = s.exec(select(ApiToken).where(ApiToken.source == "oauth", ApiToken.user_id == U)).one()
        audit = s.exec(select(ApiTokenAudit).where(ApiTokenAudit.token_id == oauth_row.id)).one()
    manual = manual_token(client)
    local_tool(client, manual, "korex_set_goal", name="Fondo 2", target_amount=600)
    with Session(database.engine) as s:
        manual_row = s.exec(select(ApiToken).where(ApiToken.source == "manual", ApiToken.user_id == U)).one()
        manual_audit = s.exec(select(ApiTokenAudit).where(ApiTokenAudit.token_id == manual_row.id)).one()
    assert (audit.action, audit.detail) == (manual_audit.action, manual_audit.detail) == ("POST /api/goals", "write:accounts")


def test_register_payment_exists_but_never_runs_without_the_scope(client):
    _, tokens = connect(client)
    res = call(client, tokens["access_token"], "register_payment", account="Visa Oro", amount=50)
    assert res["isError"] is True and "lacks the permission" in res["content"][0]["text"]
    with Session(database.engine) as s:
        assert s.exec(select(Account).where(Account.name == "Visa Oro")).one().balance == Decimal("1200.00")


def test_expired_oauth_token_is_401_and_a_manual_token_never_expires(client):
    _, tokens = connect(client)
    with Session(database.engine) as s:
        row = s.exec(select(ApiToken).where(ApiToken.source == "oauth", ApiToken.user_id == U)).one()
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        s.add(row); s.commit()
    assert rpc(client, "tools/list", token=tokens["access_token"]).status_code == 401
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {tokens['access_token']}"}).status_code == 401
    manual = manual_token(client)
    with Session(database.engine) as s:
        assert s.exec(select(ApiToken).where(ApiToken.source == "manual", ApiToken.user_id == U)).one().expires_at is None
    assert rpc(client, "tools/list", token=manual).status_code == 200
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {manual}"}).status_code == 200


def test_oauth_connections_share_the_10_token_cap(client):
    for i in range(10):
        manual_token(client, ["read:accounts"])
    client_id = register(client).json()["client_id"]
    _, challenge = pkce()
    handle = query(authorize(client, client_id, challenge).headers["location"])["request"]
    _, approved = consent(client, handle)
    assert approved.status_code == 400 and "Maximum 10" in approved.json()["detail"]


# ── The local server is untouched ────────────────────────────────────────────────────

def test_local_stdio_server_still_starts_and_lists_the_21_tools():
    import anyio
    from mcp import ClientSession, StdioServerParameters
    from mcp.client.stdio import stdio_client

    async def run():
        params = StdioServerParameters(command=sys.executable, args=[str(ROOT / "mcp" / "korex_mcp.py")],
                                       env={"KOREX_API_TOKEN": "kx_test", "PYTHONIOENCODING": "utf-8"})
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                init = await session.initialize()
                tools = await session.list_tools()
                return init.instructions, sorted(t.name for t in tools.tools)

    instructions, names = anyio.run(run)
    assert names == TOOLS and instructions == mcp_remote.load_local_server().INSTRUCTIONS


# ── Migration ────────────────────────────────────────────────────────────────────────

def test_one_head_and_the_migration_goes_up_and_down_clean():
    backend = ROOT / "backend"
    assert ScriptDirectory.from_config(Config(str(backend / "alembic.ini"))).get_heads() == ["b7d2e9f4c3a1"]
    path = next((backend / "alembic" / "versions").glob("b7d2e9f4c3a1_*.py"))
    spec = importlib.util.spec_from_file_location("mig_oauth", path)
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE api_tokens (id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL, name VARCHAR, token_hash VARCHAR)"))
        conn.execute(sa.text("INSERT INTO api_tokens (user_id, name, token_hash) VALUES ('u', 'a mano', 'h')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        insp = sa.inspect(conn)
        assert {"expires_at", "source"} <= {c["name"] for c in insp.get_columns("api_tokens")}
        assert {"oauth_clients", "oauth_codes", "oauth_refresh_tokens"} <= set(insp.get_table_names())
        assert conn.execute(sa.text("SELECT expires_at, source FROM api_tokens")).one() == (None, "manual")
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        insp = sa.inspect(conn)
        assert set(insp.get_table_names()) == {"api_tokens"}
        assert {c["name"] for c in insp.get_columns("api_tokens")} == {"id", "user_id", "name", "token_hash"}
