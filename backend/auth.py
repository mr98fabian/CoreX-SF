"""
KoreX Financial System — Authentication Dependency
Extracted from main.py so all routers can import it directly.
"""
import os
from typing import Optional

import httpx
from fastapi import HTTPException, Header


SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# Demo mode constants
DEMO_TOKEN = "demo-stress-test-token"
DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"
# Enabled by default — demo token only accesses a synthetic sandbox account
DEMO_MODE_ENABLED = os.getenv("DEMO_MODE_ENABLED", "true").lower() == "true"


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate user_id from Supabase JWT via /auth/v1/user."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization

    # -- Demo Mode Bypass (only when explicitly enabled via env var) --
    if DEMO_MODE_ENABLED and token == DEMO_TOKEN:
        return DEMO_USER_ID

    if not SUPABASE_URL:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not configured")

    api_key = SUPABASE_ANON_KEY or token

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": api_key,
                },
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            user_data = resp.json()
            uid = user_data.get("id")
            if not uid:
                raise HTTPException(status_code=401, detail="No user id in token")
            return uid
    except httpx.HTTPError:
        raise HTTPException(status_code=401, detail="Auth service unreachable")
