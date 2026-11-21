"""
Mi Cuenta — delete the account and every row of its data (Google Play requirement: deletion
from the app and from a web link, /eliminar-cuenta).

DELETE /api/user/me   (session only: get_current_user_id rejects API tokens with 403, so an AI
                       connection can never delete the account)
  body {"password": "..."}          accounts with an email + password login
       {"confirm_email": "..."}     accounts that only sign in with Google (no password exists):
                                    they confirm by typing the account's email

Order: verify → delete every table's rows for this user in ONE transaction (not committed yet)
→ delete the Supabase login → commit. If the login can't be deleted, the data rollback leaves
everything as it was. Nothing outside KoreX's database is touched: a store subscription (Google
Play, Lemon Squeezy) and its tax records live in the store; the app warns before confirming.
"""
import logging
from typing import Optional

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, SQLModel

import database
import supabase_admin
from auth import DELETED_USERS, DEMO_USER_ID, get_current_user_id

logger = logging.getLogger("korex.account")
router = APIRouter(prefix="/api/user", tags=["account"])


class DeleteAccount(BaseModel):
    password: Optional[str] = None
    confirm_email: Optional[str] = None


def user_tables() -> list[sa.Table]:
    """Every table holding per-user rows, children before parents (FK-safe delete order).
    New tables with a user_id column are covered automatically."""
    return [t for t in reversed(SQLModel.metadata.sorted_tables) if "user_id" in t.c]


@router.delete("/me")
async def delete_my_account(body: DeleteAccount, user_id: str = Depends(get_current_user_id)):
    if user_id == DEMO_USER_ID:
        raise HTTPException(status_code=403, detail="The shared demo can't be deleted")
    if not supabase_admin.configured():
        raise HTTPException(status_code=503, detail="Account deletion isn't available yet. Try again later.")

    try:
        auth_user = await supabase_admin.get_auth_user(user_id)
    except Exception:
        raise HTTPException(status_code=502, detail="We couldn't reach the sign-in service. Nothing was deleted.")
    if auth_user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    if "email" in auth_user["providers"]:
        if not body.password or not await supabase_admin.password_ok(auth_user["email"], body.password):
            raise HTTPException(status_code=403, detail="Wrong password. Nothing was deleted.")
    elif not body.confirm_email or body.confirm_email.strip().lower() != auth_user["email"].strip().lower():
        raise HTTPException(status_code=403, detail="The email doesn't match. Nothing was deleted.")

    deleted: dict[str, int] = {}
    with Session(database.engine) as s:
        try:
            for table in user_tables():
                n = s.execute(table.delete().where(table.c.user_id == user_id)).rowcount
                if n:
                    deleted[table.name] = n
            # the login goes before the data is final: if it fails, the rollback keeps everything
            if not await supabase_admin.delete_auth_user(user_id):
                raise RuntimeError("auth user not deleted")
            s.commit()
        except Exception:
            s.rollback()
            logger.exception("Account deletion failed; nothing was deleted")
            raise HTTPException(status_code=502, detail="We couldn't delete the account. Nothing was deleted; try again.")

    DELETED_USERS.add(user_id)
    logger.info(f"Account deleted: rows={sum(deleted.values())} tables={len(deleted)}")  # no email, no ids
    return {"deleted": True}
