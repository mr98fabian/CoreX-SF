"""
Settings Router — User preferences and onboarding state.
Persists user-level flags in the user_settings table.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
import logging

from database import engine
from models import UserSettings
from helpers import bypass_fk
from auth import get_current_user_id

logger = logging.getLogger("korex.settings")

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsUpdate(BaseModel):
    onboarding_complete: bool | None = None


def _get_or_create(session: Session, user_id: str) -> UserSettings:
    """Upsert pattern: return existing row or create a new one."""
    settings = session.exec(
        select(UserSettings).where(UserSettings.user_id == user_id)
    ).first()
    if not settings:
        settings = UserSettings(user_id=user_id)
        with bypass_fk(session):
            session.add(settings)
            session.commit()
        session.refresh(settings)
    return settings


@router.get("/settings")
async def get_settings(user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        settings = _get_or_create(session, user_id)
        return {
            "onboarding_complete": settings.onboarding_complete,
        }


@router.patch("/settings")
async def update_settings(body: SettingsUpdate, user_id: str = Depends(get_current_user_id)):
    with Session(engine) as session:
        settings = _get_or_create(session, user_id)
        if body.onboarding_complete is not None:
            settings.onboarding_complete = body.onboarding_complete
        with bypass_fk(session):
            session.add(settings)
            session.commit()
        session.refresh(settings)
        return {
            "onboarding_complete": settings.onboarding_complete,
        }
