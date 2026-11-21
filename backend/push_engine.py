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

Fail-closed: without FIREBASE_SERVICE_ACCOUNT_JSON nothing is sent (and nothing is recorded).
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
from models import Account, PushDevice, PushLog, Transaction, UserSettings

logger = logging.getLogger("korex.push")

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
DEFAULT_TZ = "America/Chicago"
QUIET_FROM, QUIET_UNTIL = 22, 7      # 22:00–07:00 local: never
MISSION_HOUR = 8
PRIORITY = {"corte": 0, "mision": 1, "celebracion": 2}
MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
             "noviembre", "diciembre"]


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


def _fecha(d: date) -> str:
    return f"{d.day} de {MONTHS_ES[d.month - 1]}"


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
                                               "android": {"priority": "high"}}})
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
    for a in debts:
        if a.closing_day and Decimal(str(a.balance or 0)) > 0 and _cut_date(int(a.closing_day), in_two):
            out.append({"kind": "corte", "key": f"{a.id}:{in_two.isoformat()}", "title": "Corte en 2 días",
                        "body": f"Tu tarjeta {a.name} corta el {_fecha(in_two)} con saldo {_usd(a.balance)}. "
                                "Paga antes del corte y reporta limpio.",
                        "data": {"route": "/dashboard/accounts/manage", "account_id": a.id}})

    if hour == MISSION_HOUR:
        try:
            mission = build_daily_mission(s, user_id, accounts, limit, today=today)["mision"]
        except Exception:
            logger.exception("push: mission unavailable for a user")
            mission = None
        if mission and mission.get("tipo") != "faltante" and Decimal(str(mission.get("monto") or 0)) > 0 \
                and mission.get("fecha_accion", today) <= today:
            out.append({"kind": "mision", "key": today.isoformat(), "title": "Tu misión de hoy",
                        "body": f"Paga {_usd(mission['monto'])} a {mission['cuenta']}. Es el movimiento de hoy.",
                        "data": {"route": "/dashboard"}})

    if hour >= MISSION_HOUR:
        since = (today - timedelta(days=7)).isoformat()
        for a in accounts:
            if a.type != "debt" or Decimal(str(a.balance or 0)) > 0:
                continue
            paid_recently = s.exec(select(Transaction.id).where(Transaction.user_id == user_id, Transaction.account_id == a.id,
                                                               Transaction.date >= since)).first()
            if paid_recently:
                out.append({"kind": "celebracion", "key": str(a.id), "title": "¡Deuda saldada! 🎉",
                            "body": f"{a.name} llegó a $0. Una deuda menos.", "data": {"route": "/dashboard/action-plan"}})
    return out


# ── One hourly run ───────────────────────────────────────────────────────────────────

async def run_once(now: Optional[datetime] = None, send: Optional[Sender] = None) -> dict:
    if not configured():
        return {"skipped": "not configured"}
    send = send or fcm_send
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    stats = {"sent": 0, "dead": 0, "users": 0}
    with Session(database.engine) as s:
        devices = s.exec(select(PushDevice).where(PushDevice.dead_at == None)).all()  # noqa: E711
        by_user: dict[str, list[PushDevice]] = {}
        for d in devices:
            by_user.setdefault(d.user_id, []).append(d)
        for user_id, devs in by_user.items():
            stats["users"] += 1
            settings = s.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
            if settings is not None and not settings.push_enabled:
                continue
            latest = max(devs, key=lambda d: d.last_seen_at)
            local = now.astimezone(_tz(latest.timezone))
            today, hour = local.date(), local.hour
            if hour >= QUIET_FROM or hour < QUIET_UNTIL:
                continue
            if s.exec(select(PushLog.id).where(PushLog.user_id == user_id, PushLog.local_date == today)).first():
                continue  # the day's one push is spent
            for cand in sorted(candidates(s, user_id, today, hour), key=lambda c: PRIORITY[c["kind"]]):
                if s.exec(select(PushLog.id).where(PushLog.user_id == user_id, PushLog.kind == cand["kind"],
                                                   PushLog.dedup_key == cand["key"])).first():
                    continue
                delivered = False
                for d in devs:
                    result = await send(d.fcm_token, cand["title"], cand["body"], cand["data"])
                    if result == "ok":
                        delivered = True
                    elif result == "dead":
                        d.dead_at = datetime.utcnow()
                        s.add(d)
                        stats["dead"] += 1
                if delivered:
                    s.add(PushLog(user_id=user_id, kind=cand["kind"], dedup_key=cand["key"], local_date=today))
                    stats["sent"] += 1
                s.commit()
                break  # one candidate per run: the top one (or a retry next hour)
    logger.info(f"push run: {stats}")
    return stats


async def loop() -> None:
    """Every hour, a couple of minutes past the hour."""
    while True:
        now = datetime.now(timezone.utc)
        nxt = (now + timedelta(hours=1)).replace(minute=2, second=0, microsecond=0)
        await asyncio.sleep(max(60.0, (nxt - now).total_seconds()))
        try:
            await run_once()
        except Exception:
            logger.exception("push run failed")
