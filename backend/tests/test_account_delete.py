"""Mi Cuenta: DELETE /api/user/me wipes every row of the user in every table, deletes the
Supabase login, kills its tokens, and never touches anything when the check fails."""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
import sqlalchemy as sa
from sqlmodel import Session, select

import api_tokens
import auth
import database
import supabase_admin
from auth import get_current_user_id
from main import app
from models import (Account, ApiToken, ApiTokenAudit, CoachProfile, CutHistory, Goal, OAuthCode, OAuthRefreshToken,
                    Subscription, Transaction, UserSettings)
from routers.account import user_tables

X = "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee"   # the one who deletes
Y = "ffffffff-ffff-4fff-afff-ffffffffffff"   # a neighbour whose data must survive
URL = "/api/user/me"


class Supa:
    def __init__(self):
        self.users = {X: {"email": "x@korex.test", "providers": ["email"]}, Y: {"email": "y@korex.test", "providers": ["google"]}}
        self.password = "correct horse"
        self.deleted, self.fail_delete = [], False

    async def get(self, uid):
        return self.users.get(uid)

    async def check(self, email, password):
        return password == self.password

    async def delete(self, uid):
        if self.fail_delete:
            return False
        self.deleted.append(uid)
        self.users.pop(uid, None)
        return True


@pytest.fixture
def supa(monkeypatch):
    s = Supa()
    monkeypatch.setenv("SUPABASE_URL", "https://supa.test")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service")
    monkeypatch.setattr(supabase_admin, "get_auth_user", s.get)
    monkeypatch.setattr(supabase_admin, "password_ok", s.check)
    monkeypatch.setattr(supabase_admin, "delete_auth_user", s.delete)
    api_tokens._hits.clear()
    yield s
    app.dependency_overrides.pop(get_current_user_id, None)
    auth.DELETED_USERS.clear()
    with Session(database.engine) as db:
        for t in user_tables():
            db.execute(t.delete().where(t.c.user_id.in_([X, Y])))
        db.commit()


