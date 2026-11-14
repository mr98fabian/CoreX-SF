"""U-14: the tactical GPS comes out of the daily mission's obligations. Cuts to $0 first,
dated commitments next, and ONLY the leftover attacks (strict avalanche). If the mission
says attack $0 today, the GPS does not open with an attack."""
from datetime import date, timedelta
from decimal import Decimal as D

from velocity_engine import MissionAccount, generate_action_plan, get_daily_mission

START = date(2026, 11, 13)
DAYS = [START + timedelta(days=i) for i in range(110)]


def card(name, bal, apr, closing=None, due=None, mn="35"):
    return MissionAccount(name=name, balance=D(bal), interest_rate=D(apr), min_payment=D(mn), debt_subtype="credit_card",
                          closing_day=closing, due_day=due)


def loan(name, bal, apr, mn, due):
    return MissionAccount(name=name, balance=D(bal), interest_rate=D(apr), min_payment=D(mn), debt_subtype="personal_loan", due_day=due)


def monthly(name, amount, *days):
    return {"name": name, "amount": D(amount), "dates": {x for x in DAYS if x.day in days}}


def once(name, amount, when):
    return {"name": name, "amount": D(amount), "dates": {when}}


def first_index(plan, pred):
    return next((i for i, m in enumerate(plan) if pred(m)), None)


def test_cut_in_ten_days_is_paid_before_the_first_attack():
    # last statement (Oct 23) already due on Nov 10: what is left is the cut to $0 on Nov 23
    accs = [card("Visa", "800", "22", closing=23, due=10), loan("Upstart", "9000", "32.3", "331", 5)]
    plan = generate_action_plan(accs, [monthly("Nómina", "3000", 1, 15)], [], D("4000"), shield_target=D("500"), start=START)
    cut_pay = first_index(plan, lambda m: m["type"] == "obligation" and m["destination"] == "Visa" and m["obligacion"] == "corte")
    first_attack = first_index(plan, lambda m: m["type"] == "attack")
    assert cut_pay is not None and first_attack is not None
    assert plan[cut_pay]["amount"] == 800.0 and plan[cut_pay]["date"] == "2026-11-21"  # cut 23 − 2
    # the attack happens, but never ahead of the uncovered cut: on day 1 the mission
    # already reserved the $800, so whatever attacks is only the leftover
    attacks_before_cut = [m for m in plan[:cut_pay] if m["type"] == "attack"]
    reserved_ok = all(D(str(m["funding_balance_after"])) >= D("800") for m in attacks_before_cut)
    assert reserved_ok, "an attack before the cut ate the cut's money"


def test_a_big_dated_expense_reduces_the_attack_by_the_same_amount():
    accs = [loan("Upstart", "60000", "32.3", "331", 5)]  # big target: attacks are never capped by its balance
    incomes = [monthly("Nómina", "4000", 1, 15)]
    base = generate_action_plan(accs, incomes, [], D("2000"), shield_target=D("500"), start=START)
    moved = generate_action_plan(accs, incomes, [once("Mudanza", "3270", date(2026, 12, 1))], D("2000"),
                                 shield_target=D("500"), start=START)
    attacked = lambda plan: sum(D(str(m["amount"])) for m in plan if m["type"] == "attack")  # noqa: E731
    assert attacked(base) - attacked(moved) == D("3270")
    # and no attack before the move takes what Dec 1 needs: the cash never falls under the shield
    assert min(D(str(m["funding_balance_after"])) for m in moved) >= D("500") - D("0.01")


def test_owner_like_scenario_no_attack_opens_the_plan_when_the_mission_says_zero():
    """Shape of the owner's data on 2026-11-13 (balances are illustrative, not production):
    cuts 2323 on Nov 21, 0563 / 9334 on Dec 1, 4884 on Dec 8, a $3,270 move on Dec 1, Upstart at 32.3%."""
    accs = [card("Slate 2323", "410", "0", closing=21, due=6), card("Tarjeta 0563", "650", "27.99", closing=1, due=26),
            card("Freedom 9334", "480", "25.49", closing=1, due=26), card("Chase 4884", "620", "27.74", closing=8, due=3),
            loan("Upstart", "9463.94", "32.30", "331.04", 5), loan("Carro", "15325.11", "20.29", "641.12", 12)]
    incomes = [monthly("Nómina", "2600", 1, 15)]
    expenses = [once("Mudanza", "3270", date(2026, 12, 1))]
    cash = D("3200")
    mission = get_daily_mission(accs, cash, D("500"), incomes, expenses, today=START)
    assert mission["ataque"] == 0  # the mission reserves the cuts and the move first
    plan = generate_action_plan(accs, incomes, expenses, cash, shield_target=D("500"), start=START)
    assert not [m for m in plan if m["type"] == "attack" and m["date"] == START.isoformat()]
    first = plan[0]
    assert first["type"] != "attack"
    # every cut is paid in full on cut − 2 (Slate 2323 → Nov 19) and no attack ever leaves one uncovered:
    # the attacks that do happen (after the Nov 15 payday) are only the leftover
    cut_2323 = first_index(plan, lambda m: m["type"] == "obligation" and m["destination"] == "Slate 2323")
    assert cut_2323 is not None and plan[cut_2323]["date"] == "2026-11-19" and plan[cut_2323]["amount"] == 410.0
    assert not [m for m in plan if m["type"] == "faltante"]
    assert min(D(str(m["funding_balance_after"])) for m in plan) >= D("500") - D("0.01")
    first_attack = first_index(plan, lambda m: m["type"] == "attack")
    assert first_attack is not None and plan[first_attack]["date"] >= "2026-11-15"  # not before the payday


def test_gps_day_one_attack_equals_the_mission_attack():
    accs = [card("Visa", "800", "22", closing=23, due=18), loan("Upstart", "9000", "32.3", "331", 5)]
    incomes = [monthly("Nómina", "3000", 1, 15)]
    for cash in (D("600"), D("2500"), D("9000")):
        mission = get_daily_mission(accs, cash, D("500"), incomes, [], today=START)
        plan = generate_action_plan(accs, incomes, [], cash, shield_target=D("500"), start=START)
        day1 = sum(D(str(m["amount"])) for m in plan if m["type"] == "attack" and m["date"] == START.isoformat())
        expected = mission["ataque"] if mission["ataque"] > D("10") else D("0")
        assert day1 == expected.quantize(D("0.01"))
