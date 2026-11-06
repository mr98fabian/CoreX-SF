"""Sync status (feat/sync-status): auth, shape, mark → status, scopes,
explanation with/without a previous sync, and the MCP tool listing."""
import ast
from datetime import datetime
from pathlib import Path

import pytest
from sqlmodel import Session, select

import api_tokens
import database
from auth import get_current_user_id
from main import app
from models import ApiToken, ApiTokenAudit, Subscription, SyncState
from routers.sync import explanation_es, human_es
from tests.test_api_tokens import make_token, bearer, login

A = "cccccccc-cccc-4ccc-accc-cccccccccccc"
KEYS = {"provider", "mode", "cadence", "windows", "last_sync_at", "last_source", "explanation_es"}


@pytest.fixture(autouse=True)
def clean():
    api_tokens._hits.clear()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (SyncState, ApiTokenAudit, ApiToken, Subscription):
            for row in s.exec(select(model).where(model.user_id == A)).all():
                s.delete(row)
        s.commit()


def test_no_auth_is_401(client):
    assert client.get("/api/sync/status").status_code == 401
    assert client.post("/api/sync/mark", json={}).status_code == 401


def test_read_token_gets_full_shape_without_sync(client):
    tok = make_token(client, A, scopes=["read:dashboard"])
    r = client.get("/api/sync/status", headers=bearer(tok))
    assert r.status_code == 200
    body = r.json()
    assert set(body) == KEYS
    assert body["provider"] == "plaid" and body["mode"] == "operada_por_ia"
    assert body["cadence"] == {"min": 1, "max": 4}
    assert [w["time"] for w in body["windows"]] == ["07:00", "17:15"]
    assert body["last_sync_at"] is None
    assert "Todavía no se registra una primera sincronización." in body["explanation_es"]
    assert "Última sincronización" not in body["explanation_es"]


def test_mark_updates_and_get_reflects_it(client):
    tok = make_token(client, A, scopes=["read:dashboard", "write:accounts"])
    r = client.post("/api/sync/mark", json={"source": "operador-ia"}, headers=bearer(tok))
    assert r.status_code == 200 and r.json()["last_sync_at"] is not None
    got = client.get("/api/sync/status", headers=bearer(tok)).json()
    assert got["last_sync_at"] == r.json()["last_sync_at"]
    assert got["last_source"] == "operador-ia"
    assert "Última sincronización:" in got["explanation_es"]
    with Session(database.engine) as s:  # the AI write is audited
        assert s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).first().summary.startswith("Sincronización")


def test_mark_with_read_only_token_is_403(client):
    tok = make_token(client, A, scopes=["read:dashboard"])
    assert client.post("/api/sync/mark", json={"source": "operador-ia"}, headers=bearer(tok)).status_code == 403


def test_status_without_read_scope_is_403(client):
    tok = make_token(client, A, scopes=["write:payments"])
    assert client.get("/api/sync/status", headers=bearer(tok)).status_code == 403


def test_unknown_source_rejected(client):
    login(A)
    assert client.post("/api/sync/mark", json={"source": "<script>"}).status_code == 422


def test_session_user_can_read_and_mark(client):
    login(A)
    assert client.get("/api/sync/status").json()["last_sync_at"] is None
    assert client.post("/api/sync/mark", json={"source": "automatica"}).json()["last_source"] == "automatica"


def test_explanation_texts():
    when = datetime(2026, 11, 6, 12, 5)
    assert explanation_es(None).endswith("Todavía no se registra una primera sincronización.")
    assert explanation_es(when).endswith("Última sincronización: 6 de noviembre de 2026, 12:05 (UTC).")
    assert human_es(when, "America/Bogota") == "6 de noviembre de 2026, 07:05 (America/Bogota)"
    assert human_es(when, "No/Existe").endswith("(UTC)")


def test_mcp_lists_sync_tool_and_instructions():
    src = (Path(__file__).resolve().parents[2] / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
    tools = [f.name for f in ast.walk(ast.parse(src)) if isinstance(f, ast.FunctionDef)
             and any("mcp.tool" in ast.unparse(d) for d in f.decorator_list)]
    assert "korex_sync_status" in tools
    assert "informa al usuario sus horas de sincronización usando `korex_sync_status`" in src
