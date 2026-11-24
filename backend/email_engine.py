"""
Notice e-mails: the second channel of the notice engine (push_engine.run_once decides WHO gets
WHAT and WHEN; this module only renders and delivers the e-mail).

The engine e-mails a user only when push did not cover the notice (no live phone, push off, or
the push failed) and the user keeps `user_settings.email_enabled`. Caps, quiet hours, priority
and dedup are the push ones, counted across both channels (push_log + email_log).

Provider: Resend over plain HTTP.
  RESEND_API_KEY  the key (Railway). Without it the channel is skipped: nothing sent, nothing logged.
  EMAIL_FROM      the sender, e.g. "KoreX <avisos@korexf.com>" (a verified korexf.com domain).
  EMAIL_DRY_RUN=1 render and log each e-mail (kind + language), with NO network call. Recorded in
                  email_log as status=dry_run so the cap and the dedup behave as in production.
Provider errors are recorded in email_log (status=error) and never stop the engine.
The address is read from Supabase Auth at send time and is never logged.
"""
import html
import logging
import os
from typing import Awaitable, Callable, Optional

import httpx

logger = logging.getLogger("korex.email")

RESEND_URL = "https://api.resend.com/emails"
TIMEOUT = 15.0
COUNTED = ("sent", "dry_run")  # statuses that spend the day's notice and the dedup key

# Same kinds and the same variables as push_engine.TEMPLATES (a parity test keeps them aligned).
# (subject, heading, body, button). Sober: inform, never sell.
TEMPLATES = {
    "corte": {
        "es": ("Tu tarjeta {name} corta en 2 días", "Corte en 2 días",
               "Tu tarjeta {name} corta el {fecha} con un saldo estimado de {amount}. Si la pagas antes del corte, reporta limpio.",
               "Ver mis cuentas"),
        "en": ("Your {name} card closes in 2 days", "Statement in 2 days",
               "Your {name} card closes on {fecha} with an estimated balance of {amount}. Pay it before it closes and it reports clean.",
               "See my accounts"),
    },
    "mision": {
        "es": ("Tu misión de hoy: {amount} a {account}", "Tu misión de hoy",
               "Paga {amount} a {account}. Es el movimiento de hoy según tu plan estimado.",
               "Abrir mi plan"),
        "en": ("Today's mission: {amount} to {account}", "Today's mission",
               "Pay {amount} to {account}. It's today's move in your estimated plan.",
               "Open my plan"),
    },
    "celebracion": {
        "es": ("Deuda saldada: {name} llegó a $0", "¡Deuda saldada!",
               "{name} llegó a $0. Una deuda menos en tu camino.",
               "Ver mi progreso"),
        "en": ("Debt paid off: {name} hit $0", "Debt paid off!",
               "{name} hit $0. One less debt on your way.",
               "See my progress"),
    },
}

FOOTER = {
    "es": ("Las cifras son estimaciones de KoreX, no asesoría financiera.",
           "Puedes desactivar estos correos en Ajustes → Notificaciones."),
    "en": ("Figures are KoreX estimates, not financial advice.",
           "You can turn these e-mails off in Settings → Notifications."),
}

# Brand: slate ink on white, amber accent (brand-design-system).
INK, INK2, LINE, AMBER, BG = "#0F172A", "#475569", "#E2E8F0", "#F59E0B", "#F8FAFC"


def api_key() -> str:
    return os.getenv("RESEND_API_KEY", "").strip()


def sender() -> str:
    return os.getenv("EMAIL_FROM", "").strip()


def dry_run() -> bool:
    return os.getenv("EMAIL_DRY_RUN", "").strip().lower() in ("1", "true", "yes")


def configured() -> bool:
    """Real sending: the key AND the sender."""
    return bool(api_key() and sender())


def active() -> bool:
    """Whether the engine evaluates the e-mail channel at all."""
    return dry_run() or configured()


def _app_url(route: str) -> str:
    base = os.getenv("FRONTEND_URL", "https://korexf.com").rstrip("/")
    return f"{base}{route if route.startswith('/') else '/' + route}"


def render(kind: str, language: str, values: dict, route: str = "/dashboard") -> dict:
    """{"subject", "html", "text"} for one notice. `values` are already formatted strings
    (push_engine renders money and dates per language); user text is HTML-escaped."""
    subject, heading, body, button = TEMPLATES[kind][language]
    subject, heading, body = subject.format(**values), heading.format(**values), body.format(**values)
    url = _app_url(route)
    legal, optout = FOOTER[language]
    esc = html.escape
    page = f"""<!doctype html>
<html lang="{language}"><body style="margin:0;padding:0;background:{BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid {LINE};border-radius:12px;">
<tr><td style="padding:20px 28px;border-bottom:3px solid {AMBER};font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:{INK};">KoreX</td></tr>
<tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:{INK};">{esc(heading)}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:{INK2};">{esc(body)}</p>
<a href="{esc(url)}" style="display:inline-block;background:{AMBER};color:{INK};text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px;">{esc(button)}</a>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid {LINE};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:{INK2};">{esc(legal)}<br>{esc(optout)}</td></tr>
</table></td></tr></table></body></html>"""
    text = f"{heading}\n\n{body}\n\n{button}: {url}\n\n--\n{legal}\n{optout}\n"
    return {"subject": subject, "html": page, "text": text}


async def resend_send(to: str, mail: dict) -> tuple[str, Optional[str]]:
    """('sent', provider id) | ('error', short reason). Never raises."""
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.post(RESEND_URL, headers={"Authorization": f"Bearer {api_key()}"},
                             json={"from": sender(), "to": [to], "subject": mail["subject"],
                                   "html": mail["html"], "text": mail["text"]})
    except Exception as e:
        return "error", f"network: {type(e).__name__}"
    if r.status_code in (200, 201):
        try:
            return "sent", str(r.json().get("id", ""))[:200] or None
        except Exception:
            return "sent", None
    name = ""
    try:
        name = str(r.json().get("name", ""))
    except Exception:
        pass
    return "error", f"http {r.status_code} {name}".strip()[:200]


Mailer = Callable[[str, dict], Awaitable[tuple[str, Optional[str]]]]
AddressLookup = Callable[[str], Awaitable[Optional[str]]]


async def auth_address(user_id: str) -> Optional[str]:
    """The user's e-mail from Supabase Auth (service role), or None when unavailable."""
    import supabase_admin
    if not supabase_admin.configured():
        return None
    try:
        user = await supabase_admin.get_auth_user(user_id)
    except Exception:
        logger.warning("email: auth lookup failed for a user")
        return None
    return (user or {}).get("email") or None


async def deliver(kind: str, language: str, values: dict, route: str, address: Optional[str],
                  mail: Optional[Mailer] = None) -> tuple[str, Optional[str]]:
    """Render and send (or, in dry run, only log). Returns (status, detail) for email_log."""
    rendered = render(kind, language, values, route)
    if dry_run():
        logger.info(f"email dry-run: kind={kind} lang={language} subject={rendered['subject']!r}")
        return "dry_run", None
    if not address:
        return "error", "no address"
    return await (mail or resend_send)(address, rendered)
