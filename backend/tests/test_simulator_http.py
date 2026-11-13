"""POST /api/simulator/time-cost over HTTP (Juez de compras): same fields as always plus
the engine's two freedom dates; 400 on amount <= 0; zeros and null dates with no debts."""
from datetime import date
from decimal import Decimal

from sqlmodel import Session

import database
from auth import get_current_user_id
from main import app
from models import Account
from tests.test_api_tokens import A, B, bearer, clean, make_token  # noqa: F401  (clean is autouse)


def _as(user):
    app.dependency_overrides[get_current_user_id] = lambda: user


def _seed_debts(user):
    with Session(database.engine) as s:
        s.add(Account(user_id=user, name="Cheques", type="checking", balance=Decimal("2500")))
        s.add(Account(user_id=user, name="Visa", type="debt", balance=Decimal("4000"), interest_rate=Decimal("24"),
                      min_payment=Decimal("120"), debt_subtype="credit_card"))
        s.commit()


def test_with_debts_returns_the_usual_fields_and_both_freedom_dates(client):
    _seed_debts(A)
    _as(A)
    r = client.post("/api/simulator/time-cost", json={"amount": 1500})
    assert r.status_code == 200
    body = r.json()
    for k in ("purchase_amount", "days_delayed", "months_delayed", "cost_in_interest", "message", "debug"):
        assert k in body
    base, impact = date.fromisoformat(body["freedom_date_baseline"]), date.fromisoformat(body["freedom_date_impact"])
    assert impact >= base
    assert body["days_delayed"] == body["months_delayed"] * 30  # unchanged contract


def test_amount_not_positive_is_400(client):
    _as(A)
    for amount in (0, -5):
        r = client.post("/api/simulator/time-cost", json={"amount": amount})
        assert r.status_code == 400
        assert r.json()["detail"] == "Amount must be positive."


def test_no_debts_gives_zeros_and_null_dates(client):
    _as(B)
    body = client.post("/api/simulator/time-cost", json={"amount": 300}).json()
    assert body["days_delayed"] == 0 and body["cost_in_interest"] == 0.0
    assert body["freedom_date_baseline"] is None and body["freedom_date_impact"] is None


def test_a_kx_token_with_run_simulations_can_judge(client):
    _seed_debts(A)
    tok = make_token(client, A, scopes=["run:simulations"])
    r = client.post("/api/simulator/time-cost", headers=bearer(tok), json={"amount": 200})
    assert r.status_code == 200 and "freedom_date_impact" in r.json()


def test_mcp_exposes_one_judge_tool_for_this_endpoint():
    from pathlib import Path
    src = (Path(__file__).resolve().parents[2] / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
    assert "def korex_judge_purchase(" in src
    assert "run_purchase_simulation" not in src
    assert src.count('"/api/simulator/time-cost"') == 1
    # The interest figure is the simulator's real delta (impact − baseline): the tool passes it on
    body = src[src.index("def korex_judge_purchase("):src.index("@mcp.tool()", src.index("def korex_judge_purchase("))]
    assert '"interest_extra": r.get("cost_in_interest")' in body
    for k in ("months_delayed", "days_delayed", "freedom_date_baseline", "freedom_date_impact", "has_debts", "out_of_scale", "interest_extra"):
        assert f'"{k}"' in body
