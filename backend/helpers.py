"""
Shared helpers used across multiple routers.
- FK bypass context manager
- Account → DebtAccount conversion
- Common balance update logic
- Fuzzy account name matching
"""
from contextlib import contextmanager
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import text
from velocity_engine import DebtAccount

DEMO_USER_ID = "00000000-0000-4000-a000-000000000001"

# A payment to a debt, however it was recorded: manual payment ("payment") or a
# confirmed attack ("Debt Payment"). Compared lower-case. One list for logros,
# the daily mission and Análisis.
PAYMENT_CATEGORIES = ("payment", "debt payment")


def is_payment_category(category) -> bool:
    return (category or "").lower() in PAYMENT_CATEGORIES


@contextmanager
def bypass_fk(session):
    """Temporarily disable FK constraint checks for SQLite; noop for Postgres."""
    from database import engine as _engine
    if _engine.dialect.name == "sqlite":
        session.execute(text("PRAGMA foreign_keys = OFF"))
        try:
            yield
        finally:
            session.execute(text("PRAGMA foreign_keys = ON"))
    else:
        yield


def today():
    """THE app's clock for every number shown to the user (dashboard, plan, calendar, GPS,
    command-center, push). One function so every surface computes at the same instant and the
    concordance tests can fix the day (tests/test_concordancia.py)."""
    from datetime import date as _date
    return _date.today()


def _debt_account(acc) -> DebtAccount:
    """Build a DebtAccount from an Account ORM row."""
    return DebtAccount(
        name=acc.name, balance=acc.balance, interest_rate=acc.interest_rate,
        min_payment=acc.min_payment or Decimal("0"), due_day=acc.due_day or None,  # no date loaded = never billed (U-11)
        closing_day=acc.closing_day or 0, debt_subtype=acc.debt_subtype or "",
        credit_limit=acc.credit_limit or Decimal("0"),
    )

def account_plan_minimum(acc) -> Decimal:
    """The minimum every screen charges for this account: velocity_engine.plan_minimum
    (the single source; the stored value is only an input to it and the bank's
    display), capped at the balance. 0 for non-debt or paid-off accounts."""
    from velocity_engine import plan_minimum
    if acc.type != "debt" or acc.balance <= 0:
        return Decimal("0")
    return min(plan_minimum(_debt_account(acc)), Decimal(str(acc.balance))).quantize(Decimal("0.01"))


def accounts_to_debt_objects(accounts) -> list[DebtAccount]:
    return [_debt_account(acc) for acc in accounts if acc.type == "debt" and acc.balance > 0]


def filter_active_debt_accounts(accounts, plan_limit: int | None = None):
    debts = [acc for acc in accounts if acc.type == "debt" and acc.balance > 0]
    debts.sort(key=lambda a: a.interest_rate, reverse=True)
    return debts[:plan_limit] if plan_limit and plan_limit > 0 else debts


def accounts_to_active_debt_objects(accounts, plan_limit: int | None = None) -> list[DebtAccount]:
    return [_debt_account(acc) for acc in filter_active_debt_accounts(accounts, plan_limit)]


def get_liquid_cash(accounts) -> Decimal:
    return sum(acc.balance for acc in accounts if acc.type != "debt")


def funding_accounts(accounts) -> list:
    """Accounts money can come FROM: any non-debt account with a positive
    balance (checking, savings, cash…), largest first — the same notion of
    liquid as get_liquid_cash. A user whose money lives in a "cash" account
    must not be treated as having nothing."""
    return sorted([acc for acc in accounts if acc.type != "debt" and acc.balance > 0],
                  key=lambda x: x.balance, reverse=True)


def get_shield_target(session, user_id: str) -> Decimal:
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_PEACE_SHIELD
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    return Decimal(str(settings.shield_target)) if settings and settings.shield_target is not None else DEFAULT_PEACE_SHIELD


def get_plan_settings(session, user_id: str) -> tuple:
    """(shield_target, attack_percentage) from ONE user_settings read — same values as
    get_shield_target and get_attack_percentage, for endpoints that need both."""
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_ATTACK_PERCENTAGE, DEFAULT_PEACE_SHIELD
    st = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    shield = Decimal(str(st.shield_target)) if st and st.shield_target is not None else DEFAULT_PEACE_SHIELD
    attack = Decimal(str(st.attack_percentage)) if st and st.attack_percentage is not None else DEFAULT_ATTACK_PERCENTAGE
    return shield, attack


