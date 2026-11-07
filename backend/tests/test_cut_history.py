"""Cut history: upsert by (account, date), isolation, debt-only, and the $0
streak that feeds korex_logros."""
import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, ApiTokenAudit, CutHistory

A = "abababab-abab-4bab-abab-abababababab"
B = "cdcdcdcd-cdcd-4dcd-adcd-cdcdcdcdcdcd"
H = {"Authorization": "Bearer x"}


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (CutHistory, ApiTokenAudit, Account):
            for row in s.exec(select(model).where(model.user_id.in_([A, B]))).all():
                s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def acct(uid, name, type_="debt"):
    with Session(database.engine) as s:
        a = Account(user_id=uid, name=name, type=type_, balance=500, interest_rate=20, min_payment=25)
        s.add(a)
        s.commit()
        s.refresh(a)
        return a.id


def cut(client, account_id, day, bal, **kw):
    return client.post("/api/cuts", headers=H, json={"account_id": account_id, "cut_date": day,
                                                     "reported_balance": bal, **kw})


def test_recording_the_same_cut_twice_updates_it(client):
    as_user(A)
    v = acct(A, "Visa")
    r = cut(client, v, "2026-10-15", 120.50)
    assert r.status_code == 200 and r.json()["created"] is True and r.json()["was_zero"] is False
    r = cut(client, v, "2026-10-15", 0, source="operador-ia")
    assert r.json()["created"] is False and r.json()["was_zero"] is True and r.json()["source"] == "operador-ia"
    cuts = client.get(f"/api/cuts?account_id={v}", headers=H).json()["cuts"]
    assert len(cuts) == 1 and cuts[0]["reported_balance"] == 0


def test_foreign_account_is_404_and_non_debt_is_422(client):
    b_card = acct(B, "Ajena")
    as_user(A)
    assert cut(client, b_card, "2026-10-15", 0).status_code == 404
    chk = acct(A, "Cheques", "checking")
    assert cut(client, chk, "2026-10-15", 0).status_code == 422
    assert cut(client, acct(A, "Visa"), "2026-10-15", -5).status_code == 422


def test_list_is_descending_and_isolated(client):
    as_user(A)
    v = acct(A, "Visa")
    for d in ("2026-08-15", "2026-10-15", "2026-09-15"):
        cut(client, v, d, 0)
    as_user(B)
    assert client.get("/api/cuts", headers=H).json()["cuts"] == []
    as_user(A)
    assert [c["cut_date"] for c in client.get("/api/cuts", headers=H).json()["cuts"]] == ["2026-10-15", "2026-09-15", "2026-08-15"]


@pytest.mark.parametrize("balances,expected", [((0, 0, 0), 3), ((0, 90, 0), 1), ((0, 0, 40), 0)])
def test_streak_counts_back_from_the_latest_cut(client, balances, expected):
    as_user(A)
    v, mc = acct(A, "Visa"), acct(A, "MC")
    # chronological across cards: Visa Aug, MC Sep, Visa Oct
    for (account, day), bal in zip(((v, "2026-08-15"), (mc, "2026-09-20"), (v, "2026-10-15")), balances):
        cut(client, account, day, bal)
    lg = client.get("/api/logros", headers=H).json()["racha_cortes_cero"]
    assert lg["valor"] == expected and "nota" not in lg
    streaks = client.get("/api/cuts", headers=H).json()["streaks"]
    assert streaks[str(v)] == (2 if balances[0] == balances[2] == 0 else (1 if balances[2] == 0 else 0))


def test_no_cuts_keeps_null_with_note(client):
    as_user(A)
    lg = client.get("/api/logros", headers=H).json()["racha_cortes_cero"]
    assert lg["valor"] is None and lg["nota"]


def test_cut_write_is_audited_and_scoped(client):
    from tests.test_api_tokens import bearer, make_token
    v = acct(A, "Visa")
    read = make_token(client, A, scopes=["read:accounts"])
    assert client.post("/api/cuts", headers=bearer(read), json={"account_id": v, "cut_date": "2026-10-15",
                                                                 "reported_balance": 0}).status_code == 403
    assert client.get("/api/cuts", headers=bearer(read)).status_code == 200
    rw = make_token(client, A, scopes=["write:accounts"])
    assert client.post("/api/cuts", headers=bearer(rw), json={"account_id": v, "cut_date": "2026-10-15",
                                                               "reported_balance": 0, "source": "operador-ia"}).status_code == 200
    with Session(database.engine) as s:
        assert s.exec(select(ApiTokenAudit).where(ApiTokenAudit.user_id == A)).first().summary.startswith("Corte de Visa")
