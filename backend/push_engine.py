"""
Push notices (Android, Firebase Cloud Messaging). The backend decides and sends; the app only
registers its token (routers/push.py) and shows what arrives.

Runs every hour (loop(), started by main.py only when configured) and, per user, in THE USER'S
OWN time zone (the one their phone reported):
  corte        a card of theirs cuts in 2 days with balance > 0          (07:00–21:59, one per card+cut)
  mision       today's mission is still pending                          (08:00 only)
  celebracion  a debt reached $0 (paid down in the last 7 days)          (08:00–21:59, once per debt)
Anti-spam, always: at most 1 push per user per local day across every kind (priority
corte > mision > celebracion); dedup by (user, kind, key); silence 22:00–07:00; tokens FCM calls
invalid are marked dead and never used again; the user's on/off preference wins.

Copy: TEMPLATES, one per kind in Spanish and English; each device gets the language its app
reported when it registered (routers/push.py), Spanish when it reported none.

Fail-closed: without FIREBASE_SERVICE_ACCOUNT_JSON no push is sent (and nothing is recorded).

E-mail (email_engine.py): whoever push did not cover gets the same notice by e-mail when
user_settings.email_enabled; the 1-a-day cap, quiet hours and dedup count both channels.
Without RESEND_API_KEY + EMAIL_FROM (and no EMAIL_DRY_RUN) the e-mail channel is skipped.
"""
import asyncio
import calendar
import json
import logging
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Awaitable, Callable, Optional
from zoneinfo import ZoneInfo

import httpx
from sqlmodel import Session, select

import database
import email_engine
from auth import DEMO_USER_ID
from models import Account, EmailLog, PushDevice, PushLog, Transaction, UserSettings

logger = logging.getLogger("korex.push")

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
DEFAULT_TZ = "America/Chicago"
QUIET_FROM, QUIET_UNTIL = 22, 7      # 22:00–07:00 local: never
MISSION_HOUR = 8
ANDROID_CHANNEL = "korex_avisos"  # created by the app (MainActivity): "Avisos de KoreX", high importance
PRIORITY = {"corte": 0, "mision": 1, "celebracion": 2}
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]
MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
             "November", "December"]
LANGUAGES = ("es", "en")
DEFAULT_LANGUAGE = "es"

# Copy per kind and language: same variables, same tone. {fecha} is rendered per language.
TEMPLATES = {
    "corte": {
        "es": ("Corte en 2 días", "Tu tarjeta {name} corta el {fecha} con saldo {amount}. Paga antes del corte y reporta limpio."),
        "en": ("Statement in 2 days", "Your {name} card closes on {fecha} with a {amount} balance. Pay before it closes and report clean."),
    },
    "mision": {
        "es": ("Tu misión de hoy", "Paga {amount} a {account}. Es el movimiento de hoy."),
        "en": ("Today's mission", "Pay {amount} to {account}. It's today's move."),
    },
    "celebracion": {
        "es": ("¡Deuda saldada! 🎉", "{name} llegó a $0. Una deuda menos."),
        "en": ("Debt paid off! 🎉", "{name} hit $0. One less debt."),
    },
}


def service_account() -> Optional[dict]:
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON")  # never log the value
        return None
    return info if info.get("client_email") and info.get("private_key") and info.get("project_id") else None


def configured() -> bool:
    return service_account() is not None


def _usd(x) -> str:
    return f"${Decimal(str(x)).quantize(Decimal('0.01')):,.2f}"


def _fecha(d: date, language: str = DEFAULT_LANGUAGE) -> str:
    if language == "en":
        return f"{MONTHS_EN[d.month - 1]} {d.day}"
    return f"{d.day} de {MONTHS_ES[d.month - 1]}"


def normalize_language(value: Optional[str]) -> str:
    """'en', 'en-US', 'EN_gb' → 'en'; anything else (or nothing) → 'es'."""
    code = (value or "").strip().lower().replace("_", "-").split("-")[0]
    return code if code in LANGUAGES else DEFAULT_LANGUAGE


def values_for(cand: dict, language: str) -> dict:
    """The candidate's template variables, with the date written in `language`."""
    values = dict(cand["vars"])
    if "fecha" in values:
        values["fecha"] = _fecha(values["fecha"], language)
    return values


def render(cand: dict, language: Optional[str]) -> tuple[str, str]:
    """(title, body) of a candidate in the device's language; unknown or missing → Spanish."""
    lang = normalize_language(language)
    title, body = TEMPLATES[cand["kind"]][lang]
    return title, body.format(**values_for(cand, lang))


