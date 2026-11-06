"""simulate_freedom_path memo (perf 2026-11-05): a repeated read is served
from cache with identical numbers; any change to the inputs (a write)
recomputes; results are copies (callers can't corrupt the cache)."""
from datetime import date
from decimal import Decimal as D

import velocity_engine as ve
from velocity_engine import DebtAccount, simulate_freedom_path

START = date(2026, 11, 1)


def debts(balance="6800"):
    return [DebtAccount(name="Visa", balance=D(balance), interest_rate=D("26.99"), min_payment=D("204"), debt_subtype="credit_card"),
            DebtAccount(name="Car", balance=D("16500"), interest_rate=D("11.9"), min_payment=D("385"), debt_subtype="auto_loan")]


def counting(monkeypatch):
    calls = []
    real = ve._simulate_freedom_path
    monkeypatch.setattr(ve, "_simulate_freedom_path", lambda *a, **k: calls.append(1) or real(*a, **k))
    ve._sim_cache.clear()
    return calls


def test_second_read_uses_the_cache_with_identical_numbers(monkeypatch):
    calls = counting(monkeypatch)
    a = simulate_freedom_path(debts(), D("500"), start=START)
    b = simulate_freedom_path(debts(), D("500"), start=START)
    assert len(calls) == 1
    assert a == b


def test_read_after_a_write_is_recomputed(monkeypatch):
    calls = counting(monkeypatch)
    before = simulate_freedom_path(debts("6800"), D("500"), start=START)
    after = simulate_freedom_path(debts("6596"), D("500"), start=START)  # a $204 payment was recorded
    assert len(calls) == 2
    assert after["timeline"][0]["total_balance"] < before["timeline"][0]["total_balance"]


def test_cached_results_are_copies(monkeypatch):
    counting(monkeypatch)
    a = simulate_freedom_path(debts(), D("500"), start=START)
    a["timeline"].clear()
    assert simulate_freedom_path(debts(), D("500"), start=START)["timeline"]


def test_memo_does_not_change_the_numbers():
    ve._sim_cache.clear()
    direct = ve._simulate_freedom_path(debts(), D("500"), True, False, START)
    assert simulate_freedom_path(debts(), D("500"), start=START) == direct
