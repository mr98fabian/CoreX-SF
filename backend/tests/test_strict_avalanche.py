"""U-13, owner's decision 2026-11-13 ("vamos por eficiencia"): STRICT AVALANCHE everywhere.
No plan pays a lower-APR debt ahead of a higher-APR one while there is surplus: no Float Kill
(by due date, smallest first), no Hybrid Kill (freed minimum × 12), no gap-first.
Minimums and contractual obligations are not "surplus" and stay exempt."""
from datetime import date
from decimal import ROUND_HALF_UP, Decimal as D
from pathlib import Path

import velocity_engine as ve
from velocity_engine import DebtAccount, compare_paths, generate_action_plan

ROOT = Path(__file__).resolve().parents[2]


def debt(n, b, a, m, s="credit_card", due=5):
    return DebtAccount(name=n, balance=D(str(b)), interest_rate=D(str(a)), min_payment=D(str(m)), debt_subtype=s, due_day=due)


# The owner's debts (audit 2026-11-04)
OWNER = [debt("Amex Gold", 3327.50, 28.74, 99.96), debt("Upstart", 9463.94, 32.30, 331.04, "personal_loan"),
         debt("Carro", 15325.11, 20.29, 641.12, "auto_loan"), debt("Sapphire", 29.36, 26.99, 25),
         debt("Chase 4884", 86.49, 27.74, 25), debt("Slate 2323", 10.95, 0, 10.95), debt("Fortiva", 92.38, 36.0, 25),
         debt("Capital One", 49.76, 29.99, 25)]


def _replica(debts, extra, policy):
    """Monthly replica: same budget, freed minimums roll. 'avalanche' = all extra to max APR;
    'legacy' = the removed Float Kill + Hybrid Kill order (the U-13 harness)."""
    ds = [debt(d.name, d.balance, d.interest_rate, ve.plan_minimum(d), d.debt_subtype) for d in debts if d.balance > 0]
    total, months = D(0), 0
    while any(d.balance > 0 for d in ds) and months < 600:
        months += 1
        for d in ds:
            if d.balance <= 0:
                continue
            i = (d.balance * d.monthly_rate).quantize(D("0.01"), rounding=ROUND_HALF_UP)  # same as the engine
            d.balance += i
            total += i
            d.balance -= min(d.balance, d.min_payment)
        ammo = D(extra) + sum((d.min_payment for d in ds if d.balance <= 0), D(0))

        def pay(d, amt):
            nonlocal ammo
            p = min(amt, d.balance)
            d.balance -= p
            ammo -= p
        if policy == "legacy":
            for d in sorted([d for d in ds if d.balance > 0 and d.is_revolving], key=lambda d: d.balance):
                if ammo <= 10:
                    break
                pay(d, ammo)
            act = [d for d in ds if d.balance > 0]
            if ammo > 10 and len(act) > 1:
                t = max(act, key=lambda d: d.interest_rate)
                for c in sorted([d for d in act if d.balance <= ammo and d is not t], key=lambda d: d.balance):
                    if (c.min_payment + (ammo - c.balance) * t.monthly_rate) * 12 > ammo * t.monthly_rate * 12:
                        pay(c, c.balance)
                        break
        for d in sorted([d for d in ds if d.balance > 0], key=lambda d: d.interest_rate, reverse=True):
            if ammo <= (10 if policy == "legacy" else 0):
                break
            pay(d, ammo)
    return months, total


