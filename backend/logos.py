"""Official logos (Plaid): institution `logo` comes as base64 PNG, merchant
`logo_url` as https. Only those two shapes are stored — anything else is
rejected, so the UI never hotlinks an invented URL or renders a broken image.
No logo → the frontend draws a monogram."""
import re
from typing import Optional

from fastapi import HTTPException

LOGO_MAX = 200_000  # chars (~150 KB of base64)
_DATA = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")
_HTTPS = re.compile(r"^https://[^\s\"'<>]+$")


def clean_logo(value: Optional[str]) -> Optional[str]:
    """'' / None → None. A bare base64 string (Plaid institution logo) becomes a PNG data URI."""
    if value is None or not value.strip():
        return None
    v = value.strip()
    if len(v) > LOGO_MAX:
        raise HTTPException(status_code=422, detail="logo_url demasiado grande")
    if re.fullmatch(r"[A-Za-z0-9+/=]{40,}", v):
        v = f"data:image/png;base64,{v}"
    if not (_DATA.match(v) or _HTTPS.match(v)):
        raise HTTPException(status_code=422, detail="logo_url debe ser https:// o una imagen base64 de Plaid")
    return v
