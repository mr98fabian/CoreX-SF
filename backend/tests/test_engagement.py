"""Ranking y ligas: habit points (never by amount), daily streak with weekly
grace, opt-in leagues with anonymous aliases and capped cohorts."""
from datetime import date, timedelta

import pytest
from sqlmodel import Session, select

import database
from auth import get_current_user_id
from main import app
from models import Account, CoachProfile, CutHistory, EngagementPoint, LeagueWeek, Transaction
from routers import engagement as eng

A = "a1a1a1a1-a1a1-4a1a-a1a1-a1a1a1a1a1a1"
B = "b2b2b2b2-b2b2-4b2b-b2b2-b2b2b2b2b2b2"
H = {"Authorization": "Bearer x"}
COHORT_USERS = [f"c0c0c0c0-c0c0-4c0c-a0c0-{i:012d}" for i in range(31)]
ALL = [A, B, *COHORT_USERS]


@pytest.fixture(autouse=True)
def clean():
    yield
    app.dependency_overrides.pop(get_current_user_id, None)
    with Session(database.engine) as s:
        for model in (EngagementPoint, LeagueWeek, CutHistory, Transaction, CoachProfile, Account):
            for row in s.exec(select(model).where(model.user_id.in_(ALL))).all():
                s.delete(row)
        s.commit()


def as_user(uid):
    app.dependency_overrides[get_current_user_id] = lambda: uid


def debt(uid, balance=500):
    with Session(database.engine) as s:
        a = Account(user_id=uid, name="Visa", type="debt", balance=balance, interest_rate=20, min_payment=25)
        s.add(a)
        s.commit()
        s.refresh(a)
        return a.id


def points(uid, action=None):
    with Session(database.engine) as s:
        q = select(EngagementPoint).where(EngagementPoint.user_id == uid)
        if action:
            q = q.where(EngagementPoint.action == action)
        return sum(p.points for p in s.exec(q).all())


def test_checkin_is_idempotent_per_day(client):
    as_user(A)
    assert client.post("/api/engagement/checkin", headers=H).json()["new"] is True
    assert client.post("/api/engagement/checkin", headers=H).json()["new"] is False
    assert points(A) == 5


def test_payment_scores_20_once_per_transaction_never_by_amount(client):
    as_user(A)
    v = debt(A, 5000)
    for amount in (10, 900):
        assert client.post("/api/transactions/manual", headers=H, json={
            "account_id": v, "amount": amount, "description": "Pago", "category": "payment",
            "date": date.today().isoformat()}).status_code == 200
    assert points(A, "payment") == 40  # two payments, same points whatever the amount
    client.post("/api/transactions/manual", headers=H, json={
        "account_id": v, "amount": 50, "description": "Compra", "category": "purchase", "date": date.today().isoformat()})
    assert points(A, "payment") == 40  # spending never scores


def test_execute_payment_scores_once(client):
    as_user(A)
    with Session(database.engine) as s:
        s.add(Account(user_id=A, name="Cheques Eng", type="checking", balance=1000, interest_rate=0))
        s.add(Account(user_id=A, name="Tarjeta Eng", type="debt", balance=300, interest_rate=24, min_payment=25))
        s.commit()
    r = client.post("/api/strategy/execute", headers=H, json={"movement_key": "eng-1", "title": "Ataque", "amount": 100,
                                                              "date_planned": date.today().isoformat(),
                                                              "source": "Cheques Eng", "destination": "Tarjeta Eng"})
    assert r.status_code == 200, r.text
    assert points(A, "payment") == 20


def test_zero_cut_scores_50_and_a_correction_removes_it(client):
    as_user(A)
    v = debt(A)
    client.post("/api/cuts", headers=H, json={"account_id": v, "cut_date": "2026-10-15", "reported_balance": 0})
    client.post("/api/cuts", headers=H, json={"account_id": v, "cut_date": "2026-10-15", "reported_balance": 0})
    assert points(A, "cut_zero") == 50
    client.post("/api/cuts", headers=H, json={"account_id": v, "cut_date": "2026-11-15", "reported_balance": 80})
    assert points(A, "cut_zero") == 50
    client.post("/api/cuts", headers=H, json={"account_id": v, "cut_date": "2026-10-15", "reported_balance": 12})
    assert points(A, "cut_zero") == 0


