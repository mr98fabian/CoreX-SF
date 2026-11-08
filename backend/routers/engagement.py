"""
Engagement — daily habit inside KoreX: points, daily streak and weekly leagues.

  POST /api/engagement/checkin   once a day when the app opens (idempotent)
  GET  /api/ranking              my week, my streak and, ONLY if opted in, my cohort

House rules: points only for habits that help (check-in 5, payment recorded 20,
$0 cut 50) — never for spending or amounts. Anonymous aliases, opt-in, and no
shame tables: the table shows the top 10 plus my own row, nothing else.
"""
import random
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import func, select

from auth import get_current_user_id
from database import request_session
from models import CoachProfile, EngagementPoint, LeagueWeek

router = APIRouter(prefix="/api", tags=["engagement"])

POINTS = {"checkin": 5, "payment": 20, "cut_zero": 50}
TIERS = ("bronce", "plata", "oro", "diamante")
TIER_LABEL = {"bronce": "Bronce", "plata": "Plata", "oro": "Oro", "diamante": "Diamante"}
COHORT_MAX = 30
ANIMALS = ("Zorro", "Lince", "Halcón", "Búho", "Puma", "Colibrí", "Lobo", "Delfín", "Jaguar", "Cóndor", "Ocelote", "Quetzal", "Mapache")
COLORS = ("Ámbar", "Índigo", "Jade", "Coral", "Cobalto", "Marfil", "Ónix", "Cobre", "Turquesa", "Grafito")


def generate_alias() -> str:
    return f"{random.choice(ANIMALS)} {random.choice(COLORS)} {random.randint(1, 99)}"


def award(session, user_id: str, action: str, ref: str = "", day: Optional[date] = None) -> bool:
    """Add the points of `action` once per (user, day, action, ref). Caller commits."""
    day = day or date.today()
    exists = session.exec(select(EngagementPoint).where(
        EngagementPoint.user_id == user_id, EngagementPoint.date == day,
        EngagementPoint.action == action, EngagementPoint.ref == ref)).first()
    if exists:
        return False
    session.add(EngagementPoint(user_id=user_id, date=day, action=action, points=POINTS[action], ref=ref))
    return True


def award_once(session, user_id: str, action: str, ref: str) -> bool:
    """Like award, but unique by (action, ref) on any date: a payment or a cut
    scores once in its life, whatever day it is re-sent."""
    exists = session.exec(select(EngagementPoint).where(
        EngagementPoint.user_id == user_id, EngagementPoint.action == action, EngagementPoint.ref == ref)).first()
    return False if exists else award(session, user_id, action, ref)


def revoke(session, user_id: str, action: str, ref: str) -> None:
    for row in session.exec(select(EngagementPoint).where(
            EngagementPoint.user_id == user_id, EngagementPoint.action == action, EngagementPoint.ref == ref)).all():
        session.delete(row)


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def daily_streak(checkins: set[date], today: date) -> int:
    """Consecutive days with a check-in. One missed day per ISO week is forgiven
    (grace): the streak doesn't die for ONE missed day. Today not yet checked in
    is not a miss."""
    d = today if today in checkins else today - timedelta(days=1)
    n, grace_used = 0, set()
    floor = min(checkins) if checkins else today
    while d >= floor:
        if d in checkins:
            n += 1
        else:
            wk = week_start(d)
            if wk in grace_used or (d - timedelta(days=1)) not in checkins:
                break
            grace_used.add(wk)
        d -= timedelta(days=1)
    return n


def _week_points(session, user_ids: list[str], start: date) -> dict[str, int]:
    if not user_ids:
        return {}
    rows = session.exec(select(EngagementPoint.user_id, func.sum(EngagementPoint.points))
                        .where(EngagementPoint.user_id.in_(user_ids), EngagementPoint.date >= start,
                               EngagementPoint.date < start + timedelta(days=7))
                        .group_by(EngagementPoint.user_id)).all()
    out = {u: 0 for u in user_ids}
    out.update({u: int(p or 0) for u, p in rows})
    return out


def _opted_in(session, user_ids: list[str]) -> set[str]:
    if not user_ids:
        return set()
    return set(session.exec(select(CoachProfile.user_id).where(
        CoachProfile.user_id.in_(user_ids), CoachProfile.ranking_opt_in == True)).all())  # noqa: E712