def get_attack_percentage(session, user_id: str) -> Decimal:
    """% of liquid cash attacked monthly — the single assumption behind every
    velocity banking projection (debt-free date, interest saved). Scoped per
    user, same pattern as get_shield_target."""
    from sqlmodel import select
    from models import UserSettings
    from velocity_engine import DEFAULT_ATTACK_PERCENTAGE
    settings = session.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
    return Decimal(str(settings.attack_percentage)) if settings and settings.attack_percentage is not None else DEFAULT_ATTACK_PERCENTAGE


def norm_name(name: str) -> str:
    """Name for the "same service" match between a recurring item and a
    subscription: lower-case, no spaces or punctuation. 'Planet Fitness' ==
    'planet-fitness'; 'Hello Fitness (en cancelación)' != 'Hello Fitness'."""
    import re
    return re.sub(r"[\W_]+", "", (name or "").lower())


def is_income_item(item) -> bool:
    return bool(item.is_income or item.category == "income")


def load_cashflow_inputs(session, user_id: str) -> dict:
    """THE single loader of the monthly cashflow inputs. Every monthly surplus
    and summary (strategy, coach, dashboard, /api/cashflow/summary, Análisis)
    reads its tuples from here, so they can't drift apart.
    Returns the rows and the (amount, frequency, is_income) tuples."""
    from sqlmodel import select
    from models import CashflowItem, RecurringSubscription
    items = session.exec(select(CashflowItem).where(CashflowItem.user_id == user_id)).all()
    active_subs = session.exec(select(RecurringSubscription).where(
        RecurringSubscription.user_id == user_id, RecurringSubscription.status == "active")).all()
    # A living expense whose normalised name matches an ACTIVE subscription is the
    # same service typed twice: it counts once, on the subscription side (same rule
    # as Análisis). Nothing is deleted. Cancelled subscriptions never count.
    sub_names = {norm_name(s.name) for s in active_subs} - {""}
    dupes = [i for i in items if not is_income_item(i) and not is_payment_category(i.category)
             and norm_name(i.name) in sub_names]
    dupe_ids = {id(i) for i in dupes}
    return {
        "items": items,
        "tuples": [(i.amount, i.frequency, is_income_item(i)) for i in items if id(i) not in dupe_ids],
        "subscriptions": [(s.amount, s.frequency) for s in active_subs],
        "active_subs": active_subs,
        "dupes": dupes,
    }


def get_cashflow_breakdown(session, user_id: str, debts, data: dict | None = None) -> dict:
    """Surplus with and without subscriptions, for the Plan's transparency line:
    when subscriptions take the whole surplus the UI says so (never a silent
    'minimums only'). `data`: load_cashflow_inputs already read in this request."""
    from velocity_engine import monthly_amount, monthly_surplus
    data = data if data is not None else load_cashflow_inputs(session, user_id)
    surplus = monthly_surplus(data["tuples"], debts, data["subscriptions"])
    without = monthly_surplus(data["tuples"], debts)
    subs = sum((monthly_amount(a, f) for a, f in data["subscriptions"]), Decimal("0")).quantize(Decimal("0.01"))
    return {
        "surplus": surplus,
        "subscriptions_monthly": subs,
        "eaten_by_subscriptions": surplus is not None and surplus == 0 and (without or 0) > 0,
    }


def get_cashflow_surplus(session, user_id: str, debts):
    """The user's monthly surplus from their cashflow (velocity_engine.monthly_surplus),
    or None when no income is on record (callers then use the declared default)."""
    from velocity_engine import monthly_surplus
    data = load_cashflow_inputs(session, user_id)
    return monthly_surplus(data["tuples"], debts, data["subscriptions"])


# ── Balance Update Helpers ───────────────────────────────────

def _insufficient_funds_error(account, amount: Decimal):
    """Standardized insufficient-funds HTTPException."""
    return HTTPException(
        status_code=400,
        detail={
            "code": "INSUFFICIENT_FUNDS",
            "message": f"Fondos insuficientes. {account.name} tiene ${account.balance:.2f}, no se puede deducir ${abs(amount):.2f}.",
            "account_name": account.name,
            "current_balance": float(account.balance),
            "requested_amount": float(abs(amount)),
        },
    )