def test_daily_streak_with_one_grace_day_per_iso_week():
    t = date(2026, 11, 7)  # Saturday

    def days(*offs):
        return {t - timedelta(days=o) for o in offs}

    assert eng.daily_streak(days(0, 1, 2), t) == 3
    assert eng.daily_streak(days(1, 2), t) == 2                 # today not yet checked in: not a miss
    assert eng.daily_streak(days(0, 2, 3), t) == 3              # one missed day forgiven
    assert eng.daily_streak(days(0, 3, 4), t) == 1              # two days in a row: the streak dies
    assert eng.daily_streak(days(0, 2, 4, 5), t) == 2           # second miss in the same ISO week: dies
    # Mon Nov 2 missed (week of Nov 2) and Thu Oct 29 missed (week of Oct 26): one grace each
    assert eng.daily_streak(days(0, 1, 2, 3, 4, 6, 7, 8, 10), t) == 9
    assert eng.daily_streak(set(), t) == 0


def test_opt_out_sees_only_personal_and_stays_out_of_cohorts(client):
    as_user(A)
    client.post("/api/engagement/checkin", headers=H)
    r = client.get("/api/ranking", headers=H).json()
    assert r == {"opt_in": False, "week_points": 5, "streak_days": 1}
    as_user(B)
    client.patch("/api/coach-profile", headers=H, json={"ranking_opt_in": True})
    table = client.get("/api/ranking", headers=H).json()["table"]
    assert all(row["alias"] for row in table) and sum(row["me"] for row in table) == 1
    with Session(database.engine) as s:
        assert not s.exec(select(LeagueWeek).where(LeagueWeek.user_id == A)).first()
    client.patch("/api/coach-profile", headers=H, json={"ranking_opt_in": False})  # B leaves: out right away
    with Session(database.engine) as s:
        assert not s.exec(select(LeagueWeek).where(LeagueWeek.user_id == B)).first()
    assert client.get("/api/ranking", headers=H).json()["opt_in"] is False


def test_alias_is_generated_on_opt_in_and_editable(client):
    as_user(A)
    p = client.patch("/api/coach-profile", headers=H, json={"ranking_opt_in": True}).json()
    animal, color, num = p["ranking_alias"].rsplit(" ", 2)
    assert animal in eng.ANIMALS and color in eng.COLORS and 1 <= int(num) <= 99
    p = client.patch("/api/coach-profile", headers=H, json={"ranking_alias": "Lince Veloz"}).json()
    assert p["ranking_alias"] == "Lince Veloz" and p["ranking_opt_in"] is True
    r = client.get("/api/ranking", headers=H).json()
    assert r["alias"] == "Lince Veloz" and r["tier"] == "bronce"
    assert set(r["table"][0]) == {"position", "alias", "points", "me"}  # no ids, no amounts


def test_cohorts_are_capped_at_30(client):
    for uid in COHORT_USERS:
        as_user(uid)
        client.patch("/api/coach-profile", headers=H, json={"ranking_opt_in": True})
        client.get("/api/ranking", headers=H)
    with Session(database.engine) as s:
        rows = s.exec(select(LeagueWeek).where(LeagueWeek.week_start == eng.week_start(date.today()),
                                               LeagueWeek.tier == "bronce")).all()
    sizes: dict[int, int] = {}
    for r in rows:
        sizes[r.cohort] = sizes.get(r.cohort, 0) + 1
    assert max(sizes.values()) <= 30
    r = client.get("/api/ranking", headers=H).json()
    assert r["cohort_size"] <= 30 and len(r["table"]) <= 11


def test_week_close_promotes_top_quarter_and_demotes_bottom():
    last = eng.week_start(date.today()) - timedelta(days=7)
    users = COHORT_USERS[:8]
    with Session(database.engine) as s:
        for i, uid in enumerate(users):
            s.add(CoachProfile(user_id=uid, ranking_opt_in=True, ranking_alias=f"U{i}"))
            s.add(LeagueWeek(user_id=uid, week_start=last, tier="plata", cohort=99))
            s.add(EngagementPoint(user_id=uid, date=last, action="checkin", points=100 - i * 10, ref=""))
        s.commit()
        tiers = [eng.next_tier(s, s.exec(select(LeagueWeek).where(LeagueWeek.user_id == u)).first()) for u in users]
    assert tiers == ["oro", "oro", "plata", "plata", "plata", "plata", "bronce", "bronce"]
