"""
KoreX MCP server — lets an AI assistant operate ONE user's KoreX through
that user's personal API token (Settings → Conecta tu IA).

Transport: stdio. Config (environment):
  KOREX_API_TOKEN  personal token (kx_...), required
  KOREX_API_URL    API base, default https://corex-sf-production.up.railway.app

The server holds no permissions of its own: every tool calls the KoreX API
with the token, and the API enforces the token's scopes (403 if missing).
The token is never printed or returned to the model.
"""
import os
from datetime import date as _date
from typing import Any, Optional

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.getenv("KOREX_API_URL", "https://corex-sf-production.up.railway.app").rstrip("/")
INSTRUCTIONS = (
    "Operas el KoreX de UN usuario con su token personal. "
    "Al conectar por primera vez, informa al usuario sus horas de sincronización usando `korex_sync_status`. "
    "Toda cifra de KoreX es una estimación: preséntala como tal."
)
mcp = FastMCP("korex", instructions=INSTRUCTIONS)


class KorexError(Exception):
    pass


def _call(method: str, path: str, json: Optional[dict] = None) -> Any:
    token = os.getenv("KOREX_API_TOKEN", "")
    if not token.startswith("kx_"):
        raise KorexError("KOREX_API_TOKEN is missing or not a KoreX token (kx_...).")
    try:
        r = httpx.request(method, f"{API_URL}{path}", json=json, timeout=30,
                          headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as e:
        raise KorexError(f"KoreX API unreachable: {e.__class__.__name__}") from None
    if r.status_code == 401:
        raise KorexError("Token invalid or revoked. Create a new one in KoreX → Settings → Conecta tu IA.")
    if r.status_code == 403:
        raise KorexError(f"This token lacks the permission for {path}. Edit permissions in KoreX.")
    if r.status_code == 429:
        raise KorexError("Rate limit reached (60 requests/minute). Try again in a minute.")
    if r.status_code >= 400:
        detail = r.json().get("detail") if "json" in r.headers.get("content-type", "") else None
        raise KorexError(f"KoreX API error {r.status_code}: {detail or 'request failed'}")
    return r.json()


def _resolve_account(account: str) -> dict:
    accounts = _call("GET", "/api/accounts")
    if str(account).isdigit():
        match = [a for a in accounts if a["id"] == int(account)]
    else:
        needle = account.strip().lower()
        match = [a for a in accounts if a["name"].lower() == needle] or \
                [a for a in accounts if needle in a["name"].lower()]
    if len(match) != 1:
        names = ", ".join(a["name"] for a in accounts)
        raise KorexError(f"{'No' if not match else 'More than one'} account matches '{account}'. Accounts: {names}")
    return match[0]


@mcp.tool()
def list_accounts() -> list[dict]:
    """List the user's accounts (debts, checking, savings) with balance, APR and minimum payment. Scope: read:accounts."""
    keys = ("id", "name", "type", "balance", "interest_rate", "min_payment", "debt_subtype", "due_day")
    return [{k: a.get(k) for k in keys} for a in _call("GET", "/api/accounts")]


@mcp.tool()
def get_dashboard_summary() -> dict:
    """The user's dashboard: totals, liquidity, velocity target and debt-free projection (estimates). Scope: read:dashboard."""
    return _call("GET", "/api/dashboard")


@mcp.tool()
def get_action_plan() -> dict:
    """The user's action plan (tactical GPS): which debt to attack next and the projected freedom dates (estimates). Scope: read:plan."""
    return _call("GET", "/api/strategy/tactical-gps")


@mcp.tool()
def register_payment(account: str, amount: float, date: Optional[str] = None, description: str = "Pago registrado por IA",
                     funding_account: Optional[str] = None) -> dict:
    """Record a payment to a debt account. `account` is the account id or (part of) its name; `amount` in dollars, > 0;
    `date` as YYYY-MM-DD (default today). Lowers the debt balance.
    `funding_account`: the checking/savings/cash account the money LEFT FROM (id or name). ALWAYS pass it whenever the
    source is known — a payment has two sides, and without it the source keeps showing money that already left
    (inflated cash). Both balances move by the applied amount, atomically; insufficient funds = nothing is written.
    Scope: write:payments."""
    if amount <= 0:
        raise KorexError("amount must be positive")
    acc = _resolve_account(account)
    body = {"account_id": acc["id"], "amount": amount, "description": description,
            "category": "payment", "date": date or _date.today().isoformat()}
    src = _resolve_account(funding_account) if funding_account else None
    if src:
        body["funding_account_id"] = src["id"]
    tx = _call("POST", "/api/transactions/manual", body)
    return {"recorded": True, "account": acc["name"], "amount": amount, "transaction_id": tx.get("id"),
            "funding_account": src["name"] if src else None, "funding_applied": tx.get("funding_applied", False)}


@mcp.tool()
def add_account(name: str, type: str, balance: float, interest_rate: float = 0, min_payment: float = 0) -> dict:
    """Add an account. `type` is debt, checking or savings; `interest_rate` is APR %; a debt with min_payment 0 gets
    one estimated. Scope: write:accounts."""
    if type not in ("debt", "checking", "savings"):
        raise KorexError("type must be debt, checking or savings")
    acc = _call("POST", "/api/accounts", {"name": name, "type": type, "balance": balance,
                                          "interest_rate": interest_rate, "min_payment": min_payment})
    return {k: acc.get(k) for k in ("id", "name", "type", "balance", "interest_rate", "min_payment")}


EDITABLE = ("name", "balance", "interest_rate", "min_payment", "credit_limit", "closing_day",
            "due_day", "interest_type", "payment_frequency", "debt_subtype")


@mcp.tool()
def update_account(account: str, name: Optional[str] = None, balance: Optional[float] = None,
                   interest_rate: Optional[float] = None, min_payment: Optional[float] = None,
                   credit_limit: Optional[float] = None, closing_day: Optional[int] = None,
                   due_day: Optional[int] = None, interest_type: Optional[str] = None,
                   payment_frequency: Optional[str] = None, debt_subtype: Optional[str] = None) -> dict:
    """Correct an account. `account` is its id or (part of) its name; only the fields you pass change.
    interest_type: revolving | fixed. payment_frequency: monthly | biweekly | weekly. Scope: write:accounts."""
    values = locals()
    changes = {k: values[k] for k in EDITABLE if values[k] is not None}
    if not changes:
        raise KorexError("Pass at least one field to change.")
    acc = _resolve_account(account)
    updated = _call("PUT", f"/api/accounts/{acc['id']}", changes)
    return {"updated": True, "account": {k: updated.get(k) for k in ("id",) + EDITABLE}}


@mcp.tool()
def delete_account(account: str, confirm: bool = False) -> dict:
    """Permanently delete an account and its transactions (income/bills linked to it are kept, unlinked).
    `account` is its id or (part of) its name. Requires confirm=true — ask the user first. Scope: write:accounts."""
    acc = _resolve_account(account)
    if not confirm:
        raise KorexError(f"Not deleted. Ask the user to confirm deleting '{acc['name']}', then call again with confirm=true.")
    res = _call("DELETE", f"/api/accounts/{acc['id']}")
    return {"deleted": True, "account": acc["name"], "deleted_transactions": res.get("deleted_transactions", 0)}


@mcp.tool()
def run_purchase_simulation(amount: float) -> dict:
    """Estimate how much a purchase of `amount` dollars delays the user's debt-free date and costs in interest. Scope: run:simulations."""
    return _call("POST", "/api/simulator/time-cost", {"amount": amount})


@mcp.tool()
def get_settings() -> dict:
    """The user's app settings. Scope: read:dashboard."""
    return _call("GET", "/api/settings")



@mcp.tool()
def korex_sync_status() -> dict:
    """When the user's bank data syncs (Plaid, in batches 1–4 times a day; KoreX collects at 07:00 and 17:15) and
    when it last synced. Includes `explanation_es`, a ready-to-say Spanish explanation built by the server — never
    state a sync time that is not in `last_sync_at`. Scope: read:dashboard."""
    return _call("GET", "/api/sync/status")



@mcp.tool()
def korex_list_subscriptions() -> dict:
    """The user's recurring charges (Netflix, gym…) ordered by next charge, cancelled ones last ("Ya no pagas"),
    plus monthly_total and annual_total of the ACTIVE ones (annual/12, weekly×52/12; estimates). Scope: read:accounts."""
    return _call("GET", "/api/subscriptions")


@mcp.tool()
def korex_upsert_subscription(name: str, amount: Optional[float] = None, frequency: Optional[str] = None,
                              next_charge_date: Optional[str] = None, account: Optional[str] = None,
                              logo_url: Optional[str] = None, status: Optional[str] = None) -> dict:
    """Create or update a recurring charge, matched by name (case-insensitive). frequency: monthly | annual | weekly.
    next_charge_date: YYYY-MM-DD. `account`: the card/account that pays it (id or name). logo_url: the merchant's
    official logo from Plaid (`logo_url`, https) — never invent one. status: active | cancelled (cancel keeps history).
    Creating requires amount. Scope: write:accounts."""
    existing = [x for x in _call("GET", "/api/subscriptions")["items"] if x["name"].lower() == name.strip().lower()]
    body: dict = {k: v for k, v in {"amount": amount, "frequency": frequency, "next_charge_date": next_charge_date,
                                    "logo_url": logo_url, "status": status}.items() if v is not None}
    if account:
        body["account_id"] = _resolve_account(account)["id"]
    if existing:
        return {"updated": True, "subscription": _call("PATCH", f"/api/subscriptions/{existing[0]['id']}", body)}
    if amount is None:
        raise KorexError("amount is required to create a subscription")
    body.pop("status", None)
    return {"created": True, "subscription": _call("POST", "/api/subscriptions", {"name": name.strip(), **body})}


if __name__ == "__main__":
    mcp.run()
