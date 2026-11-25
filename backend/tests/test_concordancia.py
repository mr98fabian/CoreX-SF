"""Concordance tests (misión 17; spec of misión 14 §4): the same concept gives the same value on
every surface, at the same instant (±$0.01), through HTTP, with fixed personas and a fixed `today`.
Regla de oro: every number that ever contradicted another screen is pinned here."""
import calendar
from datetime import date, timedelta
from decimal import Decimal as D

import pytest
from sqlmodel import Session, SQLModel, select

import database
import helpers
from auth import get_current_user_id
from main import app
from tests.personas import CASO_REAL_TODAY, PERSONAS, seed

H = {"Authorization": "Bearer x"}
CENT = 0.011
PAYMENT_TYPES = ("obligation", "min_payment", "attack")


def _wipe(U):
    with Session(database.engine) as s:
        for table in reversed(SQLModel.metadata.sorted_tables):
            if "user_id" in table.c:
                s.exec(table.delete().where(table.c.user_id == U))
        s.commit()


@pytest.fixture
def world(client, monkeypatch, request):
    """world(persona, today) → a client signed in as that persona with the app's clock at `today`."""
    made = []

    def make(key, today=CASO_REAL_TODAY):
        U = PERSONAS[key][0]
        _wipe(U)
        with Session(database.engine) as s:
            seed(s, key)
        made.append(U)
        monkeypatch.setattr(helpers, "today", lambda: today)
        app.dependency_overrides[get_current_user_id] = lambda: U

        class W:
            user = U
            day = today

            @staticmethod
            def get(url):
                r = client.get(url, headers=H)
                assert r.status_code == 200, (url, r.status_code, r.text[:300])
                return r.json()
        return W

    yield make
    app.dependency_overrides.pop(get_current_user_id, None)
    for U in made:
        _wipe(U)


ALL = ["caso_real", "maria", "owner"]


def _eom(d: date) -> date:
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def _gps_paid(moves, start: date, end: date) -> float:
    return sum(m["amount"] for m in moves if m["type"] in PAYMENT_TYPES and start.isoformat() <= m["date"] <= end.isoformat())


def _month(path, d: date):
    return next(m for m in path["resumen_meses"] if m["mes"] == d.isoformat()[:7])


# 1 ── deuda total ──────────────────────────────────────────────

@pytest.mark.parametrize("persona", ALL)
def test_deuda_total_igual_en_todas(world, persona):
    w = world(persona)
    dash = w.get("/api/dashboard")
    accounts = w.get("/api/accounts")
    compare = w.get("/api/velocity/compare")
    proj = w.get("/api/velocity/projections")
    path = w.get("/api/velocity/freedom-path")
    total = dash["total_debt"]
    assert abs(sum(float(a["balance"]) for a in accounts if a["type"] == "debt" and float(a["balance"]) > 0) - total) < CENT
    assert abs(compare["deuda_hoy"] - total) < CENT
    assert abs(proj["total_debt"] - total) < CENT
    today_point = [p for p in path["daily_series"] if p["date"] <= w.day.isoformat()][-1]
    assert abs(today_point["total_balance"] - total) < CENT, "Calendario-hoy == Inicio (N-02)"
    assert abs(_month(path, w.day)["inicio"] - total) < CENT


# 2-3 ── cierre del mes y bajas: pagos fechados reales + interés ─

@pytest.mark.parametrize("day", [1, 15, 24, 30])
def test_caso_real_cierre_de_mes_calendario_igual_a_gps(world, day):
    w = world("caso_real", date(2026, 11, day))
    path = w.get("/api/velocity/freedom-path")
    gps = w.get("/api/strategy/tactical-gps")["movements"]
    dash = w.get("/api/dashboard")
    m = _month(path, w.day)
    paid = _gps_paid(gps, w.day, _eom(w.day))
    assert abs(m["pagos"] - paid) < CENT, "el Calendario baja exactamente lo que el GPS paga este mes"
    assert abs(m["cierre"] - (m["inicio"] - m["pagos"] + m["interes"])) < CENT
    days_left = (_eom(w.day) - w.day).days + 1
    assert 0 <= m["interes"] <= dash["total_daily_interest"] * days_left + CENT
    assert abs(m["baja"] - (m["inicio"] - m["cierre"])) < CENT