def update_account_balance(account, amount: Decimal, category: str = None) -> Decimal:
    """
    Update account balance after a transaction.
    Returns the actual amount applied (capped for debt payments).
    Raises HTTPException(400) if insufficient funds on non-debt accounts.
    """
    abs_amt = abs(amount)

    if account.type == "debt":
        if category == "payment":
            applied = min(abs_amt, account.balance)
            account.balance -= applied
            return applied
        account.balance += abs_amt
        return abs_amt

    # Non-debt: guard against negative balance
    new_balance = account.balance + amount
    if new_balance < 0:
        raise _insufficient_funds_error(account, amount)
    account.balance = new_balance
    return amount


def find_account_by_name(accounts: list, name: str):
    """Fuzzy account name match: exact → case-insensitive → partial."""
    # Exact
    for acc in accounts:
        if acc.name == name:
            return acc
    # Case-insensitive
    name_lower = name.lower().strip()
    for acc in accounts:
        if acc.name.lower().strip() == name_lower:
            return acc
    # Partial
    for acc in accounts:
        if name_lower in acc.name.lower() or acc.name.lower() in name_lower:
            return acc
    return None


# ── Projection Helpers ───────────────────────────────────────

def calc_days_recovered(std_date_str: str, vel_date_str: str, months_saved: int = 0) -> int:
    """Calculate days recovered between standard and velocity freedom dates."""
    from datetime import datetime as _dt
    try:
        return max(0, (_dt.fromisoformat(std_date_str) - _dt.fromisoformat(vel_date_str)).days)
    except (ValueError, TypeError):
        return months_saved * 30


def calc_attack_streak(executed_logs) -> dict:
    """Calculate current attack streak from executed movement logs."""
    from datetime import date
    total = len(executed_logs)
    streak = 0
    if executed_logs:
        months = {log.date_executed[:7] for log in executed_logs if log.date_executed}
        check = date.today().replace(day=1)
        for _ in range(24):
            key = check.strftime("%Y-%m")
            if key in months:
                streak += 1
                check = date(check.year - 1, 12, 1) if check.month == 1 else date(check.year, check.month - 1, 1)
            else:
                break
    return {"current": streak, "total_attacks": total}


# ── Daily mission (one source for Inicio and Plan) ───────────

def cashflow_events(items, start, days: int):
    """Real recurring incomes and expenses as dated events in [start, start+days):
    any frequency (monthly, semi-monthly, weekly, biweekly, annual) expanded with
    the cashflow's own trigger rule. Income = is_income flag (or the legacy
    category "income"). Nothing invented when there is nothing on record."""
    from datetime import timedelta
    from routers.cashflow import _item_triggers
    incomes, expenses = [], []
    for it in items:
        dates = {start + timedelta(days=i) for i in range(days) if _item_triggers(it, start + timedelta(days=i))}
        if not dates:
            continue
        ev = {"name": it.name, "amount": abs(Decimal(str(it.amount))), "dates": dates,
              "kind": "ingreso" if (it.is_income or it.category == "income") else "gasto"}
        (incomes if (it.is_income or it.category == "income") else expenses).append(ev)
    return incomes, expenses



def payday_rule(items):
    """date -> True on a day any income item pays (the cashflow's own trigger rule,
    as cashflow_events). velocity_engine.daily_series places the plan's attack there."""
    from routers.cashflow import _item_triggers
    incomes = [it for it in items if is_income_item(it)]
    return lambda d: any(_item_triggers(it, d) for it in incomes)

def subscription_occurs_on(sub, d) -> bool:
    """Backend port of frontend/src/lib/subscriptionOccurrences.ts (same rule as the
    calendar): only ACTIVE subscriptions with a next_charge_date occur.
      monthly → the anchor's day every month, clamped to month end (31 → 30/29/28)
      weekly  → every 7 days from the anchor, in both directions
      annual  → only its own date
    No date on record → never: a charge day is never invented."""
    import calendar
    from datetime import date as _date
    if sub.status != "active" or not sub.next_charge_date:
        return False
    try:
        a = _date.fromisoformat(str(sub.next_charge_date)[:10])
    except ValueError:
        return False
    if sub.frequency == "monthly":
        return d.day == min(a.day, calendar.monthrange(d.year, d.month)[1])
    if sub.frequency == "weekly":
        return (d - a).days % 7 == 0
    return d == a


