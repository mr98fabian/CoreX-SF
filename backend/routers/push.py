"""
Push notices — the phone registers its FCM token, the user turns notices on or off.
Session only (get_current_user_id rejects API tokens with 403): an AI connection can't
register devices or change the preference. What gets sent and when lives in push_engine.py.
"""
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PField
from sqlmodel import select

import push_engine
from auth import DEMO_USER_ID, get_current_user_id
from database import request_session
from helpers import get_or_create_for_user
from models import PushDevice, UserSettings

router = APIRouter(prefix="/api/push", tags=["push"])


class DeviceIn(BaseModel):
    token: str = PField(min_length=10, max_length=512)
    platform: str = PField(default="android", max_length=16)
    timezone: str = PField(default=push_engine.DEFAULT_TZ, max_length=64)
    language: str = PField(default=push_engine.DEFAULT_LANGUAGE, max_length=16)  # app language; normalized to es | en


class DeviceOut(BaseModel):
    token: str = PField(min_length=1, max_length=512)


class PreferenceIn(BaseModel):
    enabled: bool


@router.get("/config")
def push_config(user_id: str = Depends(get_current_user_id)):
    """Whether the server can send at all: the app only asks for the permission when it can."""
    return {"enabled": push_engine.configured() and user_id != DEMO_USER_ID}


@router.post("/devices")
def register_device(body: DeviceIn, user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=403, detail="The shared demo doesn't receive notices")
    try:
        ZoneInfo(body.timezone)
    except Exception:
        raise HTTPException(status_code=400, detail="Unknown time zone")
    now = datetime.utcnow()
    with request_session() as s:
        row = s.exec(select(PushDevice).where(PushDevice.fcm_token == body.token)).first()
        if row is None:
            row = PushDevice(user_id=user_id, fcm_token=body.token, created_at=now)
        # a phone that changes hands (logout → other login) belongs to whoever registers it last
        row.user_id, row.platform, row.timezone = user_id, body.platform, body.timezone
        row.language = push_engine.normalize_language(body.language)
        row.updated_at = row.last_seen_at = now
        row.dead_at = None
        s.add(row)
        s.commit()
    return {"registered": True}


@router.delete("/devices")
def unregister_device(body: DeviceOut, user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        row = s.exec(select(PushDevice).where(PushDevice.fcm_token == body.token, PushDevice.user_id == user_id)).first()
        if row is not None:
            s.delete(row)
            s.commit()
    return {"removed": True}


@router.get("/preferences")
def get_preferences(user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        row = s.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        return {"enabled": True if row is None else bool(row.push_enabled)}


@router.put("/preferences")
def set_preferences(body: PreferenceIn, user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        row = get_or_create_for_user(s, UserSettings, user_id)
        row.push_enabled = body.enabled
        s.add(row)
        s.commit()
        return {"enabled": row.push_enabled}


# ── Notice e-mails (email_engine.py): the preference and the profile the engine writes in ──

class ProfileIn(BaseModel):
    language: str = PField(default=push_engine.DEFAULT_LANGUAGE, max_length=16)  # normalized to es | en
    timezone: str = PField(default=push_engine.DEFAULT_TZ, max_length=64)


@router.get("/email")
def get_email_preferences(user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        row = s.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        return {"enabled": True if row is None else bool(row.email_enabled)}


@router.put("/email")
def set_email_preferences(body: PreferenceIn, user_id: str = Depends(get_current_user_id)):
    with request_session() as s:
        row = get_or_create_for_user(s, UserSettings, user_id)
        row.email_enabled = body.enabled
        s.add(row)
        s.commit()
        return {"enabled": row.email_enabled}


@router.put("/profile")
def sync_profile(body: ProfileIn, user_id: str = Depends(get_current_user_id)):
    """The app reports its language and time zone (every sign-in and every language switch):
    notice e-mails go out in that language and respect quiet hours in that zone."""
    try:
        ZoneInfo(body.timezone)
    except Exception:
        raise HTTPException(status_code=400, detail="Unknown time zone")
    with request_session() as s:
        row = get_or_create_for_user(s, UserSettings, user_id)
        row.language = push_engine.normalize_language(body.language)
        row.timezone = body.timezone
        s.add(row)
        s.commit()
        return {"language": row.language, "timezone": row.timezone}


