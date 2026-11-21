"""
Supabase Auth calls for account deletion (routers/account.py). The only module that uses the
service-role key; it is read from the environment at call time and never logged.

  SUPABASE_URL               already used by auth.py
  SUPABASE_ANON_KEY          already used by auth.py (password check, as the app's login does)
  SUPABASE_SERVICE_ROLE_KEY  NEW: admin API (read the auth user, delete it). Without it
                             account deletion answers 503 and deletes nothing.
"""
import os
from typing import Optional

import httpx

TIMEOUT = 15.0


def _url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/")


def _service_key() -> str:
    return os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()


def configured() -> bool:
    return bool(_url() and _service_key() and os.getenv("SUPABASE_ANON_KEY", "").strip())


def _admin_headers() -> dict:
    key = _service_key()
    return {"apikey": key, "Authorization": f"Bearer {key}"}


async def get_auth_user(user_id: str) -> Optional[dict]:
    """{"email", "providers"} of the Supabase auth user, or None if it doesn't exist."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.get(f"{_url()}/auth/v1/admin/users/{user_id}", headers=_admin_headers())
    if r.status_code == 404:
        return None
    r.raise_for_status()
    body = r.json()
    providers = set((body.get("app_metadata") or {}).get("providers") or [])
    providers |= {i.get("provider") for i in body.get("identities") or [] if i.get("provider")}
    return {"email": body.get("email") or "", "providers": sorted(providers)}


async def password_ok(email: str, password: str) -> bool:
    """The same check as signing in with email + password."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.post(f"{_url()}/auth/v1/token", params={"grant_type": "password"},
                         headers={"apikey": os.getenv("SUPABASE_ANON_KEY", "").strip()},
                         json={"email": email, "password": password})
    return r.status_code == 200


async def delete_auth_user(user_id: str) -> bool:
    """Deletes the login itself; its refresh tokens die with it."""
    async with httpx.AsyncClient(timeout=TIMEOUT) as c:
        r = await c.delete(f"{_url()}/auth/v1/admin/users/{user_id}", headers=_admin_headers())
    return r.status_code in (200, 204, 404)
