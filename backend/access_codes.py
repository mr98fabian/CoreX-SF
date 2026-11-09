"""
Redeemable access codes (Founder + gift months).

- Format: KX-FND-XXXXXX-XXXXXX / KX-REG-XXXXXX-XXXXXX — 12 chars from a 31-symbol
  alphabet without 0/O/1/I/L (≈ 59 bits).
- Only HMAC-SHA256(key, normalized code) is stored. Key: ACCESS_CODE_HMAC_KEY, else the
  existing SUPABASE_JWT_SECRET; in development a fixed dev key. Without a key in production
  codes are disabled (create/redeem refuse) instead of silently using a weak one.
  Changing the key invalidates every unredeemed code.
- Custom codes (owner-chosen, e.g. a private joke for one person): 8–40 letters/digits,
  case-, space-, dash- and accent-insensitive (Ñ = N). Lower entropy than the generated
  ones, so meant for single use; the stored prefix keeps only 3 characters.
- Redemption is atomic: a conditional UPDATE that must hit exactly one row.
"""
import hashlib
import hmac
import os
import re
import unicodedata
import secrets
from datetime import datetime
from typing import Optional

from dateutil.relativedelta import relativedelta
from sqlalchemy import update
from sqlmodel import Session, select

from models import AccessCode, AccessGrant

ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L
KIND_PREFIX = {"founder": "FND", "months": "REG"}
FOUNDER_PLAN = "founder"
GIFT_PLAN = "freedom"  # the plan on sale; accelerator grants already issued keep working via PLAN_RANK
CODE_RE = re.compile(r"^KX-(FND|REG)-([%s]{6})-([%s]{6})$" % (ALPHABET, ALPHABET))
CUSTOM_RE = re.compile(r"^[A-Z0-9]{8,40}$")


class CodesDisabled(RuntimeError):
    """No HMAC key configured outside development."""


def _key() -> bytes:
    key = os.getenv("ACCESS_CODE_HMAC_KEY") or os.getenv("SUPABASE_JWT_SECRET")
    if key:
        return key.encode("utf-8")
    if os.getenv("ENVIRONMENT", "production") == "development":
        return b"korex-dev-only-access-code-key"
    raise CodesDisabled("ACCESS_CODE_HMAC_KEY is not set")


def normalize(code: str) -> str:
    """Upper-case, drop accents (Ñ→N), spaces and dashes; KX codes get their dashes back."""
    folded = "".join(c for c in unicodedata.normalize("NFKD", code or "") if not unicodedata.combining(c))
    raw = re.sub(r"[\s-]", "", folded.upper())
    if len(raw) == 17 and raw.startswith("KX"):
        return f"KX-{raw[2:5]}-{raw[5:11]}-{raw[11:17]}"
    return raw


def _valid_format(normalized: str) -> bool:
    return bool(CODE_RE.match(normalized) or CUSTOM_RE.match(normalized))


class CodeTaken(ValueError):
    """A custom code that already exists (same HMAC)."""


def code_hmac(code: str) -> str:
    return hmac.new(_key(), normalize(code).encode("utf-8"), hashlib.sha256).hexdigest()


def generate_code(kind: str) -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(12))
    return f"KX-{KIND_PREFIX[kind]}-{body[:6]}-{body[6:]}"


def create_code(session: Session, *, kind: str, created_by: str, months: Optional[int] = None,
                max_uses: int = 1, expires_at: Optional[datetime] = None,
                custom: Optional[str] = None) -> tuple[AccessCode, str]:
    """Returns (row, plain_code). The plain code exists only in this return value."""
    if kind not in KIND_PREFIX:
        raise ValueError("kind must be founder or months")
    if kind == "months" and (not months or months < 1):
        raise ValueError("months required for a gift code")
    if custom is not None:
        plain = custom.strip()
        norm = normalize(plain)
        if not CUSTOM_RE.match(norm) or norm.startswith("KX"):
            raise ValueError("custom code: 8-40 letters or digits")
        prefix = norm[:3]
    else:
        plain = generate_code(kind)
        prefix = plain[:10]
    digest = code_hmac(plain)
    if session.exec(select(AccessCode).where(AccessCode.code_hmac == digest)).first():
        raise CodeTaken("code already exists")
    row = AccessCode(code_hmac=digest, prefix=prefix, kind=kind,
                     months=months if kind == "months" else None,
                     plan=FOUNDER_PLAN if kind == "founder" else GIFT_PLAN,
                     max_uses=max_uses, expires_at=expires_at, created_by=created_by)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row, plain


def code_status(row: AccessCode, now: Optional[datetime] = None) -> str:
    now = now or datetime.utcnow()
    if row.revoked_at:
        return "revoked"
    if row.expires_at and row.expires_at <= now:
        return "expired"
    if row.uses_count >= row.max_uses:
        return "used"
    return "active"


def active_grants(session: Session, user_id: str, now: Optional[datetime] = None) -> list[AccessGrant]:
    now = now or datetime.utcnow()
    rows = session.exec(select(AccessGrant).where(AccessGrant.user_id == user_id, AccessGrant.starts_at <= now)).all()
    return [g for g in rows if g.ends_at is None or g.ends_at > now]


def latest_grant_end(session: Session, user_id: str, now: datetime) -> datetime:
    """Gifts stack among themselves: a new one starts when the latest current/future gift ends."""
    ends = [g.ends_at for g in session.exec(select(AccessGrant).where(AccessGrant.user_id == user_id)).all()
            if g.ends_at is not None and g.ends_at > now]
    return max(ends, default=now)


class RedeemError(Exception):
    """Generic on purpose: never reveals whether a code exists."""


def redeem(session: Session, code: str, user_id: str, now: Optional[datetime] = None) -> AccessGrant:
    now = now or datetime.utcnow()
    if not _valid_format(normalize(code)):
        raise RedeemError()
    row = session.exec(select(AccessCode).where(AccessCode.code_hmac == code_hmac(code))).first()
    if not row:
        raise RedeemError()
    if session.exec(select(AccessGrant).where(AccessGrant.code_id == row.id, AccessGrant.user_id == user_id)).first():
        raise RedeemError()
    claimed = session.execute(
        update(AccessCode)
        .where(AccessCode.id == row.id, AccessCode.uses_count < AccessCode.max_uses,
               AccessCode.revoked_at.is_(None),
               (AccessCode.expires_at.is_(None)) | (AccessCode.expires_at > now))
        .values(uses_count=AccessCode.uses_count + 1)
    )
    if claimed.rowcount != 1:
        session.rollback()
        raise RedeemError()
    if row.kind == "founder":
        grant = AccessGrant(user_id=user_id, plan=row.plan, starts_at=now, ends_at=None, code_id=row.id)
    else:
        start = latest_grant_end(session, user_id, now)
        grant = AccessGrant(user_id=user_id, plan=row.plan, starts_at=start,
                            ends_at=start + relativedelta(months=row.months), code_id=row.id)
    session.add(grant)
    try:
        session.commit()  # the use counter and the grant land together, or neither does
    except Exception:
        session.rollback()
        raise RedeemError()
    session.refresh(grant)
    return grant