def dated_cashflow(session, user_id: str, start, days: int, data: dict | None = None):
    """Dated incomes/expenses for the attack and the daily mission (safe equity):
    recurring items + charges of ACTIVE subscriptions that have a next_charge_date.
    A recurring item that duplicates a DATED subscription is dropped (the service
    is charged once, on the subscription's day); if the subscription has no date,
    the recurring item stays so the service is not lost from this path."""
    from datetime import timedelta
    data = data if data is not None else load_cashflow_inputs(session, user_id)  # already read? pass it
    dated = [s for s in data["active_subs"] if s.next_charge_date]
    dated_names = {norm_name(s.name) for s in dated}
    dupe_ids = {id(i) for i in data["dupes"] if norm_name(i.name) in dated_names}
    incomes, expenses = cashflow_events([i for i in data["items"] if id(i) not in dupe_ids], start, days)
    for s in dated:
        dates = {start + timedelta(days=i) for i in range(days) if subscription_occurs_on(s, start + timedelta(days=i))}
        if dates:
            expenses.append({"name": s.name, "amount": abs(Decimal(str(s.amount))), "dates": dates,
                             "kind": "suscripcion", "id": s.id, "logo_url": s.logo_url, "account_id": s.account_id})
    return incomes, expenses


def mission_accounts_for(session, user_id: str, debts, today=None) -> list:
    """Debts as the mission sees them (last cut, payments since it, statement minimum).
    ONE builder for the daily mission and the Calendar, so both read the same cycle."""
    from sqlmodel import select
    from models import CutHistory, Transaction
    from velocity_engine import MissionAccount
    ids = [a.id for a in debts if a.id is not None]
    last_cut = {}
    if ids:
        for c in session.exec(select(CutHistory).where(CutHistory.user_id == user_id, CutHistory.account_id.in_(ids))
                              .order_by(CutHistory.cut_date.desc())).all():
            last_cut.setdefault(c.account_id, c)
    # ONE query for the payments of every debt since its cut (was one per debt: N round trips to the DB)
    txs_by_account: dict = {}
    if last_cut:
        since = min(c.cut_date for c in last_cut.values()).isoformat()
        for t in session.exec(select(Transaction).where(Transaction.user_id == user_id,
                                                        Transaction.account_id.in_(list(last_cut)),
                                                        Transaction.date > since)).all():
            txs_by_account.setdefault(t.account_id, []).append(t)
    out = []
    for a in debts:
        cut = last_cut.get(a.id)
        paid = Decimal("0")
        if cut:
            txs = [t for t in txs_by_account.get(a.id, []) if t.date > cut.cut_date.isoformat()]
            # manual payments AND confirmed attacks ("Debt Payment") both reduce the statement
            paid = sum((abs(Decimal(str(t.amount))) for t in txs if is_payment_category(t.category)), Decimal("0"))
        out.append(MissionAccount(
            name=a.name, balance=Decimal(str(a.balance)), interest_rate=Decimal(str(a.interest_rate or 0)),
            min_payment=Decimal(str(a.min_payment or 0)), debt_subtype=a.debt_subtype or "",
            due_day=a.due_day or None, closing_day=a.closing_day or None,
            last_cut_date=cut.cut_date if cut else None,
            last_cut_reported=Decimal(str(cut.reported_balance)) if cut else None, paid_since_cut=paid,
            statement_minimum=Decimal(str(cut.statement_minimum)) if cut and cut.statement_minimum is not None else None,
            statement_due=cut.statement_due_date if cut else None,
            engine_minimum=account_plan_minimum(a),
        ))
    return out


def undated_subscriptions_monthly(data: dict) -> Decimal:
    """Monthly total of ACTIVE subscriptions with no charge date: the dated paths never paint
    them on a made-up day, so the mission keeps that month out of the attack instead."""
    from velocity_engine import monthly_amount
    return sum((monthly_amount(s.amount, s.frequency) for s in data["active_subs"] if not s.next_charge_date),
               Decimal("0")).quantize(Decimal("0.01"))


