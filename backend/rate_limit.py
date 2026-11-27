"""
The one rate limiter of the app (H-02, mission 21).

Key = the user where there is one (a hash of the bearer: session JWT or kx_ token), else the
client's real IP. The real IP comes from X-Forwarded-For ONLY when the TCP peer is a trusted
proxy (TRUSTED_PROXY_CIDRS); the chain is read right to left and the first hop that is not a
trusted proxy is the client. A header forged by the client sits to the left of what our proxies
append, so it is never picked; from an untrusted peer the header is ignored entirely.

uvicorn's own --proxy-headers only trusts 127.0.0.1 by default, which is why every request
looked like it came from the Railway edge and the buckets were global.
"""
import hashlib
import ipaddress
import logging
import os
from typing import List, Union

from slowapi import Limiter
from starlette.requests import Request

from auth import DEMO_TOKEN

logger = logging.getLogger("korex.ratelimit")

# Railway's edge and internal network reach the app from private / CGNAT space.
_DEFAULT_TRUSTED = "127.0.0.0/8,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10,fc00::/7"
Network = Union[ipaddress.IPv4Network, ipaddress.IPv6Network]


def _parse_networks(raw: str) -> List[Network]:
    nets = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            nets.append(ipaddress.ip_network(part, strict=False))
        except ValueError:
            logger.warning("TRUSTED_PROXY_CIDRS: ignoring invalid entry %r", part)
    return nets


TRUSTED_PROXIES: List[Network] = _parse_networks(os.getenv("TRUSTED_PROXY_CIDRS", _DEFAULT_TRUSTED))
DEFAULT_LIMIT = os.getenv("RATE_LIMIT_DEFAULT", "120/minute")
_logged_first_hop = False


def _ip(value: str):
    try:
        return ipaddress.ip_address(value.strip().strip("[]"))
    except ValueError:
        return None


def _trusted(ip) -> bool:
    return ip is not None and any(ip in net for net in TRUSTED_PROXIES)


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else ""
    peer_ip = _ip(peer)
    if not _trusted(peer_ip):
        return peer or "unknown"
    hops = [h for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    global _logged_first_hop
    if not _logged_first_hop:  # one line per process so production shows the proxy shape (no client IPs)
        _logged_first_hop = True
        logger.info("rate-limit: peer %s is a trusted proxy; X-Forwarded-For has %d hop(s)", peer, len(hops))
    for hop in reversed(hops):
        ip = _ip(hop)
        if ip is None:
            break  # garbage in the chain: stop at the last hop we could read
        if not _trusted(ip):
            return str(ip)
        peer = str(ip)
    return peer


def rate_limit_key(request: Request) -> str:
    auth = request.headers.get("authorization", "")
    if auth[:7].lower() == "bearer ":
        token = auth[7:].strip()
        if token and token != DEMO_TOKEN:  # the demo token is shared by every visitor: key it by IP
            return "u:" + hashlib.sha256(token.encode("utf-8")).hexdigest()[:32]
    return "ip:" + client_ip(request)


limiter = Limiter(key_func=rate_limit_key, default_limits=[DEFAULT_LIMIT])


def enforce_default_limit(request: Request) -> None:
    """default_limits for every API route without its own @limiter.limit (and not @limiter.exempt).

    A global dependency, not SlowAPIMiddleware: from FastAPI 0.137 included routers are nested
    (_IncludedRouter) and the middleware's route lookup finds no handler, so it silently exempts
    every route. Here routing already ran, so scope["endpoint"] is the real function. Raises
    RateLimitExceeded → 429 through the app's handler. Mounts (/mcp) never reach it: they're not
    APIRoutes, and /mcp is limited per token in api_tokens.
    """
    endpoint = request.scope.get("endpoint")
    if not limiter.enabled or endpoint is None or not hasattr(endpoint, "__name__"):
        return
    name = f"{endpoint.__module__}.{endpoint.__name__}"
    if name in limiter._exempt_routes or name in limiter._route_limits:
        return
    limiter._check_request_limit(request, endpoint, True)
