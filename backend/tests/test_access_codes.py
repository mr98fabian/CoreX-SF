"""Códigos de acceso: HMAC-only, atomic single use, one resolver (grant > paid > starter),
owner-only admin, founder hidden from public plans but with AI open."""
from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, select

import access_codes
import database
from access_codes import RedeemError, code_hmac, create_code, redeem
from auth import DEMO_USER_ID, get_current_user_id
from main import app
from models import AccessCode, AccessGrant, Subscription
from plan_guard import ai_access_for, entitlement, plan_limit_for
from routers import codes as codes_router

OWNER = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a"
U1 = "c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1"
U2 = "c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2"
H = {"Authorization": "Bearer x"}


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.setenv("OWNER_USER_ID", OWNER)
    codes_router.limiter.reset()
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (AccessGrant, AccessCode):
            for row in s.exec(select(model)).all():
                s.delete(row)
        for row in s.exec(select(Subscription).where(Subscription.user_id.in_([OWNER, U1, U2]))).all():
            s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def make(kind="founder", **kw):
    with Session(database.engine) as s:
        row, plain = create_code(s, kind=kind, created_by=OWNER, **kw)
        return row.id, plain


def paid(uid, plan="velocity"):
    with Session(database.engine) as s:
        s.add(Subscription(user_id=uid, plan=plan, status="active"))
        s.commit()


def ent(uid):
    with Session(database.engine) as s:
        return entitlement(s, uid)


def give(code, uid, **kw):
    with Session(database.engine) as s:
        return redeem(s, code, uid, **kw)


# ── Codes & HMAC ─────────────────────────────────────────────

def test_format_entropy_and_hmac_only():
    cid, plain = make("founder")
    assert access_codes.CODE_RE.match(plain) and plain.startswith("KX-FND-")
    assert not set(plain[7:].replace("-", "")) & set("0O1IL")
    with Session(database.engine) as s:
        row = s.get(AccessCode, cid)
        assert row.code_hmac == code_hmac(plain) and plain not in (row.code_hmac, row.prefix)
        assert row.prefix == plain[:10]


def test_hmac_accepts_the_right_code_and_rejects_another(monkeypatch):
    _, plain = make("founder")
    assert code_hmac(plain) == code_hmac(plain.lower().replace("-", " "))  # pasted sloppily, same code
    other = plain[:-1] + ("2" if plain[-1] != "2" else "3")
    assert code_hmac(other) != code_hmac(plain)
    with pytest.raises(RedeemError):
        give(other, U1)
    monkeypatch.setenv("ACCESS_CODE_HMAC_KEY", "a-different-key")  # key rotated → old codes are dead
    with pytest.raises(RedeemError):
        give(plain, U1)