def build_daily_mission(session, user_id: str, accounts, plan_limit: int | None = None, today=None,
                        cashflow=None, shield_target=None, data: dict | None = None, mission_accounts=None):
    """Gathers the user's data and asks the engine (velocity_engine.get_daily_mission).
    Callers (dashboard, command-center) only serialize the result. A caller that already
    loaded `cashflow` (dated_cashflow for today and MISSION_WINDOW_DAYS) or `shield_target`
    in this request passes them, so the same rows are not fetched twice."""
    from datetime import date as _date
    from velocity_engine import MISSION_WINDOW_DAYS, get_daily_mission
    today = today or globals()["today"]()
    if mission_accounts is None:
        mission_accounts = mission_accounts_for(session, user_id, filter_active_debt_accounts(accounts, plan_limit), today)
    data = data if data is not None else load_cashflow_inputs(session, user_id)
    incomes, expenses = cashflow if cashflow is not None else dated_cashflow(session, user_id, today, MISSION_WINDOW_DAYS, data=data)
    if shield_target is None:
        shield_target = get_shield_target(session, user_id)
    return get_daily_mission(mission_accounts, Decimal(str(get_liquid_cash(accounts))), shield_target,
                             incomes, expenses, today=today, undated_monthly=undated_subscriptions_monthly(data))


def total_debt(accounts, plan_limit: int | None = None) -> Decimal:
    """THE total debt every surface shows: open debts of the plan-limited set."""
    return sum((Decimal(str(a.balance)) for a in filter_active_debt_accounts(accounts, plan_limit)), Decimal("0"))


def weapons_for(accounts) -> list:
    """HELOC / UIL lines with room: the velocity weapons of the cash route."""
    from velocity_engine import VelocityWeapon
    return [VelocityWeapon(name=a.name, balance=Decimal(str(a.balance)), credit_limit=Decimal(str(a.credit_limit or 0)),
                           interest_rate=Decimal(str(a.interest_rate)), weapon_type=a.debt_subtype or "heloc")
            for a in accounts
            if a.type == "debt" and a.debt_subtype in ("heloc", "uil") and (a.credit_limit or 0) > a.balance]


def build_plan_path(session, user_id: str, accounts, plan_limit: int | None = None, today=None,
                    data: dict | None = None, shield_target=None, attack_percentage=None, mission_accounts=None) -> dict:
    """Gathers the user's data and asks the engine for THE projection (velocity_engine.debt_path):
    Calendar, freedom date, «pagarás / ahorrarás», GPS movements and command-center read this
    one result, so they cannot disagree. Rows already read in the request can be passed in."""
    from velocity_engine import DEBT_PATH_HORIZON, MISSION_WINDOW_DAYS, debt_path, monthly_attack, monthly_surplus
    today = today or globals()["today"]()
    data = data if data is not None else load_cashflow_inputs(session, user_id)
    if shield_target is None or attack_percentage is None:
        shield_target, attack_percentage = get_plan_settings(session, user_id)
    debts = filter_active_debt_accounts(accounts, plan_limit)
    if mission_accounts is None:
        mission_accounts = mission_accounts_for(session, user_id, debts, today)
    incomes, expenses = dated_cashflow(session, user_id, today, DEBT_PATH_HORIZON + 32 + MISSION_WINDOW_DAYS, data=data)
    liquid = Decimal(str(get_liquid_cash(accounts)))
    surplus = monthly_surplus(data["tuples"], [_debt_account(a) for a in debts], data["subscriptions"])
    extra = monthly_attack(surplus, liquid, attack_percentage)
    funding = funding_accounts(accounts)
    return debt_path(mission_accounts, incomes, expenses, liquid, shield_target, extra, weapons=weapons_for(accounts),
                     today=today, is_payday=payday_rule(data["items"]),
                     funding_account_name=funding[0].name if funding else "Checking",
                     undated_monthly=undated_subscriptions_monthly(data))


def cashflow_summary_for(session, user_id: str, plan_limit: int | None = None) -> dict:
    """The user's monthly summary (velocity_engine.cashflow_summary, Decimal).
    One call site for GET /api/cashflow/summary and GET /api/analytics/v2."""
    from sqlmodel import select
    from models import Account
    from velocity_engine import cashflow_summary
    accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    debts = accounts_to_active_debt_objects(accounts, plan_limit)
    data = load_cashflow_inputs(session, user_id)
    return cashflow_summary(data["tuples"], debts, data["subscriptions"])


