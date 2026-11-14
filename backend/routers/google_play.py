"""
KoreX — Google Play Billing (Android build sold through Play).

The client never grants the plan: the app sends the purchase token, this router reads the
subscription from the Play Developer API (purchases.subscriptionsv2.get) with a service
account and only then writes the SAME Subscription row Lemon writes (plan `freedom`,
plan_guard.entitlement() reads it unchanged). RTDN (Pub/Sub push) keeps it current.

Config is read at request time; without it every endpoint answers 503, like checkout
without its Lemon variant. Secrets come from env vars only and are never logged.
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  service-account key JSON (androidpublisher scope)
  GOOGLE_PLAY_PACKAGE_NAME          default com.korexf.app
  GOOGLE_PLAY_PRODUCT_ID            default korex_annual
  GOOGLE_RTDN_AUDIENCE              audience of the Pub/Sub push OIDC token
"""
import base64, json, logging, os, time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from auth import get_current_user_id
from database import get_session
from models import Subscription
from plan_guard import _parse_ts

logger = logging.getLogger("korex.google_play")
router = APIRouter(prefix="/api/subscriptions/google", tags=["subscriptions"])

PAID_PLAN = "freedom"  # the one plan sold, same key Lemon grants
API_BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
GOOGLE_CERTS = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

# RTDN subscriptionNotification.notificationType
RTDN_TYPES = {1: "RECOVERED", 2: "RENEWED", 3: "CANCELED", 4: "PURCHASED", 5: "ON_HOLD", 6: "IN_GRACE_PERIOD",
              7: "RESTARTED", 8: "PRICE_CHANGE_CONFIRMED", 9: "DEFERRED", 10: "PAUSED", 11: "PAUSE_SCHEDULE_CHANGED",
              12: "REVOKED", 13: "EXPIRED", 20: "PENDING_PURCHASE_CANCELED"}


def _package() -> str:
    return os.getenv("GOOGLE_PLAY_PACKAGE_NAME", "").strip() or "com.korexf.app"


def _product() -> str:
    return os.getenv("GOOGLE_PLAY_PRODUCT_ID", "").strip() or "korex_annual"


def _service_account() -> Optional[dict]:
    raw = os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return None
    try:
        info = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON")  # never log the value
        return None
    return info if info.get("client_email") and info.get("private_key") else None


def _require_config() -> dict:
    info = _service_account()
    if info is None:
        raise HTTPException(status_code=503, detail="Google Play billing isn't available yet.")
    return info


# ── Play Developer API (the only network calls; tests replace these two) ────────────

_token_cache: dict = {}


async def _access_token(info: dict) -> str:
    cached = _token_cache.get(info["client_email"])
    if cached and cached[1] > time.time() + 60:
        return cached[0]
    now = int(time.time())
    token_uri = info.get("token_uri") or "https://oauth2.googleapis.com/token"
    assertion = jwt.encode({"iss": info["client_email"], "scope": SCOPE, "aud": token_uri, "iat": now, "exp": now + 3600},
                           info["private_key"], algorithm="RS256")
    async with httpx.AsyncClient() as client:
        resp = await client.post(token_uri, timeout=15.0, data={
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion})
    if resp.status_code != 200:
        logger.error(f"Google OAuth token request failed: {resp.status_code}")
        raise HTTPException(status_code=502, detail="Google Play is unreachable. Try again.")
    body = resp.json()
    _token_cache[info["client_email"]] = (body["access_token"], now + int(body.get("expires_in", 3600)))
    return body["access_token"]


async def fetch_subscription(info: dict, purchase_token: str) -> Optional[dict]:
    """purchases.subscriptionsv2.get. None = Google doesn't know this token (invalid)."""
    url = f"{API_BASE}/{quote(_package(), safe='')}/purchases/subscriptionsv2/tokens/{quote(purchase_token, safe='')}"
    headers = {"Authorization": f"Bearer {await _access_token(info)}"}
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=15.0)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Google Play is unreachable. Try again.")
    if resp.status_code in (400, 404, 410):
        return None
    if resp.status_code != 200:
        logger.error(f"subscriptionsv2.get failed: {resp.status_code}")
        raise HTTPException(status_code=502, detail="Google Play is unreachable. Try again.")
    return resp.json()


async def acknowledge(info: dict, product_id: str, purchase_token: str) -> bool:
    """purchases.subscriptions.acknowledge. False = not done (the app acknowledges as backup)."""
    url = (f"{API_BASE}/{quote(_package(), safe='')}/purchases/subscriptions/{quote(product_id, safe='')}"
           f"/tokens/{quote(purchase_token, safe='')}:acknowledge")
    try:
        headers = {"Authorization": f"Bearer {await _access_token(info)}"}
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json={}, timeout=15.0)
        return resp.status_code in (200, 204)
    except (httpx.HTTPError, HTTPException):
        return False


