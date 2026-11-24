"""Notice e-mails (misión 2026-11-23-correos-notificacion): the e-mail channel of the notice
engine — fail-closed without Resend, dry run with no network, ES/EN parity with push, one notice a
day across channels, provider errors recorded without stopping the engine, the Ajustes switch and
the language/time-zone sync, and the migration."""
import json
import logging
import re
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import Session, select

import database
import email_engine
import helpers
import push_engine
from auth import DEMO_USER_ID, get_current_user_id
from main import app
from models import Account, EmailLog, PushDevice, PushLog, Subscription, Transaction, UserSettings

U = "56565656-5656-4565-a565-565656565656"
V = "78787878-7878-4787-a787-787878787878"
TZ = "America/Chicago"
DAY = date(2026, 11, 23)
ADDRESS = "reviewer@example.com"


def at(hour, day=DAY, tz=TZ):
    from zoneinfo import ZoneInfo
    return datetime(day.year, day.month, day.day, hour, 5, tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)


class Mailer:
    def __init__(self, result=("sent", "re_123")):
        self.sent, self.result = [], result

    async def __call__(self, to, mail):
        self.sent.append({"to": to, **mail})
        return self.result


class FCM:
    def __init__(self, result="ok"):
        self.sent, self.result = [], result

    async def __call__(self, token, title, body, data):
        self.sent.append(title)
        return self.result


async def lookup(user_id):
    return ADDRESS


