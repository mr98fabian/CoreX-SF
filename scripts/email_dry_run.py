#!/usr/bin/env python3
"""
Dry run of the notice e-mails (misión 2026-11-23-correos-notificacion): one engine run with
EMAIL_DRY_RUN=1 on an in-memory database, per event and language, and the rendered e-mail.
No network, no real database, no address.

  python scripts/email_dry_run.py           # subject + text of the 3 events × ES/EN
  python scripts/email_dry_run.py --html    # also writes each HTML to scripts/out/email-<kind>-<lang>.html
"""
import asyncio
import logging
import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
os.environ.update(DATABASE_URL="sqlite://", ENVIRONMENT="development", EMAIL_DRY_RUN="1", PYTHONIOENCODING="utf-8")
for k in ("FIREBASE_SERVICE_ACCOUNT_JSON", "RESEND_API_KEY", "EMAIL_FROM"):
    os.environ.pop(k, None)
sys.path.insert(0, str(ROOT / "backend"))
os.chdir(ROOT / "backend")

import httpx  # noqa: E402


class NoNetwork:
    def __init__(self, *a, **k):
        raise AssertionError("dry run opened a network connection")


httpx.AsyncClient = NoNetwork  # proof: any HTTP call would blow up

from sqlmodel import Session, SQLModel  # noqa: E402

import database  # noqa: E402
import email_engine  # noqa: E402
import helpers  # noqa: E402
import push_engine  # noqa: E402
from models import Account, Transaction, UserSettings  # noqa: E402

DAY = date(2026, 11, 23)
TZ = "America/Chicago"
EVENTS = {"corte": 9, "mision": 8, "celebracion": 9}


def seed(n: int, kind: str, lang: str) -> str:
    uid = f"{n:08d}-0000-4000-a000-{n:012d}"
    with Session(database.engine) as s:
        s.add(UserSettings(user_id=uid, language=lang, timezone=TZ))
        if kind == "corte":
            s.add(Account(user_id=uid, name="Visa Oro", type="debt", balance=Decimal("430.00"), interest_rate=Decimal("24"),
                          min_payment=Decimal("35"), closing_day=25, debt_subtype="credit_card"))
        if kind == "celebracion":
            a = Account(user_id=uid, name="Tarjeta chica", type="debt", balance=Decimal("0"), interest_rate=Decimal("24"),
                        min_payment=Decimal("0"), debt_subtype="credit_card")
            s.add(a); s.commit(); s.refresh(a)
            s.add(Transaction(user_id=uid, account_id=a.id, date=DAY.isoformat(), amount=Decimal("120"),
                              description="pago", category="payment"))
        s.commit()
    return uid


async def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8", errors="replace")
    SQLModel.metadata.create_all(database.engine)
    logging.basicConfig(level=logging.INFO, format="%(name)s %(message)s", stream=sys.stdout)
    logging.getLogger("korex.push").setLevel(logging.WARNING)
    write_html = "--html" in sys.argv
    out = ROOT / "scripts" / "out"
    rendered: list[dict] = []
    real_render = email_engine.render
    email_engine.render = lambda *a, **k: rendered.append(real_render(*a, **k)) or rendered[-1]
    n = 0
    for kind, hour in EVENTS.items():
        for lang in ("es", "en"):
            n += 1
            with Session(database.engine) as s:
                for model in (Transaction, Account, UserSettings):
                    for row in s.query(model).all():
                        s.delete(row)
                s.commit()
            seed(n, kind, lang)
            mission = {"tipo": "corte", "cuenta": "Visa Oro", "monto": Decimal("150.00"), "fecha_accion": DAY} if kind == "mision" else None
            helpers.build_daily_mission = lambda *a, _m=mission, **k: {"mision": _m}
            now = datetime(DAY.year, DAY.month, DAY.day, hour, 5, tzinfo=ZoneInfo(TZ)).astimezone(timezone.utc)
            stats = await push_engine.run_once(now=now)
            assert stats["emailed"] == 1, stats
            mail = rendered[-1]
            print(f"\n=== {kind} / {lang} ===\nSubject: {mail['subject']}\n{mail['text']}")
            if write_html:
                out.mkdir(exist_ok=True)
                (out / f"email-{kind}-{lang}.html").write_text(mail["html"], encoding="utf-8")
    print("dry run OK: 6 e-mails, 0 network calls")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
