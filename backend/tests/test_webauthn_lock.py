"""Fingerprint lock (WebAuthn): registration and unlock against a software
platform authenticator (EC P-256, 'none' attestation), plus the guard rails."""
import hashlib
import json
import struct

import cbor2
import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url

ORIGIN = "http://localhost:5173"
RP_ID = "localhost"


class SoftAuthenticator:
    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.cred_id = b"kx-test-credential-0001"
        self.count = 0

    def _cose(self) -> bytes:
        n = self.key.public_key().public_numbers()
        return cbor2.dumps({1: 2, 3: -7, -1: 1, -2: n.x.to_bytes(32, "big"), -3: n.y.to_bytes(32, "big")})

    @staticmethod
    def _client_data(kind: str, challenge: str, origin: str = ORIGIN) -> bytes:
        return json.dumps({"type": kind, "challenge": challenge, "origin": origin, "crossOrigin": False}).encode()

    def create(self, options: dict, origin: str = ORIGIN) -> dict:
        cd = self._client_data("webauthn.create", options["challenge"], origin)
        auth = (hashlib.sha256(options["rp"]["id"].encode()).digest() + bytes([0x45]) + struct.pack(">I", 0)
                + b"\x00" * 16 + struct.pack(">H", len(self.cred_id)) + self.cred_id + self._cose())
        att = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": auth})
        cid = bytes_to_base64url(self.cred_id)
        return {"id": cid, "rawId": cid, "type": "public-key",
                "response": {"clientDataJSON": bytes_to_base64url(cd), "attestationObject": bytes_to_base64url(att)}}

    def get(self, options: dict) -> dict:
        self.count += 1
        cd = self._client_data("webauthn.get", options["challenge"])
        auth = hashlib.sha256(options["rpId"].encode()).digest() + bytes([0x05]) + struct.pack(">I", self.count)
        sig = self.key.sign(auth + hashlib.sha256(cd).digest(), ec.ECDSA(hashes.SHA256()))
        cid = bytes_to_base64url(self.cred_id)
        return {"id": cid, "rawId": cid, "type": "public-key",
                "response": {"clientDataJSON": bytes_to_base64url(cd), "authenticatorData": bytes_to_base64url(auth),
                             "signature": bytes_to_base64url(sig)}}


@pytest.fixture
def h(auth_headers):
    return {**auth_headers, "Origin": ORIGIN}


@pytest.fixture
def clean(client, h):
    yield
    client.delete(f"/api/webauthn/credentials/{bytes_to_base64url(b'kx-test-credential-0001')}", headers=h)


def _register(client, h, a):
    opts = client.post("/api/webauthn/register/options", headers=h).json()
    assert opts["rp"]["id"] == RP_ID
    assert opts["authenticatorSelection"]["authenticatorAttachment"] == "platform"
    return client.post("/api/webauthn/register/verify", headers=h, json={"credential": a.create(opts)})


def test_register_then_unlock(client, h, clean):
    a = SoftAuthenticator()
    assert _register(client, h, a).json() == {"registered": True}
    assert client.get("/api/webauthn/status", headers=h).json() == {"registered": True}

    opts = client.post("/api/webauthn/auth/options", headers=h).json()
    assert opts["allowCredentials"][0]["id"] == bytes_to_base64url(a.cred_id)
    r = client.post("/api/webauthn/auth/verify", headers=h, json={"credential": a.get(opts)})
    assert r.status_code == 200 and r.json() == {"unlocked": True}


def test_challenge_is_single_use(client, h, clean):
    a = SoftAuthenticator()
    _register(client, h, a)
    opts = client.post("/api/webauthn/auth/options", headers=h).json()
    cred = a.get(opts)
    assert client.post("/api/webauthn/auth/verify", headers=h, json={"credential": cred}).status_code == 200
    assert client.post("/api/webauthn/auth/verify", headers=h, json={"credential": cred}).status_code == 400


def test_wrong_key_does_not_unlock(client, h, clean):
    a = SoftAuthenticator()
    _register(client, h, a)
    impostor = SoftAuthenticator()  # same credential id, different private key
    opts = client.post("/api/webauthn/auth/options", headers=h).json()
    assert client.post("/api/webauthn/auth/verify", headers=h, json={"credential": impostor.get(opts)}).status_code == 400


def test_foreign_origin_is_rejected(client, auth_headers):
    r = client.post("/api/webauthn/register/options", headers={**auth_headers, "Origin": "https://evil.example"})
    assert r.status_code == 400


def test_registration_from_another_origin_fails(client, h, clean):
    a = SoftAuthenticator()
    opts = client.post("/api/webauthn/register/options", headers=h).json()
    r = client.post("/api/webauthn/register/verify", headers=h,
                    json={"credential": a.create(opts, origin="https://evil.example")})
    assert r.status_code == 400


@pytest.mark.parametrize("method,path", [
    ("get", "/api/webauthn/status"), ("post", "/api/webauthn/register/options"),
    ("post", "/api/webauthn/register/verify"), ("post", "/api/webauthn/auth/options"),
    ("post", "/api/webauthn/auth/verify"), ("delete", "/api/webauthn/credentials/x"),
])
def test_endpoints_need_a_session(client, method, path):
    r = getattr(client, method)(path, headers={"Origin": ORIGIN}, **({"json": {"credential": {}}} if method == "post" else {}))
    assert r.status_code == 401