# ── Reading a SubscriptionPurchaseV2 ─────────────────────────────────────────────────

def _line_item(purchase: dict, product_id: str) -> Optional[dict]:
    return next((li for li in purchase.get("lineItems") or [] if li.get("productId") == product_id), None)


def _store_state(purchase: dict, line: dict, now: Optional[datetime] = None) -> tuple[bool, str, Optional[str]]:
    """(grants access?, status for the row, period end ISO). Same vocabulary as Lemon rows:
    active / past_due (grace: still paid) / cancelled (paid until period end) / paused / expired."""
    now = now or datetime.now(timezone.utc)
    expiry = line.get("expiryTime")
    expiry_dt = _parse_ts(expiry)
    state = purchase.get("subscriptionState", "")
    if state == "SUBSCRIPTION_STATE_ACTIVE":
        return True, "active", expiry
    if state == "SUBSCRIPTION_STATE_IN_GRACE_PERIOD":
        return True, "past_due", expiry
    if state == "SUBSCRIPTION_STATE_CANCELED":  # auto-renew off: still paid until expiryTime
        if expiry_dt and expiry_dt > now:
            return True, "cancelled", expiry
        return False, "expired", expiry
    if state == "SUBSCRIPTION_STATE_ON_HOLD":
        return False, "paused", expiry
    if state == "SUBSCRIPTION_STATE_PAUSED":
        return False, "paused", expiry
    if state == "SUBSCRIPTION_STATE_EXPIRED":
        return False, "expired", expiry
    return False, "pending" if state == "SUBSCRIPTION_STATE_PENDING" else "expired", expiry


def _account_id(purchase: dict) -> Optional[str]:
    return (purchase.get("externalAccountIdentifiers") or {}).get("obfuscatedExternalAccountId")


def _write(session: Session, user_id: str, token: str, plan: str, status: str, period_end: Optional[str], updated_at: str):
    """The Google twin of subscriptions._upsert_subscription: same row, same plan key. Lemon's
    own fields (ls_*, portal urls) are left as they are."""
    row = session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()
    if row is None:
        row = Subscription(user_id=user_id, created_at=updated_at)
    row.plan, row.status = plan, status
    row.current_period_end = period_end or row.current_period_end
    row.store_source, row.gp_purchase_token = "google_play", token
    row.updated_at = updated_at
    session.add(row)
    session.commit()


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


# ── Verify (the app, after a purchase or a restore) ─────────────────────────────────

class VerifyRequest(BaseModel):
    product_id: str
    purchase_token: str
    package_name: Optional[str] = None  # Purchase.getPackageName(); checked when sent


@router.post("/verify")
async def verify_purchase(body: VerifyRequest, user_id: str = Depends(get_current_user_id),
                          session: Session = Depends(get_session)):
    info = _require_config()
    product = _product()
    if body.package_name is not None and body.package_name != _package():
        raise HTTPException(status_code=400, detail="That purchase belongs to another app.")
    if body.product_id != product:
        raise HTTPException(status_code=400, detail="That product isn't sold here.")
    if not body.purchase_token.strip():
        raise HTTPException(status_code=400, detail="Invalid purchase token.")

    # The package is enforced by the API path: a token from another app is unknown → None
    purchase = await fetch_subscription(info, body.purchase_token)
    if purchase is None:
        raise HTTPException(status_code=400, detail="Google doesn't recognise this purchase.")
    line = _line_item(purchase, product)
    if line is None:
        raise HTTPException(status_code=400, detail="That product isn't sold here.")
    account = _account_id(purchase)
    if account is not None and account != user_id:
        logger.warning(f"Play token bound to another account presented by user={user_id}")
        raise HTTPException(status_code=403, detail="This purchase belongs to another KoreX account.")
    owner = session.exec(select(Subscription).where(Subscription.gp_purchase_token == body.purchase_token)).first()
    if owner is not None and owner.user_id != user_id:
        raise HTTPException(status_code=403, detail="This purchase belongs to another KoreX account.")

    grants, status, period_end = _store_state(purchase, line)
    if not grants:  # explicit answer, nothing written: an expired token never downgrades a row
        return {"granted": False, "status": status, "plan": None, "current_period_end": period_end,
                "acknowledged": purchase.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
                "store_source": "google_play"}

    _write(session, user_id, body.purchase_token, PAID_PLAN, status, period_end, _now_iso())
    acknowledged = purchase.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"
    if not acknowledged:  # granted first, then acknowledge: Google refunds unacknowledged purchases after 3 days
        acknowledged = await acknowledge(info, product, body.purchase_token)
    logger.info(f"Play subscription verified: user={user_id} status={status}")
    return {"granted": True, "status": status, "plan": PAID_PLAN, "current_period_end": period_end,
            "acknowledged": acknowledged, "store_source": "google_play"}


