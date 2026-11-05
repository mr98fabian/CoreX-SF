"""Auth verified locally (perf 2026-11-05): valid, expired, bad signature,
demo, kx_ rejected — and the remote fallback never caches an invalid token."""
import asyncio
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

import auth

KID = "test-kid"
USER = "12345678-1234-4123-a123-123456789abc"


@pytest.fixture
def keys(monkeypatch):
    private = ec.generate_private_key(ec.SECP256R1())
    public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(private.public_key(), as_dict=True)
    public_jwk.update({"kid": KID, "alg": "ES256", "use": "sig"})
    monkeypatch.setattr(auth, "_jwks", {KID: jwt.PyJWK(public_jwk)})
    monkeypatch.setattr(auth, "_jwks_at", time.monotonic())
    monkeypatch.setattr(auth, "SUPABASE_URL", "https://example.invalid")
    auth._remote_cache.clear()
    return private


def make(private, exp_in=3600, sub=USER, aud="authenticated", kid=KID):
    return jwt.encode({"sub": sub, "aud": aud, "exp": int(time.time()) + exp_in}, private, algorithm="ES256", headers={"kid": kid})


def run(token):
    return asyncio.run(auth.get_current_user_id(f"Bearer {token}"))


def test_valid_token_verifies_locally_without_network(keys, monkeypatch):
    async def boom(*a, **k):
        raise AssertionError("no network call expected")
    monkeypatch.setattr(auth, "_verify_remotely", boom)
    assert run(make(keys)) == USER


def test_expired_token_is_401(keys):
    with pytest.raises(HTTPException) as e:
        run(make(keys, exp_in=-10))
    assert e.value.status_code == 401


def test_bad_signature_is_401(keys):
    other = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(HTTPException) as e:
        run(make(other))  # same kid, wrong key
    assert e.value.status_code == 401


def test_wrong_audience_is_401(keys):
    with pytest.raises(HTTPException) as e:
        run(make(keys, aud="anon-not-a-user"))
    assert e.value.status_code == 401


def test_garbage_is_401(keys):
    with pytest.raises(HTTPException) as e:
        run("not-a-jwt")
    assert e.value.status_code == 401


def test_demo_token_still_works():
    assert run(auth.DEMO_TOKEN) == auth.DEMO_USER_ID


def test_kx_token_rejected_on_web_endpoints():
    with pytest.raises(HTTPException) as e:
        run("kx_anything")
    assert e.value.status_code == 403


def test_remote_fallback_never_caches_an_invalid_token(keys, monkeypatch):
    """Unknown kid → can't verify locally → Supabase decides; a 401 is not cached."""
    calls = []

    class Resp:
        def __init__(self, code):
            self.status_code = code

        def json(self):
            return {"id": USER}

    class Client:
        def __init__(self, codes):
            self.codes = codes

        async def get(self, *a, **k):
            calls.append(1)
            return Resp(self.codes.pop(0))

    monkeypatch.setattr(auth, "_load_jwks", lambda force=False: {})
    token = make(keys, kid="unknown")
    client = Client([401, 200, 200])
    monkeypatch.setattr(auth, "_client", lambda: client)
    with pytest.raises(HTTPException):
        run(token)
    assert run(token) == USER  # the 401 was not cached: asked again
    assert run(token) == USER  # now a valid answer is cached
    assert len(calls) == 2


def test_remote_cache_never_outlives_exp(keys, monkeypatch):
    class Resp:
        status_code = 200

        def json(self):
            return {"id": USER}

    class Client:
        async def get(self, *a, **k):
            return Resp()

    monkeypatch.setattr(auth, "_load_jwks", lambda force=False: {})
    monkeypatch.setattr(auth, "_client", lambda: Client())
    token = make(keys, exp_in=5, kid="unknown")
    run(token)
    assert auth._remote_cache[token][1] <= jwt.decode(token, options={"verify_signature": False})["exp"]
