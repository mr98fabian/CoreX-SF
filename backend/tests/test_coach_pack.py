"""Pack IA: coach profile (defaults, validation, isolation, scopes), logros from
real data coherent with the engine, and the MCP instruction pack."""
import ast
from datetime import date
from pathlib import Path

import pytest
from sqlmodel import Session, select

import api_tokens
import database
from auth import get_current_user_id
from main import app
from models import ApiToken, ApiTokenAudit, CoachProfile
from routers import demo
from tests.test_api_tokens import bearer, make_token

A = "dddddddd-dddd-4ddd-addd-dddddddddddd"
B = "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee"


@pytest.fixture(autouse=True)
def clean():
    api_tokens._hits.clear()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CoachProfile, ApiTokenAudit, ApiToken):
            for row in s.exec(select(model).where(model.user_id.in_([A, B]))).all():
                s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


# ── Coach profile ──────────────────────────────────────────────

def test_first_get_creates_the_default_profile(client):
    as_user(A)
    r = client.get("/api/coach-profile", headers={"Authorization": "Bearer x"})
    assert r.status_code == 200
    assert r.json() == {"tone": "calido", "tone_label": "Cálido", "ai_name": None, "payday_weekday": None, "payday_label": None}


def test_patch_valid_and_partial(client):
    as_user(A)
    h = {"Authorization": "Bearer x"}
    r = client.patch("/api/coach-profile", headers=h, json={"tone": "pesado", "ai_name": "  Muse ", "payday_weekday": 4})
    assert r.status_code == 200
    assert r.json() == {"tone": "pesado", "tone_label": "Modo pesado", "ai_name": "Muse", "payday_weekday": 4, "payday_label": "viernes"}
    r = client.patch("/api/coach-profile", headers=h, json={"tone": "directo"})  # partial: name and payday kept
    assert r.json()["ai_name"] == "Muse" and r.json()["payday_weekday"] == 4 and r.json()["tone"] == "directo"
    r = client.patch("/api/coach-profile", headers=h, json={"ai_name": None})
    assert r.json()["ai_name"] is None


@pytest.mark.parametrize("body", [{"tone": "agresivo"}, {"payday_weekday": 7}, {"payday_weekday": -1}, {"ai_name": "x" * 41}])
def test_patch_out_of_catalog_is_422(client, body):
    as_user(A)
    assert client.patch("/api/coach-profile", headers={"Authorization": "Bearer x"}, json=body).status_code == 422


def test_profiles_are_isolated_between_users(client):
    h = {"Authorization": "Bearer x"}
    as_user(A)
    client.patch("/api/coach-profile", headers=h, json={"tone": "pesado", "ai_name": "Muse"})
    as_user(B)
    assert client.get("/api/coach-profile", headers=h).json()["ai_name"] is None
    assert client.get("/api/coach-profile", headers=h).json()["tone"] == "calido"


def test_scopes(client):
    assert client.get("/api/coach-profile").status_code == 401
    assert client.patch("/api/coach-profile", json={}).status_code == 401
    assert client.get("/api/logros").status_code == 401
    read = make_token(client, A, scopes=["read:dashboard"])
    assert client.get("/api/coach-profile", headers=bearer(read)).status_code == 200
    assert client.get("/api/logros", headers=bearer(read)).status_code == 200
    assert client.patch("/api/coach-profile", headers=bearer(read), json={"tone": "directo"}).status_code == 403
    write_only = make_token(client, A, scopes=["write:payments"])
    assert client.get("/api/coach-profile", headers=bearer(write_only)).status_code == 403
    rw = make_token(client, A, scopes=["read:dashboard", "write:accounts"])
    r = client.patch("/api/coach-profile", headers=bearer(rw), json={"ai_name": "Muse"})
    assert r.status_code == 200
    with Session(database.engine) as s:  # the AI write is audited
        assert s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).first().summary.startswith("Perfil de coach")


# ── Logros ─────────────────────────────────────────────────────

def test_logros_with_the_demo_persona_match_the_engine(client, auth_headers):
    from sqlmodel import SQLModel
    from tests.test_demo_persona import _load
    SQLModel.metadata.drop_all(database.engine)
    SQLModel.metadata.create_all(database.engine)
    _load(client, auth_headers)
    visa = next(a for a in client.get("/api/accounts", headers=auth_headers).json() if a["name"] == "Tarjeta Visa")
    assert client.post("/api/transactions/manual", headers=auth_headers, json={
        "account_id": visa["id"], "amount": 216, "description": "Pago", "category": "payment",
        "date": date.today().isoformat()}).status_code == 200

    lg = client.get("/api/logros", headers=auth_headers).json()
    cc = client.get("/api/strategy/command-center", headers=auth_headers).json()["freedom_counter"]
    assert lg["num_pagos"]["valor"] == 1 and lg["total_pagado"]["valor"] == 216.0
    assert lg["deudas_totales"]["valor"] == 4 and lg["deudas_en_cero"]["valor"] == 0
    assert lg["interes_evitado"]["valor"] == pytest.approx(cc["interest_saved"], abs=0.01)
    assert lg["fecha_libre"]["valor"] == cc["current_freedom_date"]
    assert lg["interes_plan"]["valor"] > 0
    assert lg["racha_cortes_cero"]["valor"] is None and "cortes registrados" in lg["racha_cortes_cero"]["nota"]
    for k in ("total_pagado", "num_pagos", "deudas_en_cero", "deudas_totales", "interes_evitado", "interes_plan", "fecha_libre"):
        assert lg[k]["etiqueta"]  # ready to quote


# ── MCP pack ───────────────────────────────────────────────────

def test_mcp_lists_the_new_tools_and_the_house_rules():
    src = (Path(__file__).resolve().parents[2] / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
    tools = {f.name for f in ast.walk(ast.parse(src)) if isinstance(f, ast.FunctionDef)
             and any("mcp.tool" in ast.unparse(d) for d in f.decorator_list)}
    assert {"korex_coach_profile", "korex_set_coach_profile", "korex_logros"} <= tools
    for phrase in ("la mente de KoreX", "nombre que el usuario te dio", "Nunca muevas dinero real",
                   "Nunca prometas puntos de score", "Números solo de fuentes reales",
                   "SOLO con captura o confirmación escrita", "Corte en cero", "estados completos al vencimiento",
                   "Avalancha", "intereses antes que score", "builder", "corte − 2", "día de pago",
                   "una misión por mensaje", "máximo 1 al día, 3 a la semana y 8 al mes", "21:30 a 07:00",
                   "`korex_logros`"):
        assert phrase in src, phrase
