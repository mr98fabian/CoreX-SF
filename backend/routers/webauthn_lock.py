"""
WebAuthn — the LOCAL fingerprint lock for the PWA.

This is a privacy padlock on the device, not server authentication: the
Supabase session stays valid either way. The backend only issues one-time
challenges and verifies that the platform authenticator registered by this
user signed them. App session only (kx_ tokens are denied by
get_current_user_id).
"""
import os
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import select
from webauthn import (generate_authentication_options, generate_registration_options, options_to_json,
                      verify_authentication_response, verify_registration_response)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.structs import (AuthenticatorAttachment, AuthenticatorSelectionCriteria,
                                      PublicKeyCredentialDescriptor, ResidentKeyRequirement, UserVerificationRequirement)

from auth import get_current_user_id
from database import request_session
from models import WebAuthnChallenge, WebAuthnCredential

router = APIRouter(prefix="/api/webauthn", tags=["webauthn"])

CHALLENGE_TTL = timedelta(minutes=5)
_DEFAULT_ORIGINS = "https://korexf.com,https://www.korexf.com"
_DEV_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"


def _allowed_origins() -> set:
    raw = os.getenv("WEBAUTHN_ORIGINS", _DEFAULT_ORIGINS)
    if os.getenv("ENVIRONMENT", "production") == "development":
        raw += "," + _DEV_ORIGINS
    return {o.strip().rstrip("/") for o in raw.split(",") if o.strip()}


def _origin_and_rp(origin: Optional[str]) -> tuple:
    """RP id = the host of the calling origin, only for origins we serve."""
    o = (origin or "").rstrip("/")
    if o not in _allowed_origins():
        raise HTTPException(status_code=400, detail="Origin not allowed for the fingerprint lock.")
    return o, urlparse(o).hostname


def _save_challenge(session, user_id: str, purpose: str, challenge: bytes) -> None:
    for old in session.exec(select(WebAuthnChallenge).where(WebAuthnChallenge.user_id == user_id,
                                                             WebAuthnChallenge.purpose == purpose)).all():
        session.delete(old)
    session.add(WebAuthnChallenge(user_id=user_id, purpose=purpose, challenge=bytes_to_base64url(challenge),
                                  expires_at=datetime.utcnow() + CHALLENGE_TTL))
    session.commit()


def _take_challenge(session, user_id: str, purpose: str) -> bytes:
    row = session.exec(select(WebAuthnChallenge).where(WebAuthnChallenge.user_id == user_id,
                                                        WebAuthnChallenge.purpose == purpose)).first()
    if not row:
        raise HTTPException(status_code=400, detail="No pending challenge.")
    session.delete(row)  # one use, valid or not
    session.commit()
    if row.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Challenge expired.")
    return base64url_to_bytes(row.challenge)


def _creds(session, user_id: str):
    return session.exec(select(WebAuthnCredential).where(WebAuthnCredential.user_id == user_id)).all()


class VerifyBody(BaseModel):
    credential: Dict[str, Any]


@router.get("/status")
async def status(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        return {"registered": len(_creds(session, user_id)) > 0}


@router.post("/register/options")
async def register_options(origin: Optional[str] = Header(None), user_id: str = Depends(get_current_user_id)):
    _, rp_id = _origin_and_rp(origin)
    with request_session() as session:
        opts = generate_registration_options(
            rp_id=rp_id, rp_name="KoreX", user_id=user_id.encode(), user_name="KoreX",
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=AuthenticatorAttachment.PLATFORM,
                resident_key=ResidentKeyRequirement.DISCOURAGED,
                user_verification=UserVerificationRequirement.REQUIRED),
            exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id))
                                 for c in _creds(session, user_id)],
        )
        _save_challenge(session, user_id, "register", opts.challenge)
    return Response(content=options_to_json(opts), media_type="application/json")


@router.post("/register/verify")
async def register_verify(body: VerifyBody, origin: Optional[str] = Header(None),
                          user_id: str = Depends(get_current_user_id)):
    o, rp_id = _origin_and_rp(origin)
    with request_session() as session:
        challenge = _take_challenge(session, user_id, "register")
        try:
            v = verify_registration_response(credential=body.credential, expected_challenge=challenge,
                                             expected_origin=o, expected_rp_id=rp_id, require_user_verification=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not verify the fingerprint registration.")
        session.add(WebAuthnCredential(user_id=user_id, credential_id=bytes_to_base64url(v.credential_id),
                                       public_key=bytes_to_base64url(v.credential_public_key), sign_count=v.sign_count))
        session.commit()
    return {"registered": True}


@router.post("/auth/options")
async def auth_options(origin: Optional[str] = Header(None), user_id: str = Depends(get_current_user_id)):
    _, rp_id = _origin_and_rp(origin)
    with request_session() as session:
        creds = _creds(session, user_id)
        if not creds:
            raise HTTPException(status_code=404, detail="No fingerprint registered.")
        opts = generate_authentication_options(
            rp_id=rp_id, user_verification=UserVerificationRequirement.REQUIRED,
            allow_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) for c in creds])
        _save_challenge(session, user_id, "auth", opts.challenge)
    return Response(content=options_to_json(opts), media_type="application/json")


@router.post("/auth/verify")
async def auth_verify(body: VerifyBody, origin: Optional[str] = Header(None),
                      user_id: str = Depends(get_current_user_id)):
    o, rp_id = _origin_and_rp(origin)
    with request_session() as session:
        challenge = _take_challenge(session, user_id, "auth")
        cred = session.exec(select(WebAuthnCredential).where(
            WebAuthnCredential.user_id == user_id,
            WebAuthnCredential.credential_id == str(body.credential.get("id", "")))).first()
        if not cred:
            raise HTTPException(status_code=400, detail="Unknown credential.")
        try:
            v = verify_authentication_response(
                credential=body.credential, expected_challenge=challenge, expected_rp_id=rp_id, expected_origin=o,
                credential_public_key=base64url_to_bytes(cred.public_key),
                credential_current_sign_count=cred.sign_count, require_user_verification=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Could not verify the fingerprint.")
        cred.sign_count = v.new_sign_count
        session.add(cred)
        session.commit()
    return {"unlocked": True}


@router.delete("/credentials/{credential_id}")
async def remove_credential(credential_id: str, user_id: str = Depends(get_current_user_id)):
    """Turning the lock off on a device forgets that device's fingerprint (other devices keep theirs)."""
    with request_session() as session:
        for c in session.exec(select(WebAuthnCredential).where(WebAuthnCredential.user_id == user_id,
                                                                WebAuthnCredential.credential_id == credential_id)).all():
            session.delete(c)
        session.commit()
    return {"removed": True}
