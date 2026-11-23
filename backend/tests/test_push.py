"""Push notices: device endpoints (session only) and the hourly engine's anti-spam rules —
1 a day across kinds with priority corte > misión > celebración, dedup, quiet hours in the
user's own time zone, dead tokens, the user's preference, and fail-closed without Firebase."""
import json
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import api_tokens
import database
import helpers
import push_engine
from auth import DEMO_USER_ID, get_current_user_id
from main import app
from models import Account, PushDevice, PushLog, Subscription, Transaction, UserSettings

U = "12121212-1212-4121-a121-121212121212"
V = "34343434-3434-4343-a343-343434343434"
TZ = "America/Chicago"  # UTC-6 in November
DAY = date(2026, 11, 23)


def at(hour, day=DAY, tz=TZ):
    from zoneinfo import ZoneInfo
    return datetime(day.year, day.month, day.day, hour, 5, tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)


class FCM:
    def __init__(self):
        self.sent, self.result = [], "ok"

    async def __call__(self, token, title, body, data):
        self.sent.append({"token": token, "title": title, "body": body, "data": data})
        return self.result


@pytest.fixture
def fcm(monkeypatch):
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "f@x.iam", "private_key": "k", "project_id": "korex"}))
    monkeypatch.setattr(helpers, "build_daily_mission", lambda *a, **k: {"mision": None})
    yield FCM()
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (PushLog, PushDevice, Transaction, Account, UserSettings, Subscription):
            for row in s.exec(select(model).where(model.user_id.in_([U, V]))).all():
                s.delete(row)
        s.commit()