def calendar_month(session, user_id: str, year: int, month: int, plan_limit: int | None = None, today=None) -> dict:
    """Events of one month for the Calendar, built with THE SAME functions as the
    daily mission (one source, so the calendar and the mission never disagree):
      - incomes / bills / dated subscriptions → dated_cashflow (duplicates once)
      - minimums → account_plan_minimum on due_day; with a statement minimum still owed, the
        mission's own number (statement_cycle_minimum) on the statement's due date
      - cuts → closing_day, with velocity_engine.corte_action_date
    Subscriptions without next_charge_date are not painted (no invented day) but counted."""
    import calendar as _cal
    from datetime import date as _date
    from sqlmodel import select
    from models import Account
    from velocity_engine import corte_action_date, statement_cycle_minimum
    today = today or _date.today()
    n = _cal.monthrange(year, month)[1]
    start = _date(year, month, 1)
    incomes, expenses = dated_cashflow(session, user_id, start, n)
    accounts = session.exec(select(Account).where(Account.user_id == user_id)).all()
    names = {a.id: a.name for a in accounts}
    debts = [a for a in filter_active_debt_accounts(accounts, plan_limit) if a.balance > 0]
    data = load_cashflow_inputs(session, user_id)
    undated = [s for s in data["active_subs"] if not s.next_charge_date]
    # Same cycle data and same function as the daily mission (statement minimum vs engine)
    cycle = mission_accounts_for(session, user_id, debts, today)
    cycle_min = {a.id: v for a, ma in zip(debts, cycle) if (v := statement_cycle_minimum(ma, today)) > 0}
    q = lambda x: Decimal(x).quantize(Decimal("0.01"))  # noqa: E731
    days = []
    for d in range(1, n + 1):
        day = _date(year, month, d)
        ingresos = [{"nombre": e["name"], "monto": q(e["amount"])} for e in incomes if day in e["dates"]]
        cobros = []
        for e in expenses:
            if day not in e["dates"]:
                continue
            row = {"nombre": e["name"], "monto": q(e["amount"]), "tipo": e.get("kind", "gasto")}
            if row["tipo"] == "suscripcion":
                row.update({"id": e.get("id"), "logo_url": e.get("logo_url"), "cuenta": names.get(e.get("account_id"))})
            cobros.append(row)
        for a, ma in zip(debts, cycle):
            stmt = cycle_min.get(a.id)
            if stmt is not None and ma.statement_due.year == year and ma.statement_due.month == month:
                # this month's bill IS the statement's: the mission's number, on the statement's date
                if d == ma.statement_due.day:
                    cobros.append({"nombre": a.name, "monto": stmt, "tipo": "minimo", "fuente": "estado"})
            elif a.due_day and d == min(a.due_day, n):
                m = account_plan_minimum(a)
                if m > 0:
                    cobros.append({"nombre": a.name, "monto": m, "tipo": "minimo"})
        cortes = [{"nombre": a.name, "saldo": q(a.balance), "pagar_antes_de": corte_action_date(day, today).isoformat()}
                  for a in debts if a.closing_day and d == min(a.closing_day, n)]
        days.append({
            "dia": d, "fecha": day.isoformat(),
            "marcas": {"payday": bool(ingresos), "cobro": bool(cobros), "corte": bool(cortes)},
            "ingresos": ingresos, "cobros": cobros, "cortes": cortes,
            "total_entra": sum((x["monto"] for x in ingresos), Decimal("0")),
            "total_sale": sum((x["monto"] for x in cobros), Decimal("0")),
        })
    total_out = sum((x["total_sale"] for x in days), Decimal("0"))
    return {
        "mes": f"{year:04d}-{month:02d}",
        "dias": days,
        "total_mes_sale": total_out,
        "total_mes_entra": sum((x["total_entra"] for x in days), Decimal("0")),
        "vacio": not any(x["marcas"]["payday"] or x["marcas"]["cobro"] for x in days),
        "suscripciones_sin_fecha": len(undated),
        "deudas_sin_fecha": [a.name for a in debts if not a.due_day],  # U-11: counted, never painted
        "etiqueta": "estimado",
    }
