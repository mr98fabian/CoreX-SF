"""H-02 (mission 21): rate-limit buckets are per user, or per REAL client IP behind our proxies.

Goes through HTTP only (no import of rate_limit) so the same file runs against main as the
counter-proof: there every request behind the proxy shares one bucket and these tests fail.
"""
import pytest
from fastapi.testclient import TestClient

from auth import get_current_user_id
from main import app
from routers import codes as codes_router
from routers import oauth as oauth_router

U1 = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1"
PROXY = ("10.1.2.3", 40000)          # private range = Railway edge (trusted proxy)
OUTSIDER = ("198.51.100.9", 40000)   # public peer = not a proxy of ours
ATTACKER, VICTIM = "203.0.113.7", "203.0.113.8"
REDEEM = {"code": "KX-FND-AAAAAA-AAAAAA"}  # never exists → 400 until the limit hits


@pytest.fixture(autouse=True)
def fresh_limits():
    for lim in {id(x): x for x in (app.state.limiter, codes_router.limiter, oauth_router.limiter)}.values():
        lim.reset()
    app.dependency_overrides[get_current_user_id] = lambda: U1
    yield
    app.dependency_overrides.pop(get_current_user_id, None)


def via(peer):
    return TestClient(app, client=peer)


def redeem(c, token, ip=None):
    headers = {"Authorization": f"Bearer {token}"}
    if ip:
        headers["X-Forwarded-For"] = ip
    return c.post("/api/codes/redeem", json=REDEEM, headers=headers).status_code


def register(c, xff=None):
    return c.post("/oauth/register", json={}, headers={"X-Forwarded-For": xff} if xff else {}).status_code


# ── (a) two users never share a bucket ────────────────────────────────────────────
def test_users_do_not_share_bucket_on_redeem():
    c = via(PROXY)
    first = [redeem(c, "session-user-a", ATTACKER) for _ in range(6)]
    assert first[:5] == [400] * 5 and first[5] == 429
    assert redeem(c, "session-user-b", ATTACKER) == 400  # same IP, other user: own bucket


# ── (b) one IP doesn't exhaust the global redeem bucket ───────────────────────────
def test_one_ip_does_not_exhaust_redeem_for_everyone():
    c = via(PROXY)
    assert [redeem(c, "attacker", ATTACKER) for _ in range(6)][5] == 429
    assert redeem(c, "victim", VICTIM) == 400


def test_one_ip_does_not_exhaust_oauth_register_for_everyone():
    c = via(PROXY)
    hits = [register(c, ATTACKER) for _ in range(11)]
    assert 429 not in hits[:10] and hits[10] == 429
    assert register(c, VICTIM) != 429  # other client behind the same proxy: own bucket


# ── (c) X-Forwarded-For forged from an untrusted IP is ignored ────────────────────
def test_forwarded_header_from_untrusted_peer_is_ignored():
    c = via(OUTSIDER)
    hits = [register(c, f"192.0.2.{i}") for i in range(11)]  # rotating forged IPs
    assert hits[10] == 429  # still one bucket: the peer


def test_forwarded_forged_left_part_is_ignored_behind_trusted_proxy():
    c = via(PROXY)
    # The proxy appends the real client; whatever the client wrote sits to its left.
    hits = [register(c, f"192.0.2.{i}, {ATTACKER}") for i in range(11)]
    assert hits[10] == 429
    assert register(c, f"192.0.2.99, {VICTIM}") != 429


# ── default_limits apply (SlowAPIMiddleware), webhooks and /health exempt ─────────
DEFAULT = 120


def test_default_limit_applies_to_routes_without_their_own():
    c = via(("198.51.100.20", 40000))
    hits = [c.get("/api/public/plans").status_code for _ in range(DEFAULT + 1)]
    assert hits[:DEFAULT] == [200] * DEFAULT and hits[DEFAULT] == 429
    assert via(("198.51.100.21", 40000)).get("/api/public/plans").status_code == 200


def test_default_limit_exempts_health_and_webhooks():
    c = via(("198.51.100.30", 40000))
    for path, method in (("/health", "get"), ("/api/subscriptions/webhook", "post"),
                         ("/api/subscriptions/google/rtdn", "post")):
        codes = {getattr(c, method)(path).status_code for _ in range(DEFAULT + 5)}
        assert 429 not in codes, path
