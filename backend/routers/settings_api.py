"""
Settings Router — User preferences and onboarding state.
Persists user-level flags in the user_settings table.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session
from pydantic import BaseModel
import logging

from database import engine
from models import UserSettings
from helpers import bypass_fk, get_or_create_for_user
from auth import get_current_user_id
from api_tokens import require_scope

logger = logging.getLogger("korex.settings")

router = APIRouter(prefix="/api", tags=["settings"])


class SettingsUpdate(BaseModel):
    onboarding_complete: bool | None = None


def _get_or_create(session: Session, user_id: str) -> UserSettings:
    """Return the user's settings row, creating it race-safely on first access."""
    return get_or_create_for_user(session, UserSettings, user_id)


@router.get("/settings")
def get_settings(user_id: str = Depends(require_scope("read:dashboard"))):
    with Session(engine) as session:
        settings = _get_or_create(session, user_id)
        return {
            "onboarding_complete": settings.onboarding_complete,
        }


@router.patch("/settings")
def update_settings(body: SettingsUpdate, user_id: str = Depends(get_current_user_id)):
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
