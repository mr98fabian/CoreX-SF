"""
CoreX Transaction Classifier — "The Radar"
Automatically categorizes transactions into Life, Debt, and Income.
Uses heuristic-based rules for V1 (no ML dependency).
"""
from decimal import Decimal
from typing import Dict, Literal

TransactionTag = Literal["income", "debt", "life", "transfer"]

# --- Known Merchant Patterns ---
# These sets drive the classification engine. Expand as needed.
INCOME_KEYWORDS = frozenset([
    "payroll", "direct dep", "salary", "wage", "ach credit",
    "employer", "paycheck", "net pay", "commission", "freelance",
    "venmo cashout", "zelle from", "tax refund", "irs treas",
    "social security", "pension", "dividend", "interest earned",
    "rental income", "solar", "sunrun", "tesla energy",
])

DEBT_KEYWORDS = frozenset([
    "chase", "amex", "american express", "capital one",
    "discover", "citi", "barclays", "wells fargo",
    "toyota financial", "honda financial", "ford credit",
    "student loan", "navient", "nelnet", "fedloan",
    "mortgage", "quicken loans", "rocket mortgage",
    "sallie mae", "sofi", "upstart", "lending club",
    "min payment", "autopay", "loan payment",
])

TRANSFER_KEYWORDS = frozenset([
    "transfer", "xfer", "tfr", "zelle", "venmo", "cash app",
    "paypal", "wire", "ach", "internal",
])

# Categories that Plaid returns — mapped to CoreX tags
PLAID_CATEGORY_MAP: Dict[str, TransactionTag] = {
    "Transfer": "transfer",
    "Payment": "debt",
    "Loan": "debt",
    "Interest": "debt",
    "Income": "income",
    "Payroll": "income",
    "Food and Drink": "life",
    "Shops": "life",
    "Travel": "life",
    "Recreation": "life",
    "Healthcare": "life",
    "Service": "life",
    "Community": "life",
    "Government and Non-Profit": "life",
    "Rent": "life",
    "Utilities": "life",
    "Insurance": "life",
}


def classify_transaction(
    amount: Decimal,
    name: str,
    merchant_name: str | None = None,
    category: str | None = None,
) -> Dict:
    """
    Classify a single transaction into a CoreX tag.

    Args:
        amount: Transaction amount (Plaid convention: positive = spend, negative = credit/income).
        name: Transaction description from the bank.
        merchant_name: Optional merchant name from Plaid.
        category: Optional Plaid category string.

    Returns:
        Dict with 'tag' (income|debt|life|transfer) and 'confidence' (high|medium|low).
    """
    search_text = f"{name} {merchant_name or ''}".lower().strip()

    # Rule 1: Credits / Deposits are likely income
    if amount < 0:  # Plaid: negative = money IN
        for keyword in INCOME_KEYWORDS:
            if keyword in search_text:
                return {"tag": "income", "confidence": "high"}
        return {"tag": "income", "confidence": "medium"}

    # Rule 2: Check against known debt servicers
    for keyword in DEBT_KEYWORDS:
        if keyword in search_text:
            return {"tag": "debt", "confidence": "high"}

    # Rule 3: Check transfers
    for keyword in TRANSFER_KEYWORDS:
        if keyword in search_text:
            return {"tag": "transfer", "confidence": "medium"}

    # Rule 4: Use Plaid category as fallback
    if category and category in PLAID_CATEGORY_MAP:
        return {"tag": PLAID_CATEGORY_MAP[category], "confidence": "medium"}

    # Rule 5: Default — everything else is "life"
    return {"tag": "life", "confidence": "low"}


def classify_batch(transactions: list) -> list:
    """
    Classify a batch of transactions. Each must have 'amount', 'name'.
    Optionally 'merchant_name' and 'category'.

    Returns the same list with 'corex_tag' and 'corex_confidence' added.
    """
    results = []
    for tx in transactions:
        classification = classify_transaction(
            amount=Decimal(str(tx.get("amount", 0))),
            name=tx.get("name", ""),
            merchant_name=tx.get("merchant_name"),
            category=tx.get("category"),
        )
        results.append({
            **tx,
            "corex_tag": classification["tag"],
            "corex_confidence": classification["confidence"],
        })
    return results


def get_cashflow_summary(classified_transactions: list) -> Dict:
    """
    Summarize classified transactions into a cashflow breakdown.
    
    Returns:
        Dict with total_income, total_life, total_debt, free_cashflow.
    """
    total_income = Decimal("0")
    total_life = Decimal("0")
    total_debt = Decimal("0")

    for tx in classified_transactions:
        amount = Decimal(str(abs(tx.get("amount", 0))))
        tag = tx.get("corex_tag", "life")

        if tag == "income":
            total_income += amount
        elif tag == "life":
            total_life += amount
        elif tag == "debt":
            total_debt += amount
        # transfers are neutral — not counted

    free_cashflow = total_income - total_life - total_debt

    return {
        "total_income": float(total_income),
        "total_life": float(total_life),
        "total_debt_payments": float(total_debt),
        "free_cashflow": float(free_cashflow),
        "velocity_potential": float(max(Decimal("0"), free_cashflow)),
    }