# ── RTDN (Pub/Sub push) ─────────────────────────────────────────────────────────────

_jwks: Optional[jwt.PyJWKClient] = None


def _signing_key(token: str):
    global _jwks
    if _jwks is None:
        _jwks = jwt.PyJWKClient(GOOGLE_CERTS)
    return _jwks.get_signing_key_from_jwt(token).key


def _verify_pubsub_jwt(request: Request, audience: str) -> bool:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[7:]
    try:
        claims = jwt.decode(token, _signing_key(token), algorithms=["RS256"], audience=audience,
                            options={"require": ["exp", "iat", "iss", "aud"]})
    except Exception:  # bad signature, wrong audience, expired, unreachable certs
        return False
    if claims.get("iss") not in GOOGLE_ISSUERS:
        return False
    expected_sender = os.getenv("GOOGLE_RTDN_SERVICE_ACCOUNT", "").strip()  # optional: pin the push identity
    return not expected_sender or (claims.get("email") == expected_sender and claims.get("email_verified") is True)


def _ms_to_iso(ms) -> Optional[str]:
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    except (TypeError, ValueError):
        return None


@router.post("/rtdn")
async def handle_rtdn(request: Request, session: Session = Depends(get_session)):
    audience = os.getenv("GOOGLE_RTDN_AUDIENCE", "").strip()
    info = _service_account()
    if not audience or info is None:  # fail closed; Pub/Sub retries non-2xx, nothing is lost
        return JSONResponse(status_code=503, content={"error": "Google Play notifications not configured"})
    if not _verify_pubsub_jwt(request, audience):
        return JSONResponse(status_code=401, content={"error": "Invalid push token"})

    try:
        envelope = await request.json()
        data = json.loads(base64.b64decode(envelope["message"]["data"]))
    except Exception:
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "unreadable message"})  # don't retry garbage

    if data.get("packageName") != _package():
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "other package"})
    note = data.get("subscriptionNotification")
    if not note:  # testNotification, one-time products
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "not a subscription"})
    kind = RTDN_TYPES.get(note.get("notificationType"), "UNKNOWN")
    token = note.get("purchaseToken") or ""
    event_at = _ms_to_iso(data.get("eventTimeMillis"))

    row = session.exec(select(Subscription).where(Subscription.gp_purchase_token == token)).first()
    # Ordering + idempotency (same rule as the Lemon webhook): nothing older than what we stored
    if row is not None and event_at and _parse_ts(row.updated_at) and _parse_ts(event_at) <= _parse_ts(row.updated_at):
        logger.info(f"Stale/duplicate RTDN ignored: {kind}")
        return JSONResponse(status_code=200, content={"ok": True, "duplicate": True})

    # The notification only says "something changed": the state comes from Google
    purchase = await fetch_subscription(info, token)
    if purchase is None:
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "unknown token"})
    line = _line_item(purchase, _product())
    if line is None:
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "other product"})

    user_id = row.user_id if row is not None else _account_id(purchase)
    if not user_id:
        return JSONResponse(status_code=200, content={"ok": True, "warning": "no user"})
    current = row or session.exec(select(Subscription).where(Subscription.user_id == user_id)).first()

    grants, status, period_end = _store_state(purchase, line)
    if kind == "REVOKED":  # refunded / revoked: access ends now, whatever the line item says
        grants, status = False, "expired"
    if not grants and row is None:
        # a token we never stored (e.g. an old one after a re-subscribe) never downgrades the current row
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "not the current purchase"})
    if not grants and current is not None and current.store_source != "google_play":
        return JSONResponse(status_code=200, content={"ok": True, "ignored": "row charged by another store"})

    plan = PAID_PLAN if grants else ("starter" if status == "expired" else (current.plan if current else "starter"))
    _write(session, user_id, token, plan, status, period_end, event_at or _now_iso())
    if grants and purchase.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_PENDING":
        await acknowledge(info, _product(), token)
    logger.info(f"RTDN {kind}: user={user_id} plan={plan} status={status}")
    return JSONResponse(status_code=200, content={"ok": True})