def login(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def seed(uid, client):
    """A user with data in every kind of table: accounts, transactions, cuts, goals, settings,
    subscription, coach, a manual API token (+ audit) and an OAuth grant."""
    with Session(database.engine) as db:
        db.add(Subscription(user_id=uid, plan="freedom", status="active"))
        acc = Account(user_id=uid, name="Visa", type="debt", balance=Decimal("900"), interest_rate=Decimal("25"), min_payment=Decimal("30"))
        db.add(acc); db.commit(); db.refresh(acc)
        db.add(Transaction(user_id=uid, account_id=acc.id, date="2026-11-01", amount=Decimal("50"), description="pago", category="payment"))
        db.add(CutHistory(user_id=uid, account_id=acc.id, cut_date=date(2026, 11, 2), reported_balance=Decimal("0")))
        db.add(Goal(user_id=uid, name="Fondo", target_amount=Decimal("500")))
        db.add(UserSettings(user_id=uid))
        db.add(CoachProfile(user_id=uid))
        db.commit()
    login(uid)
    token = client.post("/api/tokens", json={"name": "laptop", "scopes": ["read:accounts", "write:accounts"]}).json()["token"]
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as db:
        row = db.exec(select(ApiToken).where(ApiToken.user_id == uid)).one()
        db.add(ApiTokenAudit(token_id=row.id, user_id=uid, action="POST /api/accounts", detail="write:accounts"))
        oauth = ApiToken(user_id=uid, name="Mi asistente", token_hash=api_tokens.hash_token(f"kx_oauth_{uid}"), scopes=["read:accounts"],
                         source="oauth", expires_at=datetime.utcnow() + timedelta(hours=1))
        db.add(oauth); db.commit(); db.refresh(oauth)
        db.add(OAuthRefreshToken(token_hash=f"r{uid}", client_id="kxc_1", user_id=uid, api_token_id=oauth.id, family_id="f",
                                 scopes=["read:accounts"], expires_at=datetime.utcnow() + timedelta(days=1)))
        db.add(OAuthCode(kind="code", token_hash=f"c{uid}", client_id="kxc_1", user_id=uid, redirect_uri="https://x.test/cb",
                         code_challenge="c" * 43, scopes=["read:accounts"], expires_at=datetime.utcnow() + timedelta(minutes=5)))
        db.commit()
    return token, f"kx_oauth_{uid}"


def counts(uid):
    with Session(database.engine) as db:
        return {t.name: db.execute(sa.select(sa.func.count()).select_from(t).where(t.c.user_id == uid)).scalar() for t in user_tables()}


def test_deletes_every_row_of_the_user_and_nothing_of_anyone_else(client, supa):
    seed(X, client)
    seed(Y, client)
    before_y = counts(Y)
    assert sum(counts(X).values()) >= 11
    login(X)
    r = client.request("DELETE", URL, json={"password": "correct horse"})
    assert r.status_code == 200 and r.json() == {"deleted": True}
    assert all(n == 0 for n in counts(X).values()), counts(X)  # no orphans, in any table with user_id
    assert counts(Y) == before_y
    assert supa.deleted == [X]  # the Supabase login itself is gone


def test_tables_are_found_automatically():
    names = {t.name for t in user_tables()}
    assert {"accounts", "transactions", "subscriptions", "goals", "cut_history", "user_settings", "api_tokens",
            "api_token_audit", "oauth_codes", "oauth_refresh_tokens", "coach_profiles", "house_goals"} <= names
    order = [t.name for t in user_tables()]
    assert order.index("transactions") < order.index("accounts") and order.index("cut_history") < order.index("accounts")


def test_tokens_of_a_deleted_user_answer_401(client, supa):
    manual, oauth = seed(X, client)
    assert client.get("/api/accounts", headers={"Authorization": f"Bearer {manual}"}).status_code == 200
    login(X)
    assert client.request("DELETE", URL, json={"password": "correct horse"}).status_code == 200
    app.dependency_overrides.pop(get_current_user_id, None)
    for tok in (manual, oauth):
        assert client.get("/api/accounts", headers={"Authorization": f"Bearer {tok}"}).status_code == 401


@pytest.mark.anyio
async def test_the_session_jwt_dies_with_the_account(client, supa, monkeypatch):
    seed(X, client)
    login(X)
    assert client.request("DELETE", URL, json={"password": "correct horse"}).status_code == 200
    monkeypatch.setattr(auth, "_verify_locally", lambda token: X)  # a still-unexpired, validly signed JWT
    with pytest.raises(Exception) as e:
        await auth.get_current_user_id("Bearer still.valid.jwt")
    assert getattr(e.value, "status_code", None) == 401


def test_wrong_password_deletes_nothing(client, supa):
    seed(X, client)
    before = counts(X)
    login(X)
    for body in ({"password": "nope"}, {}, {"confirm_email": "x@korex.test"}):  # email login needs the password
        r = client.request("DELETE", URL, json=body)
        assert r.status_code == 403 and "Nothing was deleted" in r.json()["detail"]
    assert counts(X) == before and supa.deleted == []


def test_google_only_account_confirms_with_its_email(client, supa):
    seed(Y, client)
    login(Y)
    assert client.request("DELETE", URL, json={"confirm_email": "other@korex.test"}).status_code == 403
    assert client.request("DELETE", URL, json={"confirm_email": " Y@korex.test "}).status_code == 200
    assert all(n == 0 for n in counts(Y).values())


def test_an_api_token_can_never_delete_the_account(client, supa):
    manual, oauth = seed(X, client)
    for tok in (manual, oauth):
        r = client.request("DELETE", URL, json={"password": "correct horse"}, headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403
    assert sum(counts(X).values()) > 0 and supa.deleted == []


def test_if_the_login_cant_be_deleted_the_data_stays(client, supa):
    seed(X, client)
    before = counts(X)
    supa.fail_delete = True
    login(X)
    r = client.request("DELETE", URL, json={"password": "correct horse"})
    assert r.status_code == 502 and counts(X) == before


def test_without_the_service_key_nothing_happens(client, supa, monkeypatch):
    seed(X, client)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY")
    login(X)
    assert client.request("DELETE", URL, json={"password": "correct horse"}).status_code == 503
    assert sum(counts(X).values()) > 0


def test_the_demo_cant_be_deleted(client, supa):
    login(auth.DEMO_USER_ID)
    assert client.request("DELETE", URL, json={"password": "x"}).status_code == 403