def _ranked(session, rows: list[LeagueWeek]) -> list[tuple[LeagueWeek, int]]:
    """Cohort members (opted-in only) with live week points, best first."""
    ids = [r.user_id for r in rows]
    keep = _opted_in(session, ids)
    pts = _week_points(session, ids, rows[0].week_start) if rows else {}
    members = [(r, pts.get(r.user_id, 0)) for r in rows if r.user_id in keep]
    return sorted(members, key=lambda m: (-m[1], m[0].id or 0))


def _cohort_rows(session, lw: LeagueWeek) -> list[LeagueWeek]:
    return session.exec(select(LeagueWeek).where(LeagueWeek.week_start == lw.week_start,
                                                 LeagueWeek.tier == lw.tier, LeagueWeek.cohort == lw.cohort)).all()


def next_tier(session, prev: LeagueWeek) -> str:
    """At the close of a week: top 25% go up, bottom 25% go down (bronce never
    goes down, diamante never up)."""
    ranked = _ranked(session, _cohort_rows(session, prev))
    k = len(ranked) // 4
    pos = next((i for i, (r, _) in enumerate(ranked) if r.user_id == prev.user_id), None)
    i = TIERS.index(prev.tier)
    if pos is None or k == 0:
        return prev.tier
    if pos < k and i < len(TIERS) - 1:
        return TIERS[i + 1]
    if pos >= len(ranked) - k and i > 0:
        return TIERS[i - 1]
    return prev.tier


def ensure_league(session, user_id: str, today: date) -> LeagueWeek:
    start = week_start(today)
    lw = session.exec(select(LeagueWeek).where(LeagueWeek.user_id == user_id, LeagueWeek.week_start == start)).first()
    if lw:
        return lw
    prev = session.exec(select(LeagueWeek).where(LeagueWeek.user_id == user_id, LeagueWeek.week_start < start)
                        .order_by(LeagueWeek.week_start.desc())).first()
    tier = next_tier(session, prev) if prev and prev.week_start == start - timedelta(days=7) else (prev.tier if prev else "bronce")
    counts = dict(session.exec(select(LeagueWeek.cohort, func.count()).where(
        LeagueWeek.week_start == start, LeagueWeek.tier == tier).group_by(LeagueWeek.cohort)).all())
    cohort = next((c for c in sorted(counts) if counts[c] < COHORT_MAX), max(counts, default=0) + 1)
    lw = LeagueWeek(user_id=user_id, week_start=start, tier=tier, cohort=cohort)
    session.add(lw)
    session.commit()
    session.refresh(lw)
    return lw


def leave_leagues(session, user_id: str, today: date) -> None:
    """Opt-out: out of this week's cohort right away."""
    for lw in session.exec(select(LeagueWeek).where(LeagueWeek.user_id == user_id,
                                                    LeagueWeek.week_start == week_start(today))).all():
        session.delete(lw)


@router.post("/engagement/checkin")
async def checkin(user_id: str = Depends(get_current_user_id)):
    with request_session() as session:
        new = award(session, user_id, "checkin")
        session.commit()
        return {"checked_in": True, "new": new, "points": POINTS["checkin"] if new else 0}


@router.get("/ranking")
async def ranking(user_id: str = Depends(get_current_user_id)):
    today = date.today()
    with request_session() as session:
        checkins = set(session.exec(select(EngagementPoint.date).where(
            EngagementPoint.user_id == user_id, EngagementPoint.action == "checkin")).all())
        mine = _week_points(session, [user_id], week_start(today))[user_id]
        base = {"week_points": mine, "streak_days": daily_streak(checkins, today)}
        profile = session.exec(select(CoachProfile).where(CoachProfile.user_id == user_id)).first()
        if not profile or not profile.ranking_opt_in:
            return {"opt_in": False, **base}

        lw = ensure_league(session, user_id, today)
        ranked = _ranked(session, _cohort_rows(session, lw))
        aliases = dict(session.exec(select(CoachProfile.user_id, CoachProfile.ranking_alias).where(
            CoachProfile.user_id.in_([r.user_id for r, _ in ranked]))).all())
        for r, p in ranked:  # points snapshot
            if r.points != p:
                r.points = p
                session.add(r)
        session.commit()
        table = [{"position": i + 1, "alias": aliases.get(r.user_id) or "Anónimo", "points": p, "me": r.user_id == user_id}
                 for i, (r, p) in enumerate(ranked)]
        me = next(row for row in table if row["me"])
        shown = table[:10] + ([me] if me["position"] > 10 else [])
        return {"opt_in": True, **base, "alias": profile.ranking_alias, "tier": lw.tier, "tier_label": TIER_LABEL[lw.tier],
                "position": me["position"], "cohort_size": len(table), "week_start": lw.week_start.isoformat(),
                "table": shown}