def test_tactical_plan_attacks_only_the_highest_live_apr():
    from datetime import timedelta
    from velocity_engine import MissionAccount
    start = date(2026, 12, 2)
    accs = [MissionAccount(name="Tarjeta chica", balance=D("120"), interest_rate=D("18"), min_payment=D("35"), debt_subtype="credit_card", due_day=8),
            MissionAccount(name="Tarjeta media", balance=D("900"), interest_rate=D("24"), min_payment=D("35"), debt_subtype="credit_card", due_day=10),
            MissionAccount(name="La cara", balance=D("4000"), interest_rate=D("31"), min_payment=D("120"), debt_subtype="credit_card", due_day=20),
            MissionAccount(name="Préstamo", balance=D("6000"), interest_rate=D("12"), min_payment=D("250"), debt_subtype="personal_loan", due_day=15)]
    days = [start + timedelta(days=i) for i in range(100)]
    incomes = [{"name": "Nómina", "amount": D("3000"), "dates": {x for x in days if x.day in (1, 15)}}]
    plan = generate_action_plan(accs, incomes, [], D("1500"), shield_target=D("500"), start=start)
    live = {a.name: a.balance for a in accs}
    apr = {a.name: a.interest_rate for a in accs}
    assert any(m["type"] == "attack" for m in plan), "the plan must attack with the surplus"
    for m in plan:
        assert m["type"] not in ("float_kill", "hybrid_kill")
        if m["type"] == "attack":
            top = max((n for n, b in live.items() if b > 0), key=lambda n: apr[n])
            assert m["destination"] == top, f"{m['date']}: attacked {m['destination']} while {top} ({apr[top]}%) was alive"
        if m["type"] in ("attack", "min_payment", "obligation") and m.get("destination") in live:
            live[m["destination"]] = max(D(0), live[m["destination"]] - D(str(m["amount"])))


def test_simulator_has_no_gap_first():
    """A low-APR debt whose minimum does not cover its interest used to get the extra first."""
    debts = [debt("Cara", 5000, 30, 200), debt("Barata que crece", 50000, 10, 100, "personal_loan")]
    for extra in (316, 600):
        engine = compare_paths(debts, D(extra), start=date(2026, 12, 1))["plan"]
        months, interest = _replica(debts, extra, "avalanche")
        assert (engine["meses"], D(str(engine["interes_total"]))) == (months, interest)


def test_owner_debts_engine_is_pure_avalanche_and_never_pays_more_than_before():
    """Measured 2026-11-13 (BEFORE = removed tactical order, AFTER = strict avalanche):
    $300 7,723.00 → 7,505.26 · $600 5,983.33 → 5,870.39 · $1,000 4,672.09 → 4,583.15 · $1,500 3,696.52 → 3,633.40."""
    expected = {300: (D("7723.00"), D("7505.26")), 600: (D("5983.33"), D("5870.39")),
                1000: (D("4672.09"), D("4583.15")), 1500: (D("3696.52"), D("3633.40"))}
    for extra, (before, after) in expected.items():
        legacy = _replica(OWNER, extra, "legacy")
        avalanche = _replica(OWNER, extra, "avalanche")
        engine = compare_paths(OWNER, D(extra), start=date(2026, 12, 1))["plan"]
        assert (legacy[1], avalanche[1]) == (before, after)
        assert D(str(engine["interes_total"])) == avalanche[1] and engine["meses"] == avalanche[0]
        assert avalanche[1] <= legacy[1] and avalanche[0] <= legacy[0]


def test_no_float_or_hybrid_kill_left_anywhere():
    assert not hasattr(ve, "detect_float_kill_opportunities") and not hasattr(ve, "get_hybrid_kill_target")
    sources = [ROOT / "backend" / "velocity_engine.py", ROOT / "backend" / "routers" / "strategy.py", ROOT / "mcp" / "korex_mcp.py",
               ROOT / "frontend" / "src" / "features" / "actionplan" / "ActionPlanPage.tsx",
               ROOT / "frontend" / "src" / "components" / "WidgetHelp.tsx", ROOT / "frontend" / "src" / "contexts" / "LanguageContext.tsx"]
    for p in sources:
        text = p.read_text(encoding="utf-8")
        for banned in ('"float_kill"', '"hybrid_kill"', "float_kills", "hybrid_kill_analysis", "gap_coverage", "Gap-First",
                       "Smallest balance first", "Menor saldo primero", "builder"):
            assert banned not in text, f"{p.name} still has {banned}"


def test_every_surface_names_the_same_strategy():
    mcp = (ROOT / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
    assert "Avalancha estricta: el dinero extra va SIEMPRE a la deuda de interés más alto" in mcp
    assert "avalancha" in (ROOT / "frontend" / "src" / "features" / "attack" / "AttackPage.tsx").read_text(encoding="utf-8")
    assert "Avalanche method" in (ROOT / "frontend" / "src" / "components" / "WidgetHelp.tsx").read_text(encoding="utf-8")
    assert "The only strategy: avalanche" in (ROOT / "backend" / "velocity_engine.py").read_text(encoding="utf-8")