def test_no_key_in_production_disables_codes(monkeypatch):
    for var in ("ACCESS_CODE_HMAC_KEY", "SUPABASE_JWT_SECRET"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(access_codes.CodesDisabled):
        code_hmac("KX-FND-AAAAAA-AAAAAA")


# ── Resolver ─────────────────────────────────────────────────

def test_resolver_precedence_grant_over_paid_over_starter():
    assert ent(U1)["plan"] == "starter"
    paid(U1, "velocity")
    assert (ent(U1)["plan"], ent(U1)["source"]) == ("velocity", "subscription")
    _, gift = make("months", months=3)
    give(gift, U1)
    assert (ent(U1)["plan"], ent(U1)["source"]) == ("freedom", "grant")
    _, fnd = make("founder")
    give(fnd, U1)
    assert ent(U1)["plan"] == "founder"
    paid(U2, "freedom")  # same rank: the gift wins the tie, the plan is the same
    _, gift2 = make("months", months=1)
    give(gift2, U2)
    assert ent(U2)["plan"] == "freedom" and ent(U2)["grant_plan"] == "freedom"


def test_demo_lives_inside_the_resolver():
    assert ent(DEMO_USER_ID)["source"] == "demo"
    with Session(database.engine) as s:
        assert plan_limit_for(s, DEMO_USER_ID) is None  # full product in the sandbox
        assert ai_access_for(s, DEMO_USER_ID)[0] is False  # but never an AI connection


def test_gift_months_stack_on_gifts_not_on_paid():
    paid(U1, "velocity")
    _, a = make("months", months=3)
    _, b = make("months", months=6)
    now = datetime(2026, 11, 8, 12)
    g1 = give(a, U1, now=now)
    g2 = give(b, U1, now=now)
    assert g1.starts_at == now and g1.ends_at == datetime(2027, 2, 8, 12)
    assert g2.starts_at == g1.ends_at and g2.ends_at == datetime(2027, 8, 8, 12)


# ── Redeem endpoint ──────────────────────────────────────────

def test_founder_without_subscription_row_is_founder_in_status_and_has_ai(client):
    _, plain = make("founder")
    as_user(U1)
    r = client.post("/api/codes/redeem", json={"code": plain}, headers=H)
    assert r.status_code == 200 and r.json()["plan"] == "founder" and r.json()["permanent"] is True
    st = client.get("/api/subscriptions/status", headers=H).json()
    assert st["plan"] == "founder" and st["source"] == "grant" and st["checkout_hidden"] is True
    assert st["accounts_limit"] == 999
    with Session(database.engine) as s:
        assert ai_access_for(s, U1) == (True, "founder")
        assert plan_limit_for(s, U1) is None
    plans = {p["plan"] for p in client.get("/api/public/plans").json()}
    assert "founder" not in plans and "freedom-dev" not in plans


def test_same_user_cannot_redeem_the_same_code_twice(client):
    _, plain = make("months", months=1, max_uses=5)
    as_user(U1)
    assert client.post("/api/codes/redeem", json={"code": plain}, headers=H).status_code == 200
    second = client.post("/api/codes/redeem", json={"code": plain}, headers=H)
    assert second.status_code == 400 and second.json()["detail"] == codes_router.GENERIC


def test_concurrent_double_redeem_of_a_single_use_code_gives_one_success():
    """User 2 redeems inside user 1's window (after the lookup, before the claim)."""
    _, plain = make("founder")
    real_execute = Session.execute
    fired = {"done": False}

    def racing_execute(self, stmt, *a, **kw):
        if not fired["done"] and getattr(stmt, "is_update", False):
            fired["done"] = True
            Session.execute = real_execute
            give(plain, U2)  # wins the race
        return real_execute(self, stmt, *a, **kw)

    Session.execute = racing_execute
    try:
        with pytest.raises(RedeemError):
            give(plain, U1)
    finally:
        Session.execute = real_execute
    with Session(database.engine) as s:
        assert [g.user_id for g in s.exec(select(AccessGrant)).all()] == [U2]
        assert s.exec(select(AccessCode)).first().uses_count == 1


@pytest.mark.parametrize("state", ["revoked", "expired", "used"])
def test_revoked_expired_or_exhausted_codes_are_rejected(client, state):
    cid, plain = make("months", months=1)
    with Session(database.engine) as s:
        row = s.get(AccessCode, cid)
        if state == "revoked":
            row.revoked_at = datetime.utcnow()
        elif state == "expired":
            row.expires_at = datetime.utcnow() - timedelta(minutes=1)
        else:
            row.uses_count = row.max_uses
        s.add(row)
        s.commit()
    as_user(U1)
    r = client.post("/api/codes/redeem", json={"code": plain}, headers=H)
    assert r.status_code == 400 and r.json()["detail"] == codes_router.GENERIC
    assert ent(U1)["plan"] == "starter"


def test_demo_is_blocked_and_rate_limit_is_five_per_minute(client):
    _, plain = make("founder")
    as_user(DEMO_USER_ID)
    assert client.post("/api/codes/redeem", json={"code": plain}, headers=H).status_code == 403
    codes_router.limiter.reset()
    as_user(U1)
    statuses = [client.post("/api/codes/redeem", json={"code": "KX-FND-AAAAAA-AAAAAA"}, headers=H).status_code
                for _ in range(6)]
    assert statuses[:5] == [400] * 5 and statuses[5] == 429


def test_api_tokens_cannot_redeem(client):
    r = client.post("/api/codes/redeem", json={"code": "KX-FND-AAAAAA-AAAAAA"},
                    headers={"Authorization": "Bearer kx_" + "a" * 43})
    assert r.status_code == 403


def test_apply_promo_is_gone(client, auth_headers):
    r = client.post("/api/subscriptions/apply-promo", json={"code": "KOREX-DEV-UNLIMITED"}, headers=auth_headers)
    assert r.status_code in (404, 405)


def test_founder_cannot_checkout(client, monkeypatch):
    from routers import subscriptions
    monkeypatch.setattr(subscriptions, "LS_API_KEY", "test")
    monkeypatch.setattr(subscriptions, "LS_STORE_ID", "1")
    _, plain = make("founder")
    as_user(U1)
    client.post("/api/codes/redeem", json={"code": plain}, headers=H)
    r = client.post("/api/subscriptions/checkout", json={"plan": "velocity", "billing_cycle": "monthly"}, headers=H)
    assert r.status_code == 409


# ── Admin ────────────────────────────────────────────────────

def test_admin_is_owner_only_and_nobody_without_the_env(client, monkeypatch):
    as_user(U1)
    assert client.get("/api/admin/codes", headers=H).status_code == 403
    assert client.post("/api/admin/codes", json={"kind": "founder"}, headers=H).status_code == 403
    monkeypatch.delenv("OWNER_USER_ID")
    as_user(OWNER)
    assert client.get("/api/admin/codes", headers=H).status_code == 403


def test_admin_creates_shows_plain_once_lists_without_it_and_revokes(client):
    as_user(OWNER)
    created = client.post("/api/admin/codes", json={"kind": "months", "months": 6}, headers=H).json()
    assert created["code"].startswith("KX-REG-") and created["plan"] == "freedom" and created["status"] == "active"
    listed = client.get("/api/admin/codes", headers=H).json()
    assert len(listed) == 1 and "code" not in listed[0] and listed[0]["prefix"] == created["code"][:10]
    assert client.post(f"/api/admin/codes/{created['id']}/revoke", headers=H).json()["status"] == "revoked"
    as_user(U1)
    assert client.post("/api/codes/redeem", json={"code": created["code"]}, headers=H).status_code == 400


# ── Custom codes (owner-chosen) ──────────────────────────────

def test_custom_code_is_forgiving_to_type_and_single_use(client):
    as_user(OWNER)
    r = client.post("/api/admin/codes", json={"kind": "founder", "custom_code": "Elduenodelcastillo77"}, headers=H)
    assert r.status_code == 200 and r.json()["code"] == "Elduenodelcastillo77"
    assert r.json()["prefix"] == "ELD"  # only 3 chars stored in clear
    with Session(database.engine) as s:
        row = s.get(AccessCode, r.json()["id"])
        assert "ELDUENODELCASTILLO" not in row.code_hmac
    as_user(U1)  # typed naturally: lower case, ñ, spaces
    ok = client.post("/api/codes/redeem", json={"code": "el dueño del castillo 77"}, headers=H)
    assert ok.status_code == 200 and ok.json()["plan"] == "founder"
    as_user(U2)
    assert client.post("/api/codes/redeem", json={"code": "Elduenodelcastillo77"}, headers=H).status_code == 400


def test_custom_code_rules(client):
    as_user(OWNER)
    post = lambda c: client.post("/api/admin/codes", json={"kind": "founder", "custom_code": c}, headers=H)
    assert post("corto").status_code == 422          # < 8
    assert post("con!simbolos#raros").status_code == 422
    assert post("KXFNDAAAAAAAAAAAA").status_code == 422  # can't impersonate the generated format
    assert post("MiCodigoSecreto1").status_code == 200
    assert post("mi codigo secreto 1").status_code == 409  # same code after normalizing
    as_user(U1)
    assert client.post("/api/admin/codes", json={"kind": "founder", "custom_code": "OtroCodigo99"}, headers=H).status_code == 403


def test_months_code_grants_the_plan_on_sale_and_old_accelerator_grants_still_count():
    _, gift = make("months", months=3)
    assert give(gift, U1).plan == "freedom"
    with Session(database.engine) as s:  # a grant issued before the change
        cid, _ = make("months", months=1)
        s.add(AccessGrant(user_id=U2, plan="accelerator", starts_at=datetime.utcnow() - timedelta(days=1),
                          ends_at=datetime.utcnow() + timedelta(days=20), code_id=cid))
        s.commit()
    assert ent(U2)["plan"] == "accelerator" and plan_limit_for(Session(database.engine), U2) is None
