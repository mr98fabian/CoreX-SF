"""
Plain-language summaries of what an AI write changed (shown in Actividad).
Presentation only — no business math. No emails or UUIDs: account and item
names, amounts and day numbers only.
"""
from decimal import Decimal
from typing import Any, Mapping

# Fields of an account worth telling the user about, in display order
ACCOUNT_FIELDS = [
    ("name", "nombre"), ("balance", "saldo"), ("min_payment", "pago mínimo"), ("interest_rate", "APR"),
    ("closing_day", "día de corte"), ("due_day", "día de pago"), ("credit_limit", "límite"),
]
MONEY = {"balance", "min_payment", "credit_limit", "amount"}


def _fmt(field: str, value: Any) -> str:
    if value is None:
        return "—"
    if field in MONEY:
        return f"${Decimal(str(value)):,.2f}"
    if field == "interest_rate":
        return f"{Decimal(str(value)):.2f}%"
    return str(value)


def snapshot(obj: Any, fields=ACCOUNT_FIELDS) -> dict:
    return {f: getattr(obj, f, None) for f, _ in fields}


def _changes(before: Mapping, after: Mapping, fields) -> list[str]:
    out = []
    for f, label in fields:
        a, b = before.get(f), after.get(f)
        same = (a == b) or (a is not None and b is not None and f != "name" and Decimal(str(a)) == Decimal(str(b)))
        if not same:
            out.append(f"{label} {_fmt(f, a)} → {_fmt(f, b)}")
    return out


def account_created(acc: Any) -> str:
    return f"Agregó la cuenta {acc.name} · saldo {_fmt('balance', acc.balance)}"


def account_updated(before: Mapping, acc: Any) -> str:
    changes = _changes(before, snapshot(acc), ACCOUNT_FIELDS)
    name = before.get("name") or acc.name
    return f"{name} · {' · '.join(changes)}" if changes else f"{name} · sin cambios"


def account_deleted(name: str, n_transactions: int) -> str:
    extra = f" y {n_transactions} movimiento{'s' if n_transactions != 1 else ''}" if n_transactions else ""
    return f"Eliminó la cuenta {name}{extra}"


def transaction_recorded(amount: Any, category: str, account_name: str) -> str:
    if category == "payment":
        return f"Pago de {_fmt('amount', amount)} a {account_name}"
    return f"Movimiento de {_fmt('amount', amount)} en {account_name} ({category})"


CASHFLOW_FIELDS = [("name", "nombre"), ("amount", "monto"), ("frequency", "frecuencia"), ("day_of_month", "día")]


def cashflow_created(item: Any) -> str:
    kind = "ingreso" if (getattr(item, "is_income", False) or item.category == "income") else "gasto"
    return f"Agregó el {kind} {item.name} · {_fmt('amount', item.amount)} {item.frequency}"


def cashflow_updated(before: Mapping, item: Any) -> str:
    changes = _changes(before, snapshot(item, CASHFLOW_FIELDS), CASHFLOW_FIELDS)
    return f"{before.get('name') or item.name} · {' · '.join(changes)}" if changes else f"{item.name} · sin cambios"


def cashflow_deleted(name: str) -> str:
    return f"Quitó {name} de tus ingresos y gastos"