@pytest.fixture
def env(monkeypatch):
    for k in ("FIREBASE_SERVICE_ACCOUNT_JSON", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_DRY_RUN"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setattr(helpers, "build_daily_mission", lambda *a, **k: {"mision": None})
    yield monkeypatch
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (EmailLog, PushLog, PushDevice, Transaction, Account, UserSettings, Subscription):
            for row in s.exec(select(model).where(model.user_id.in_([U, V, DEMO_USER_ID]))).all():
                s.delete(row)
        s.commit()


def resend(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "re_test_dummy")
    monkeypatch.setenv("EMAIL_FROM", "KoreX <avisos@korexf.com>")


def firebase(monkeypatch):
    monkeypatch.setenv("FIREBASE_SERVICE_ACCOUNT_JSON", json.dumps({"client_email": "f@x.iam", "private_key": "k", "project_id": "korex"}))


def settings(uid=U, email=True, push=True, language="es", tz=TZ):
    with Session(database.engine) as s:
        s.add(UserSettings(user_id=uid, email_enabled=email, push_enabled=push, language=language, timezone=tz))
        s.commit()


def device(uid=U, token="tok-email-1"):
    with Session(database.engine) as s:
        s.add(PushDevice(user_id=uid, fcm_token=token, timezone=TZ))
        s.commit()


def card(uid=U, name="Visa Oro", balance="430.00", closing=25):
    with Session(database.engine) as s:
        a = Account(user_id=uid, name=name, type="debt", balance=Decimal(balance), interest_rate=Decimal("24"),
                    min_payment=Decimal("35"), closing_day=closing, debt_subtype="credit_card")
        s.add(a); s.commit(); s.refresh(a)
        return a.id


def paid_off(uid=U, name="Tarjeta chica"):
    acc = card(uid, name, "0.00", None)
    with Session(database.engine) as s:
        s.add(Transaction(user_id=uid, account_id=acc, date=DAY.isoformat(), amount=Decimal("120"), description="pago", category="payment"))
        s.commit()


def mission(monkeypatch, monto="150.00", cuenta="Visa Oro"):
    monkeypatch.setattr(helpers, "build_daily_mission", lambda *a, **k: {"mision": {
        "tipo": "corte", "cuenta": cuenta, "monto": Decimal(monto), "fecha_accion": DAY}})


def email_rows(uid=U):
    with Session(database.engine) as s:
        return s.exec(select(EmailLog).where(EmailLog.user_id == uid)).all()


def push_rows(uid=U):
    with Session(database.engine) as s:
        return s.exec(select(PushLog).where(PushLog.user_id == uid)).all()


async def run(hour, mail=None, fcm=None, day=DAY):
    return await push_engine.run_once(now=at(hour, day), send=fcm, mail=mail, address=lookup)


# ── 1. Fail-closed and dry run ───────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_without_resend_nothing_runs_and_nothing_is_recorded(env):
    settings(); card()
    mail = Mailer()
    assert await run(9, mail) == {"skipped": "not configured"}
    firebase(env)  # push configured, e-mail not: the engine runs entirely and skips the channel
    stats = await run(9, mail, FCM())
    assert stats["emailed"] == 0 and stats["email_errors"] == 0
    assert mail.sent == [] and email_rows() == []
    env.setenv("RESEND_API_KEY", "re_test_dummy")  # the key without a sender is still not configured
    assert email_engine.configured() is False and email_engine.active() is False


@pytest.mark.anyio
async def test_dry_run_logs_kind_and_language_without_network(env, caplog):
    env.setenv("EMAIL_DRY_RUN", "1")
    import httpx

    class NoNetwork:
        def __init__(self, *a, **k):
            raise AssertionError("dry run must not open a connection")
    env.setattr(httpx, "AsyncClient", NoNetwork)
    settings(language="en"); card()
    mail = Mailer()
    with caplog.at_level(logging.INFO, logger="korex.email"):
        stats = await run(9, mail)
    assert stats["emailed"] == 1 and mail.sent == []
    assert "email dry-run: kind=corte lang=en subject='Your Visa Oro card closes in 2 days'" in caplog.text
    assert ADDRESS not in caplog.text  # the address is never logged
    [row] = email_rows()
    assert (row.kind, row.language, row.status) == ("corte", "en", "dry_run")


# ── 2. ES/EN parity with push ────────────────────────────────────────────────────────

def _fields(*texts):
    return {m for t in texts for m in re.findall(r"{(\w+)}", t)}


def test_parity_every_kind_in_both_languages_with_the_push_variables():
    assert set(email_engine.TEMPLATES) == set(push_engine.TEMPLATES) == set(push_engine.PRIORITY)
    for kind, by_lang in email_engine.TEMPLATES.items():
        assert set(by_lang) == set(push_engine.LANGUAGES) == set(email_engine.FOOTER)
        push_vars = _fields(*push_engine.TEMPLATES[kind]["es"])
        for lang, parts in by_lang.items():
            assert _fields(*parts) == push_vars, (kind, lang)
            assert _fields(*push_engine.TEMPLATES[kind][lang]) == push_vars


@pytest.mark.parametrize("kind,values", [
    ("corte", {"name": "Visa Oro", "fecha": "25 de noviembre", "amount": "$430.00"}),
    ("mision", {"amount": "$150.00", "account": "Visa Oro"}),
    ("celebracion", {"name": "Tarjeta chica"}),
])
@pytest.mark.parametrize("lang", ["es", "en"])
def test_parity_each_mail_renders_with_footer_and_no_leftover_braces(kind, values, lang):
    mail = email_engine.render(kind, lang, values, "/dashboard")
    for part in ("subject", "html", "text"):
        assert not re.search(r"{\w+}", mail[part]), part
    assert email_engine.FOOTER[lang][1] in mail["text"] and email_engine.FOOTER[lang][0] in mail["text"]
    assert "#F59E0B" in mail["html"] and 'lang="%s"' % lang in mail["html"]
    assert not any(w in mail["html"].lower() for w in ("upgrade", "premium", "oferta", "descuento"))


def test_parity_user_text_is_escaped_in_the_html():
    mail = email_engine.render("celebracion", "es", {"name": "<script>x</script>"})
    assert "<script>" not in mail["html"] and "&lt;script&gt;" in mail["html"]


# ── 3. One notice a day across channels ──────────────────────────────────────────────

@pytest.mark.anyio
async def test_dedup_push_covered_the_notice_so_no_email(env):
    firebase(env); resend(env)
    settings(); device(); card()
    mail, fcm = Mailer(), FCM()
    stats = await run(9, mail, fcm)
    assert stats["sent"] == 1 and fcm.sent == ["Corte en 2 días"]
    assert mail.sent == [] and email_rows() == []


@pytest.mark.anyio
async def test_covered_by_email_when_there_is_no_phone_and_never_twice(env):
    resend(env)
    settings(); card()
    mail = Mailer()
    await run(9, mail)
    await run(10, mail)
    assert len(mail.sent) == 1 and mail.sent[0]["to"] == ADDRESS
    assert mail.sent[0]["subject"] == "Tu tarjeta Visa Oro corta en 2 días"
    assert [r.status for r in email_rows()] == ["sent"]


@pytest.mark.anyio
async def test_dedup_a_failed_push_falls_back_to_email_and_push_does_not_repeat_it(env):
    firebase(env); resend(env)
    settings(); device(); card()
    mail = Mailer()
    await run(9, mail, FCM("error"))
    assert len(mail.sent) == 1
    fcm = FCM()
    await run(10, mail, fcm)
    assert fcm.sent == [] and len(mail.sent) == 1 and push_rows() == []


@pytest.mark.anyio
async def test_cap_one_notice_a_day_summing_channels(env):
    firebase(env); resend(env)
    settings(); card()
    mail = Mailer()
    await run(9, mail)  # e-mail (no phone yet): corte
    device(); paid_off()
    fcm = FCM()
    await run(11, mail, fcm)  # a celebration is pending, but the day's notice is spent
    assert fcm.sent == [] and len(mail.sent) == 1
    await run(9, mail, fcm, day=date(2026, 11, 24))  # next day: the phone gets the celebration
    assert fcm.sent == ["¡Deuda saldada! 🎉"]


@pytest.mark.anyio
async def test_cap_quiet_hours_in_the_synced_time_zone(env):
    resend(env)
    settings(tz="Asia/Tokyo"); card()  # 09:05 Chicago = 00:05 next day Tokyo: silence
    mail = Mailer()
    await push_engine.run_once(now=at(9), mail=mail, address=lookup)
    assert mail.sent == []


@pytest.mark.anyio
async def test_cap_priority_and_the_mission_in_english(env):
    resend(env)
    settings(language="en"); mission(env)
    mail = Mailer()
    await run(8, mail)
    assert mail.sent[0]["subject"] == "Today's mission: $150.00 to Visa Oro"
    assert "estimated plan" in mail.sent[0]["text"]


@pytest.mark.anyio
async def test_email_off_demo_and_no_address_get_nothing(env):
    resend(env)
    settings(email=False); card()
    settings(uid=DEMO_USER_ID); card(uid=DEMO_USER_ID)
    mail = Mailer()
    await run(9, mail)
    assert mail.sent == [] and email_rows() == [] and email_rows(DEMO_USER_ID) == []
    settings(uid=V); card(uid=V)

    async def nobody(user_id):
        return None
    stats = await push_engine.run_once(now=at(9), mail=mail, address=nobody)
    assert stats["no_address"] == 1 and mail.sent == [] and email_rows(V) == []


# ── 4. Provider errors ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_provider_error_is_recorded_and_retried_next_hour(env):
    resend(env)
    settings(); card()
    stats = await run(9, Mailer(("error", "http 500 internal_server_error")))
    assert stats["email_errors"] == 1
    [row] = email_rows()
    assert (row.status, row.detail) == ("error", "http 500 internal_server_error")
    ok = Mailer()
    await run(10, ok)
    assert len(ok.sent) == 1 and sorted(r.status for r in email_rows()) == ["error", "sent"]


@pytest.mark.anyio
async def test_provider_error_an_exploding_mailer_never_stops_the_engine(env):
    resend(env)
    settings(); card(); settings(uid=V); card(uid=V)

    async def boom(to, mail):
        raise RuntimeError("provider down")
    stats = await run(9, boom)
    assert stats["email_errors"] == 2
    assert {r.detail for r in email_rows() + email_rows(V)} == {"engine: RuntimeError"}


@pytest.mark.anyio
async def test_provider_error_resend_client_maps_http_answers(env):
    resend(env)
    import httpx

    def client_for(status, body):
        class C:
            def __init__(self, *a, **k): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False
            async def post(self, url, headers, json):
                assert url == email_engine.RESEND_URL and headers["Authorization"] == "Bearer re_test_dummy"
                assert json["from"] == "KoreX <avisos@korexf.com>" and json["to"] == [ADDRESS]
                return httpx.Response(status, json=body)
        return C
    mail = email_engine.render("celebracion", "es", {"name": "X"})
    env.setattr(httpx, "AsyncClient", client_for(200, {"id": "re_abc"}))
    assert await email_engine.resend_send(ADDRESS, mail) == ("sent", "re_abc")
    env.setattr(httpx, "AsyncClient", client_for(422, {"name": "validation_error"}))
    assert await email_engine.resend_send(ADDRESS, mail) == ("error", "http 422 validation_error")


# ── 5. Ajustes: preference and profile sync ──────────────────────────────────────────

def login(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def test_email_preferences_default_on_toggle_and_profile_sync(client, env):
    login(U)
    assert client.get("/api/push/email").json() == {"enabled": True}
    assert client.put("/api/push/email", json={"enabled": False}).json() == {"enabled": False}
    assert client.get("/api/push/email").json() == {"enabled": False}
    assert client.put("/api/push/profile", json={"language": "en-US", "timezone": "America/Bogota"}).json() == \
        {"language": "en", "timezone": "America/Bogota"}
    assert client.put("/api/push/profile", json={"language": "fr", "timezone": "Mars/Base"}).status_code == 400
    with Session(database.engine) as s:
        row = s.exec(select(UserSettings).where(UserSettings.user_id == U)).one()
        assert (row.email_enabled, row.language, row.timezone, row.push_enabled) == (False, "en", "America/Bogota", True)


def test_email_preferences_need_a_session(client, env):
    for method, url, body in (("GET", "/api/push/email", None), ("PUT", "/api/push/email", {"enabled": False}),
                              ("PUT", "/api/push/profile", {"language": "es"})):
        assert client.request(method, url, json=body).status_code == 401
    assert client.get("/api/push/email", headers={"Authorization": "Bearer kx_some_ai_token"}).status_code == 403


# ── 6. Migration ─────────────────────────────────────────────────────────────────────

def test_email_migration_one_head_up_and_down():
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from alembic.script import ScriptDirectory
    backend = Path(__file__).resolve().parents[1]
    assert ScriptDirectory.from_config(Config(str(backend / "alembic.ini"))).get_heads() == ["a7d4e2c9f1b3"]
    spec = importlib.util.spec_from_file_location("mig_email", next((backend / "alembic" / "versions").glob("a7d4e2c9f1b3_*.py")))
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)
    assert mig.down_revision == "e5a9c3f1b7d2"
    assert "ENABLE ROW LEVEL SECURITY" in Path(spec.origin).read_text(encoding="utf-8")
    engine = sa.create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE user_settings (id INTEGER PRIMARY KEY, user_id VARCHAR NOT NULL)"))
        conn.execute(sa.text("INSERT INTO user_settings (user_id) VALUES ('u')"))
        with Operations.context(MigrationContext.configure(conn)):
            mig.upgrade()
        row = conn.execute(sa.text("SELECT email_enabled, language, timezone FROM user_settings")).one()
        assert (bool(row[0]), row[1], row[2]) == (True, "es", None)  # on by default, Spanish, zone unknown
        assert "email_log" in sa.inspect(conn).get_table_names()
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mig.downgrade()
        assert set(sa.inspect(conn).get_table_names()) == {"user_settings"}
        assert {c["name"] for c in sa.inspect(conn).get_columns("user_settings")} == {"id", "user_id"}