def _tz(name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


# ── FCM ──────────────────────────────────────────────────────────────────────────────

async def fcm_send(token: str, title: str, body: str, data: dict) -> str:
    """'ok' | 'dead' (token invalid: never again) | 'error' (try again next hour)."""
    info = service_account()
    if info is None:
        return "error"
    from routers.google_play import _access_token  # same service-account flow, FCM scope
    try:
        access = await _access_token(info, FCM_SCOPE)
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(f"https://fcm.googleapis.com/v1/projects/{info['project_id']}/messages:send",
                             headers={"Authorization": f"Bearer {access}"},
                             json={"message": {"token": token, "notification": {"title": title, "body": body},
                                               "data": {k: str(v) for k, v in data.items()},
                                               "android": {"priority": "high",
                                               "notification": {"channel_id": ANDROID_CHANNEL}}}})
    except Exception:
        return "error"
    if r.status_code == 200:
        return "ok"
    status = ""
    try:
        details = r.json().get("error", {}).get("details", [])
        status = next((d.get("errorCode", "") for d in details if d.get("errorCode")), "")
    except Exception:
        pass
    if r.status_code == 404 or status in ("UNREGISTERED", "INVALID_ARGUMENT"):
        return "dead"
    return "error"


Sender = Callable[[str, str, str, dict], Awaitable[str]]


# ── What each user could get now ─────────────────────────────────────────────────────

def _cut_date(closing_day: int, on: date) -> bool:
    return on.day == min(closing_day, calendar.monthrange(on.year, on.month)[1])


def candidates(s: Session, user_id: str, today: date, hour: int) -> list[dict]:
    from helpers import build_daily_mission, filter_active_debt_accounts
    from plan_guard import plan_limit_for
    accounts = s.exec(select(Account).where(Account.user_id == user_id)).all()
    limit = plan_limit_for(s, user_id)
    debts = filter_active_debt_accounts(accounts, limit)
    out: list[dict] = []

    in_two = today + timedelta(days=2)
    cutting = [a for a in debts if a.closing_day and Decimal(str(a.balance or 0)) > 0 and _cut_date(int(a.closing_day), in_two)]
    result = None
    if cutting or hour == MISSION_HOUR:
        try:
            result = build_daily_mission(s, user_id, accounts, limit, today=today)
        except Exception:
            logger.exception("push: mission unavailable for a user")
    # The cut notice says what the MISSION reserves for that cut (misión 17, N-14). A card the cash
    # cannot leave at $0 (D2) gets no "report clean" notice: its minimum is the mission's job.
    cortes = {o["cuenta"]: o for o in (result or {}).get("obligaciones", [])
              if o["tipo"] == "corte" and o["fecha_evento"] == in_two}
    for a in cutting:
        o = cortes.get(a.name)
        if o is None:
            continue
        out.append({"kind": "corte", "key": f"{a.id}:{in_two.isoformat()}",
                    "vars": {"name": a.name, "fecha": in_two, "amount": _usd(o["monto"])},
                    "data": {"route": "/dashboard/accounts/manage", "account_id": a.id}})

    if hour == MISSION_HOUR:
        mission = (result or {}).get("mision")
        if mission and mission.get("tipo") != "faltante" and Decimal(str(mission.get("monto") or 0)) > 0 \
                and mission.get("fecha_accion", today) <= today:
            out.append({"kind": "mision", "key": today.isoformat(),
                        "vars": {"amount": _usd(mission["monto"]), "account": mission["cuenta"]},
                        "data": {"route": "/dashboard"}})

    if hour >= MISSION_HOUR:
        since = (today - timedelta(days=7)).isoformat()
        for a in accounts:
            if a.type != "debt" or Decimal(str(a.balance or 0)) > 0:
                continue
            paid_recently = s.exec(select(Transaction.id).where(Transaction.user_id == user_id, Transaction.account_id == a.id,
                                                               Transaction.date >= since)).first()
            if paid_recently:
                out.append({"kind": "celebracion", "key": str(a.id), "vars": {"name": a.name}, "data": {"route": "/dashboard/action-plan"}})
    return out


# ── One hourly run ───────────────────────────────────────────────────────────────────

def _spent_today(s: Session, user_id: str, today: date) -> bool:
    """The day's one notice is spent, whatever channel carried it."""
    if s.exec(select(PushLog.id).where(PushLog.user_id == user_id, PushLog.local_date == today)).first():
        return True
    return s.exec(select(EmailLog.id).where(EmailLog.user_id == user_id, EmailLog.local_date == today,
                                            EmailLog.status.in_(email_engine.COUNTED))).first() is not None


def _already_notified(s: Session, user_id: str, cand: dict) -> bool:
    """Dedup across channels: this (kind, key) already reached the user by push or e-mail."""
    if s.exec(select(PushLog.id).where(PushLog.user_id == user_id, PushLog.kind == cand["kind"],
                                       PushLog.dedup_key == cand["key"])).first():
        return True
    return s.exec(select(EmailLog.id).where(EmailLog.user_id == user_id, EmailLog.kind == cand["kind"],
                                            EmailLog.dedup_key == cand["key"],
                                            EmailLog.status.in_(email_engine.COUNTED))).first() is not None


async def run_once(now: Optional[datetime] = None, send: Optional[Sender] = None,
                   mail: Optional[email_engine.Mailer] = None,
                   address: Optional[email_engine.AddressLookup] = None) -> dict:
    """One evaluation of every user. Channel per user: push when they have a live phone and push
    on; e-mail when email_enabled and push did not cover the notice. One notice a day in total."""
    push_on, email_on = configured(), email_engine.active()
    if not push_on and not email_on:
        return {"skipped": "not configured"}
    send = send or fcm_send
    address = address or email_engine.auth_address
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    stats = {"sent": 0, "dead": 0, "users": 0, "emailed": 0, "email_errors": 0}
    with Session(database.engine) as s:
        by_user: dict[str, list[PushDevice]] = {}
        if push_on:
            for d in s.exec(select(PushDevice).where(PushDevice.dead_at == None)).all():  # noqa: E711
                by_user.setdefault(d.user_id, []).append(d)
        if email_on:
            for uid in s.exec(select(UserSettings.user_id).where(UserSettings.email_enabled == True)).all():  # noqa: E712
                by_user.setdefault(uid, [])
        for user_id, devs in by_user.items():
            if user_id == DEMO_USER_ID:
                continue
            stats["users"] += 1
            settings = s.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
            push_ok = push_on and bool(devs) and (settings is None or settings.push_enabled)
            email_ok = email_on and settings is not None and settings.email_enabled
            if not push_ok and not email_ok:
                continue
            tz_name = max(devs, key=lambda d: d.last_seen_at).timezone if devs else settings.timezone
            local = now.astimezone(_tz(tz_name))
            today, hour = local.date(), local.hour
            if hour >= QUIET_FROM or hour < QUIET_UNTIL:
                continue
            if _spent_today(s, user_id, today):
                continue  # the day's one notice is spent, by either channel
            for cand in sorted(candidates(s, user_id, today, hour), key=lambda c: PRIORITY[c["kind"]]):
                if _already_notified(s, user_id, cand):
                    continue
                delivered = False
                if push_ok:
                    for d in devs:
                        title, body = render(cand, d.language)  # each phone in its own app language
                        result = await send(d.fcm_token, title, body, cand["data"])
                        if result == "ok":
                            delivered = True
                        elif result == "dead":
                            d.dead_at = datetime.utcnow()
                            s.add(d)
                            stats["dead"] += 1
                    if delivered:
                        s.add(PushLog(user_id=user_id, kind=cand["kind"], dedup_key=cand["key"], local_date=today))
                        stats["sent"] += 1
                if not delivered and email_ok:
                    await _email(s, user_id, cand, settings, today, stats, mail, address)
                s.commit()
                break  # one candidate per run: the top one (or a retry next hour)
    logger.info(f"notice run: {stats}")
    return stats


async def _email(s: Session, user_id: str, cand: dict, settings: UserSettings, today: date, stats: dict,
                 mail: Optional[email_engine.Mailer], address: email_engine.AddressLookup) -> None:
    """The e-mail channel for one candidate. Never raises: a provider error is an email_log row."""
    lang = normalize_language(settings.language)
    try:
        to = None if email_engine.dry_run() else await address(user_id)
        if not email_engine.dry_run() and not to:
            stats.setdefault("no_address", 0)
            stats["no_address"] += 1
            return  # no known address: nothing to send, nothing to record
        status, detail = await email_engine.deliver(cand["kind"], lang, values_for(cand, lang),
                                                    cand["data"].get("route", "/dashboard"), to, mail)
    except Exception as e:
        status, detail = "error", f"engine: {type(e).__name__}"
    s.add(EmailLog(user_id=user_id, kind=cand["kind"], dedup_key=cand["key"], language=lang,
                   status=status, detail=detail, local_date=today))
    if status == "error":
        stats["email_errors"] += 1
        logger.warning(f"email: {cand['kind']} failed ({detail})")
    else:
        stats["emailed"] += 1


async def loop() -> None:
    """Every hour, a couple of minutes past the hour."""
    while True:
        now = datetime.now(timezone.utc)
        nxt = (now + timedelta(hours=1)).replace(minute=2, second=0, microsecond=0)
        await asyncio.sleep(max(60.0, (nxt - now).total_seconds()))
        try:
            await run_once()
        except Exception:
            logger.exception("notice run failed")
