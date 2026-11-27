"""Mission 20 (H-01): in-app Plaid is off. The /api/plaid/* routes used to skip auth and
share one process-global access token, so user A could read/import user B's bank."""
import pytest

import plaid_service
from auth import get_current_user_id
from main import app
from models import Account
from routers import transactions
from sqlmodel import Session, select
from database import engine
from tests.route_list import iter_routes

USER_A = "aaaaaaaa-0000-4000-a000-00000000000a"
USER_B = "bbbbbbbb-0000-4000-a000-00000000000b"

PLAID_ROUTES = [
    ("get", "/api/plaid/create_link_token", None),
    ("post", "/api/plaid/exchange_public_token", {"public_token": "public-sandbox-x"}),
    ("get", "/api/plaid/accounts", None),
    ("post", "/api/plaid/import_accounts", None),
    ("post", "/api/plaid/sync_transactions", {"access_token": "access-sandbox-x"}),
]


@pytest.fixture
def fake_bank(monkeypatch):
    """If any route still reached Plaid, these fakes would hand out B's bank."""
    calls = []
    monkeypatch.setattr(plaid_service, "create_link_token", lambda *a: calls.append("link") or {"link_token": "link-x"})
    monkeypatch.setattr(plaid_service, "exchange_public_token",
                        lambda *a: calls.append("exchange") or {"access_token": "access-of-B", "item_id": "item-B"})
    monkeypatch.setattr(plaid_service, "get_accounts", lambda *a: calls.append("accounts") or [
        {"plaid_account_id": "plaid-acc-B", "name": "B Checking", "mask": "1234",
         "type": "depository", "subtype": "checking", "balance": 9999}])
    monkeypatch.setattr(plaid_service, "sync_transactions", lambda *a: calls.append("sync") or {"added": []})
    return calls


@pytest.fixture
def as_user():
    def _set(uid):
        app.dependency_overrides[get_current_user_id] = lambda: uid
    yield _set
    app.dependency_overrides.pop(get_current_user_id, None)


@pytest.mark.parametrize("method,path,body", PLAID_ROUTES)
def test_anonymous_plaid_routes_are_closed(client, fake_bank, method, path, body):
    r = getattr(client, method)(path, json=body) if body else getattr(client, method)(path)
    assert r.status_code == 404, (path, r.status_code, r.text)
    assert "accounts" not in r.json() and "link_token" not in r.json()
    assert fake_bank == []  # Plaid was never called


def test_cross_user_cannot_read_or_import_other_users_bank(client, fake_bank, as_user):
    # B "links" a bank: the old code kept B's token in a process-global dict.
    as_user(USER_B)
    assert client.post("/api/plaid/exchange_public_token", json={"public_token": "public-B"}).status_code == 404
    # A, logged in, tries to read and import whatever bank was linked last.
    as_user(USER_A)
    assert client.get("/api/plaid/accounts").status_code == 404
    assert client.post("/api/plaid/import_accounts").status_code == 404
    assert fake_bank == []
    with Session(engine) as s:
        leaked = s.exec(select(Account).where(Account.user_id == USER_A,
                                              Account.plaid_account_id == "plaid-acc-B")).all()
    assert leaked == []


def test_no_plaid_routes_are_mounted():
    mounted = [path for path, _ in iter_routes(app.routes)]
    assert len(mounted) > 50  # the scan really sees the routers (guards against a vacuous pass)
    assert [p for p in mounted if "/plaid" in p] == []


def test_switch_is_off_and_no_global_token_state():
    assert transactions.PLAID_IN_APP_ENABLED is False
    plaid_names = [n for n in vars(transactions) if "plaid" in n.lower()]
    assert plaid_names == ["PLAID_IN_APP_ENABLED"]  # no module-level token store