def login(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def device(uid=U, token="tok-1", tz=TZ, language="es"):
    with Session(database.engine) as s:
        s.add(PushDevice(user_id=uid, fcm_token=token, timezone=tz, language=language))
        s.commit()


def card(uid=U, name="Visa Oro", balance="430.00", closing=None, debt_type="debt"):
    with Session(database.engine) as s:
        a = Account(user_id=uid, name=name, type=debt_type, balance=Decimal(balance), interest_rate=Decimal("24"),
                    min_payment=Decimal("35"), closing_day=closing, debt_subtype="credit_card")
        s.add(a); s.commit(); s.refresh(a)
        return a.id


def paid_off(uid=U, name="Tarjeta chica", when=DAY):
    acc = card(uid, name, "0.00")
    with Session(database.engine) as s:
        s.add(Transaction(user_id=uid, account_id=acc, date=when.isoformat(), amount=Decimal("120"), description="pago", category="payment"))
        s.commit()
    return acc


def mission(monkeypatch, monto="150.00", cuenta="Visa Oro", tipo="corte", on=DAY):
    monkeypatch.setattr(helpers, "build_daily_mission", lambda *a, **k: {"mision": {
        "tipo": tipo, "cuenta": cuenta, "monto": Decimal(monto), "fecha_accion": on}})


async def run(hour, day=DAY, fcm=None, tz=TZ):
    return await push_engine.run_once(now=at(hour, day, tz), send=fcm)


def logs(uid=U):
    with Session(database.engine) as s:
        return s.exec(select(PushLog).where(PushLog.user_id == uid)).all()


# ── Endpoints ────────────────────────────────────────────────────────────────────────

def test_register_update_and_delete_a_device(client, fcm):
    login(U)
    assert client.post("/api/push/devices", json={"token": "fcm-token-aaaa", "timezone": "America/Mexico_City"}).status_code == 200
    assert client.post("/api/push/devices", json={"token": "fcm-token-aaaa", "timezone": "America/Bogota"}).status_code == 200
    with Session(database.engine) as s:
        rows = s.exec(select(PushDevice).where(PushDevice.user_id == U)).all()
        assert len(rows) == 1 and rows[0].timezone == "America/Bogota"
    assert client.post("/api/push/devices", json={"token": "fcm-token-bbbb", "timezone": "Mars/Base"}).status_code == 400
    assert client.request("DELETE", "/api/push/devices", json={"token": "fcm-token-aaaa"}).status_code == 200
    with Session(database.engine) as s:
        assert s.exec(select(PushDevice).where(PushDevice.user_id == U)).all() == []


def test_a_phone_that_changes_hands_belongs_to_the_last_login(client, fcm):
    login(U)
    client.post("/api/push/devices", json={"token": "shared-phone-1", "timezone": TZ})
    login(V)
    client.post("/api/push/devices", json={"token": "shared-phone-1", "timezone": TZ})
    with Session(database.engine) as s:
        assert s.exec(select(PushDevice).where(PushDevice.fcm_token == "shared-phone-1")).one().user_id == V


def test_preferences_default_on_and_toggle(client, fcm):
    login(U)
    assert client.get("/api/push/preferences").json() == {"enabled": True}
    assert client.put("/api/push/preferences", json={"enabled": False}).json() == {"enabled": False}
    assert client.get("/api/push/preferences").json() == {"enabled": False}
    assert client.get("/api/push/config").json() == {"enabled": True}


def test_no_session_is_401_tokens_403_demo_403(client, fcm):
    for method, url, body in (("POST", "/api/push/devices", {"token": "fcm-token-cccc"}), ("GET", "/api/push/preferences", None),
                              ("PUT", "/api/push/preferences", {"enabled": False})):
        assert client.request(method, url, json=body).status_code == 401
    assert client.get("/api/push/preferences", headers={"Authorization": "Bearer kx_some_ai_token"}).status_code == 403
    login(DEMO_USER_ID)
    assert client.post("/api/push/devices", json={"token": "fcm-token-dddd"}).status_code == 403
    assert client.get("/api/push/config").json() == {"enabled": False}


# ── Engine ───────────────────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_cut_in_two_days_with_the_exact_copy(fcm):
    device()
    acc = card(closing=25)  # DAY = Nov 23 → cuts Nov 25
    stats = await run(9, fcm=fcm)
    assert stats["sent"] == 1
    assert fcm.sent == [{"token": "tok-1", "title": "Corte en 2 días",
                         "body": "Tu tarjeta Visa Oro corta el 25 de noviembre con saldo $430.00. Paga antes del corte y reporta limpio.",
                         "data": {"route": "/dashboard/accounts/manage", "account_id": acc}}]
    assert [(l.kind, l.dedup_key, l.local_date) for l in logs()] == [("corte", f"{acc}:2026-11-25", DAY)]


@pytest.mark.anyio
async def test_no_cut_notice_without_balance_or_on_other_days(fcm):
    device()
    card(closing=25, balance="0.00")
    card(name="Otra", closing=27)
    await run(9, fcm=fcm)
    assert fcm.sent == []


@pytest.mark.anyio
async def test_mission_only_at_8_and_only_when_pending(fcm, monkeypatch):
    device()
    mission(monkeypatch)
    await run(9, fcm=fcm)
    assert fcm.sent == []  # 09:00: the mission's hour passed
    await run(8, fcm=fcm)
    assert [(m["title"], m["body"], m["data"]) for m in fcm.sent] == [
        ("Tu misión de hoy", "Paga $150.00 a Visa Oro. Es el movimiento de hoy.", {"route": "/dashboard"})]
    fcm.sent.clear()
    mission(monkeypatch, tipo="faltante")
    await run(8, day=DAY + timedelta(days=1), fcm=fcm)
    assert fcm.sent == []  # a shortfall is not "pay X to Y"


@pytest.mark.anyio
async def test_one_push_a_day_and_priority_cut_over_mission_over_celebration(fcm, monkeypatch):
    device()
    card(closing=25)
    mission(monkeypatch)
    paid_off()
    await run(8, fcm=fcm)
    assert [m["title"] for m in fcm.sent] == ["Corte en 2 días"]
    for hour in range(9, 22):
        await run(hour, fcm=fcm)
    assert len(fcm.sent) == 1  # the day's push is spent
    fcm.sent.clear()
    await run(10, day=DAY + timedelta(days=1), fcm=fcm)  # next day: the celebration, never the old mission
    assert [m["title"] for m in fcm.sent] == ["¡Deuda saldada! 🎉"]
    assert fcm.sent[0]["body"] == "Tarjeta chica llegó a $0. Una deuda menos."
    assert fcm.sent[0]["data"] == {"route": "/dashboard/action-plan"}


@pytest.mark.anyio
async def test_dedup_never_repeats_a_celebration(fcm):
    device()
    paid_off()
    await run(10, fcm=fcm)
    await run(10, day=DAY + timedelta(days=1), fcm=fcm)
    await run(10, day=DAY + timedelta(days=2), fcm=fcm)
    assert len(fcm.sent) == 1 and len(logs()) == 1


@pytest.mark.anyio
async def test_old_payoffs_are_not_celebrated(fcm):
    device()
    paid_off(when=DAY - timedelta(days=30))
    await run(10, fcm=fcm)
    assert fcm.sent == []


@pytest.mark.anyio
async def test_quiet_hours_in_the_users_own_time_zone(fcm):
    device(tz="Asia/Tokyo")
    card(closing=25)
    for hour in (22, 23, 0, 3, 6):
        await run(hour, fcm=fcm, tz="Asia/Tokyo")
    assert fcm.sent == []
    await run(7, fcm=fcm, tz="Asia/Tokyo")
    assert len(fcm.sent) == 1
    # 07:00 in Tokyo is 16:00 Chicago the day before: the engine used the phone's zone, not the server's


@pytest.mark.anyio
async def test_a_dead_token_is_marked_and_never_used_again(fcm):
    device(token="old-token")
    card(closing=25)
    fcm.result = "dead"
    await run(9, fcm=fcm)
    assert logs() == []  # nothing delivered → nothing spent
    with Session(database.engine) as s:
        assert s.exec(select(PushDevice).where(PushDevice.fcm_token == "old-token")).one().dead_at is not None
    fcm.sent.clear()
    fcm.result = "ok"
    await run(10, fcm=fcm)
    assert fcm.sent == []


@pytest.mark.anyio
async def test_transient_errors_retry_next_hour(fcm):
    device()
    card(closing=25)
    fcm.result = "error"
    await run(9, fcm=fcm)
    assert logs() == []
    fcm.result = "ok"
    await run(10, fcm=fcm)
    assert len(logs()) == 1


@pytest.mark.anyio
async def test_preference_off_means_nothing(fcm, client):
    device()
    card(closing=25)
    login(U)
    client.put("/api/push/preferences", json={"enabled": False})
    await run(9, fcm=fcm)
    assert fcm.sent == [] and logs() == []


@pytest.mark.anyio
async def test_without_firebase_nothing_is_sent_or_recorded(fcm, monkeypatch):
    monkeypatch.delenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    device()
    card(closing=25)
    assert await run(9, fcm=fcm) == {"skipped": "not configured"}
    assert fcm.sent == [] and logs() == []


@pytest.mark.anyio
async def test_every_device_of_the_user_gets_the_one_push(fcm):
    device(token="phone-a")
    device(token="tablet-b")
    card(closing=25)
    await run(9, fcm=fcm)
    assert sorted(m["token"] for m in fcm.sent) == ["phone-a", "tablet-b"] and len(logs()) == 1


def test_the_device_reports_its_app_language(client, fcm):
    login(U)
    for sent, stored in (({}, "es"), ({"language": "en"}, "en"), ({"language": "en-US"}, "en"),
                         ({"language": "ES"}, "es"), ({"language": "fr"}, "es"), ({"language": ""}, "es")):
        assert client.post("/api/push/devices", json={"token": "fcm-token-lang", **sent}).status_code == 200
        with Session(database.engine) as s:
            assert s.exec(select(PushDevice).where(PushDevice.fcm_token == "fcm-token-lang")).one().language == stored, sent


COPY = {
    "corte": {
        "es": ("Corte en 2 días", "Tu tarjeta Visa Oro corta el 25 de noviembre con saldo $430.00. Paga antes del corte y reporta limpio."),
        "en": ("Statement in 2 days", "Your Visa Oro card closes on November 25 with a $430.00 balance. Pay before it closes and report clean."),
    },
    "mision": {
        "es": ("Tu misión de hoy", "Paga $150.00 a Visa Oro. Es el movimiento de hoy."),
        "en": ("Today's mission", "Pay $150.00 to Visa Oro. It's today's move."),
    },
    "celebracion": {
        "es": ("¡Deuda saldada! 🎉", "Tarjeta chica llegó a $0. Una deuda menos."),
        "en": ("Debt paid off! 🎉", "Tarjeta chica hit $0. One less debt."),
    },
}


@pytest.mark.anyio
@pytest.mark.parametrize("language", ["es", "en"])
@pytest.mark.parametrize("kind", ["corte", "mision", "celebracion"])
async def test_each_kind_in_each_language(fcm, monkeypatch, kind, language):
    device(language=language)
    if kind == "corte":
        card(closing=25)
    elif kind == "mision":
        mission(monkeypatch)
    else:
        paid_off()
    await run(9 if kind == "corte" else 8, fcm=fcm)
    assert [(m["title"], m["body"]) for m in fcm.sent] == [COPY[kind][language]]
    assert [l.kind for l in logs()] == [kind]


@pytest.mark.anyio
async def test_each_phone_gets_its_own_language_and_the_cap_still_counts_once(fcm):
    device(token="phone-es", language="es")
    device(token="phone-en", language="en")
    card(closing=25)
    await run(9, fcm=fcm)
    assert {m["token"]: m["title"] for m in fcm.sent} == {"phone-es": "Corte en 2 días", "phone-en": "Statement in 2 days"}
    assert len(logs()) == 1


def test_unknown_language_falls_back_to_spanish():
    cand = {"kind": "celebracion", "vars": {"name": "Visa"}}
    for lang in (None, "", "fr", "pt-BR"):
        assert push_engine.render(cand, lang) == ("¡Deuda saldada! 🎉", "Visa llegó a $0. Una deuda menos.")
    assert set(push_engine.TEMPLATES) == set(push_engine.PRIORITY)
    assert all(set(t) == set(push_engine.LANGUAGES) for t in push_engine.TEMPLATES.values())


def test_the_language_migration_goes_up_and_down():
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    backend = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location("mig_lang", next((backend / "alembic" / "versions").glob("e5a9c3f1b7d2_*.py")))
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    assert mig.down_revision == "d2f7b3c9e4a6"
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE push_devices (id INTEGER PRIMARY KEY, fcm_token VARCHAR NOT NULL)"))
        conn.execute(sa.text("INSERT INTO push_devices (fcm_token) VALUES ('t')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        assert conn.execute(sa.text("SELECT language FROM push_devices")).scalar() == "es"  # old phones: the copy they always got
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        assert {c["name"] for c in sa.inspect(conn).get_columns("push_devices")} == {"id", "fcm_token"}


def test_copy_has_no_assistant_brand():
    src = open(push_engine.__file__, encoding="utf-8").read()
    assert not any(b in src.lower() for b in ("claude", "chatgpt", "gemini", "copilot"))


def test_one_head_and_the_push_migration_goes_up_and_down():
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from alembic.script import ScriptDirectory
    backend = Path(__file__).resolve().parents[1]
    assert len(ScriptDirectory.from_config(Config(str(backend / "alembic.ini"))).get_heads()) == 1  # newer migrations build on c9a4f2e7b815
    spec = importlib.util.spec_from_file_location("mig_push", next((backend / "alembic" / "versions").glob("c9a4f2e7b815_*.py")))
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE user_settings (id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL)"))
        conn.execute(sa.text("INSERT INTO user_settings (user_id) VALUES ('u')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        assert conn.execute(sa.text("SELECT push_enabled FROM user_settings")).scalar() in (1, True)  # on by default
        assert {"push_devices", "push_log"} <= set(sa.inspect(conn).get_table_names())
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        assert set(sa.inspect(conn).get_table_names()) == {"user_settings"}
        assert {c["name"] for c in sa.inspect(conn).get_columns("user_settings")} == {"id", "user_id"}