def test_caso_real_ya_no_promete_la_baja_fantasma(world):
    w = world("caso_real")
    m = _month(w.get("/api/velocity/freedom-path"), w.day)
    assert abs(m["baja"] - 7667.78) > 1, "N-01: la baja fantasma de la Misión 14"
    assert m["baja"] < 2000


def test_bajas_no_dependen_de_dias_pasados(world):
    w = world("caso_real", date(2026, 11, 30))
    m = _month(w.get("/api/velocity/freedom-path"), w.day)
    gps = w.get("/api/strategy/tactical-gps")["movements"]
    assert m["baja"] <= _gps_paid(gps, w.day, w.day) + CENT


@pytest.mark.parametrize("persona", ALL)
def test_calendario_nunca_baja_mas_que_lo_que_el_gps_paga(world, persona):
    w = world(persona)
    path = w.get("/api/velocity/freedom-path")
    gps = w.get("/api/strategy/tactical-gps")["movements"]
    mision = w.get("/api/dashboard")["mision"]
    pts = {p["date"]: p["total_balance"] for p in path["daily_series"]}
    prev = pts[w.day.isoformat()]
    d = w.day + timedelta(days=1)
    while d <= _eom(w.day):
        cur = pts.get(d.isoformat(), prev)
        assert prev - cur <= _gps_paid(gps, d, d) + CENT, d
        prev = cur
        d += timedelta(days=1)
    if mision["ataque"] == 0:
        assert not [m for m in gps if m["type"] == "attack" and m["date"] == w.day.isoformat()]


# 5-6 ── reserva ─────────────────────────────────────────────────

@pytest.mark.parametrize("persona", ALL)
def test_reserva_una_sola_definicion(world, persona):
    dash = world(persona).get("/api/dashboard")
    obs = dash["mision"]["obligaciones"]
    assert abs(dash["reserved_for_bills"] - dash["mision"]["reserva"]) < CENT
    assert abs(sum(o["monto"] for o in obs) - dash["mision"]["reserva"]) < CENT
    assert dash["safety_breakdown"] == obs


@pytest.mark.parametrize("persona", ALL)
def test_copy_de_reserva_describe_la_reserva(world, persona):
    dash = world(persona).get("/api/dashboard")
    obs = dash["mision"]["obligaciones"]
    text = (dash["velocity_target"] or {}).get("justification", "")
    if obs:
        assert obs[0]["cuenta"] in text
        if any(o["tipo"] != "minimo" for o in obs):
            assert "mínimos" not in text and "este mes" not in text


# 7-8 ── faltante (D1) y disponible (D3) ────────────────────────

@pytest.mark.parametrize("persona", ALL)
def test_faltante_inicio_igual_gps(world, persona):
    w = world(persona)
    mision = w.get("/api/dashboard")["mision"]
    gps = w.get("/api/strategy/tactical-gps")["movements"]
    window_end = (w.day + timedelta(days=mision["ventana_dias"])).isoformat()
    shorts = [m for m in gps if m["type"] == "faltante" and m["date"] < window_end]
    f = mision["faltante"]
    assert (f is None) == (not shorts)
    if f:
        first = shorts[0]
        assert (first["date"], first["destination"]) == (f["fecha_accion"], f["cuenta"])
        assert abs(first["amount"] - f["monto"]) < CENT


@pytest.mark.parametrize("persona", ALL)
def test_disponible_es_el_ataque(world, persona):
    dash = world(persona).get("/api/dashboard")
    assert abs(dash["disponible_plan"] - dash["mision"]["ataque"]) < CENT
    assert abs(dash["efectivo"] - dash["liquid_cash"]) < CENT


