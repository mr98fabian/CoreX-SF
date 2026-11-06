"""One DB session per request (perf 2026-11-05): handler and guards
(plan_guard, require_scope) share database.request_session()."""
import pytest
from sqlmodel import Session

from auth import get_current_user_id
from main import app
from tests.test_api_tokens import A, add_account, bearer, clean, login, make_token  # noqa: F401  (clean is autouse)


@pytest.fixture
def session_counter(monkeypatch):
    opened = []
    real = Session.__init__

    def counting(self, *a, **k):
        opened.append(1)
        real(self, *a, **k)

    monkeypatch.setattr(Session, "__init__", counting)
    return opened


@pytest.mark.parametrize("path", ["/api/dashboard", "/api/accounts", "/api/cashflow", "/api/velocity/freedom-path",
                                  "/api/strategy/tactical-gps", "/api/strategy/command-center"])
def test_real_user_request_opens_one_session(client, session_counter, path):
    add_account(A, "Visa", "1000.00")
    login(A)  # real user path: plan_guard looks up the subscription too
    try:
        session_counter.clear()
        assert client.get(path).status_code == 200
        assert len(session_counter) == 1
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)


def test_api_token_request_opens_one_session(client, session_counter):
    add_account(A, "Visa", "1000.00")
    tok = make_token(client, A)
    session_counter.clear()
    assert client.get("/api/dashboard", headers=bearer(tok)).status_code == 200  # require_scope + plan + handler
    assert len(session_counter) == 1


def test_writes_still_commit_through_the_shared_session(client):
    acc = add_account(A, "Visa", "1000.00")
    tok = make_token(client, A)
    r = client.post("/api/transactions/manual", headers=bearer(tok),
                    json={"account_id": acc, "amount": 100, "description": "Pago", "category": "payment", "date": "2026-11-05"})
    assert r.status_code == 200
    login(A)
    try:
        bal = {a["id"]: a for a in client.get("/api/accounts").json()}[acc]["balance"]
        assert float(bal) == 900.0
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