# 9-10 ── interés y mínimo únicos ───────────────────────────────

@pytest.mark.parametrize("persona", ALL)
def test_interes_periodos_unicos(world, persona):
    w = world(persona)
    dash = w.get("/api/dashboard")["interes_diario"]["periodos"]
    est = w.get("/api/subscriptions/savings-estimate")["interes_periodos"]
    assert est == dash


@pytest.mark.parametrize("persona", ALL)
def test_minimo_unico_en_la_mision(world, persona):
    w = world(persona)
    mision = w.get("/api/dashboard")["mision"]
    accounts = {a["name"]: a for a in w.get("/api/accounts")}
    for g in mision["gap_debts"]:
        a = accounts[g["name"]]
        monthly = (D(str(a["balance"])) * D(str(a["interest_rate"])) / D("1200")).quantize(D("0.01"))
        assert abs(g["shortfall"] - float(monthly - D(str(a["plan_minimum"])))) < CENT


# 11-12 ── fecha de libertad y meses ────────────────────────────

@pytest.mark.parametrize("persona", ALL)
def test_fecha_libre_unica(world, persona):
    w = world(persona)
    compare = w.get("/api/velocity/compare")["plan"]["fecha_libre"]
    path = w.get("/api/velocity/freedom-path")["freedom_date"]
    gps = w.get("/api/strategy/tactical-gps")["freedom_date_velocity"]
    proj = w.get("/api/velocity/projections")["velocity_debt_free_date"]
    cc = w.get("/api/strategy/command-center")["freedom_counter"]["current_freedom_date"]
    assert compare == path == gps == proj == cc


@pytest.mark.parametrize("persona", ALL)
def test_meses_calendario(world, persona):
    w = world(persona)
    plan = w.get("/api/velocity/compare")["plan"]
    free = date.fromisoformat(plan["fecha_libre"])
    assert plan["meses"] == (free.year - w.day.year) * 12 + free.month - w.day.month


# 13 ── aviso de corte == obligación ────────────────────────────

def test_aviso_de_corte_igual_a_la_obligacion(world):
    import push_engine
    w = world("caso_real", date(2026, 11, 29))  # Tarjeta B y D cortan el 1-dic
    obs = w.get("/api/dashboard")["mision"]["obligaciones"]
    cortes = {o["cuenta"]: o["monto"] for o in obs if o["tipo"] == "corte"}
    with Session(database.engine) as s:
        cands = [c for c in push_engine.candidates(s, w.user, w.day, 9) if c["kind"] == "corte"]
    assert cands, "hay cortes en 2 días"
    for c in cands:
        assert c["vars"]["name"] in cortes
        assert c["vars"]["amount"] == f"${cortes[c['vars']['name']]:,.2f}"


# 14 ── demo pública ─────────────────────────────────────────────

def test_maria_demo_se_concilia_sola(world):
    w = world("maria")
    dash = w.get("/api/dashboard")
    assert dash["total_debt"] == 18400 and dash["liquid_cash"] == 3350
    assert dash["mision"]["reserva"] < dash["total_debt"], "D2: no reserva el 100 % de su deuda"
    gps = w.get("/api/strategy/tactical-gps")["movements"]
    assert all(m["funding_balance_after"] >= 0 for m in gps), "el GPS nunca lleva la caja a negativo"
    assert any(m["type"] == "attack" for m in gps), "con mínimo + avalancha, el plan avanza"


# N-15 ── endpoints huérfanos ───────────────────────────────────

def test_huerfanos_retirados(world):
    w = world("owner")
    from fastapi.testclient import TestClient
    c = TestClient(app)
    for url in ("/api/cashflow/projection", "/api/notifications/summary", "/api/notifications/upcoming"):
        assert c.get(url, headers=H).status_code == 404, url
    routes = [r for r in app.routes if getattr(r, "path", "") == "/api/cashflow/summary"]
    assert len(routes) == 1
