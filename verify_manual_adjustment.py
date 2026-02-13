import requests
import json
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8001/api"

def get_accounts():
    res = requests.get(f"{BASE_URL}/accounts")
    return res.json()

def test_manual_adjustment():
    print("--- Testing Manual Adjustment ---")
    
    # 1. Get Chase Account
    accounts = get_accounts()
    chase = next((a for a in accounts if a["type"] == "checking"), None) # Assuming checking is asset
    if not chase:
        print("No Checking account found.")
        return

    print(f"Initial Balance for {chase['name']}: {chase['balance']}")
    initial_balance = Decimal(str(chase['balance']))

    # 2. Add $100 Deposit (Asset + 100)
    print("Adding $100 Deposit...")
    payload = {
        "account_id": chase['id'],
        "amount": 100.0,
        "description": "Test Deposit",
        "category": "Adjustment",
        "date": "2023-10-27"
    }
    res = requests.post(f"{BASE_URL}/transactions/manual", json=payload)
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return
    
    # Verify
    accounts_after = get_accounts()
    chase_after = next(a for a in accounts_after if a["id"] == chase['id'])
    new_balance = Decimal(str(chase_after['balance']))
    print(f"New Balance: {new_balance}")
    
    if new_balance == initial_balance + Decimal("100"):
        print("SUCCESS: Asset Balance increased by 100.")
    else:
        print(f"FAILURE: Expected {initial_balance + 100}, got {new_balance}")

    # 3. Test Debt Logic
    debt = next((a for a in accounts if a["type"] == "debt"), None)
    if not debt:
        print("No Debt account found.")
        return

    print(f"\nInitial Debt Balance for {debt['name']}: {debt['balance']}")
    initial_debt = Decimal(str(debt['balance']))

    # 4. Add $50 Charge (Debt Increases) -> Send Negative Amount
    print("Adding $50 Charge (Debt Increase)...")
    payload_debt = {
        "account_id": debt['id'],
        "amount": -50.0,
        "description": "Test Charge",
        "category": "Adjustment",
        "date": "2023-10-27"
    }
    res = requests.post(f"{BASE_URL}/transactions/manual", json=payload_debt)
    if res.status_code != 200:
        print(f"Error: {res.text}")
        return

    accounts_after_debt = get_accounts()
    debt_after = next(a for a in accounts_after_debt if a["id"] == debt['id'])
    new_debt_balance = Decimal(str(debt_after['balance']))
    print(f"New Debt Balance: {new_debt_balance}")

    # Logic: Balance -= Amount => Balance -= (-50) => Balance += 50
    if new_debt_balance == initial_debt + Decimal("50"):
        print("SUCCESS: Debt Balance increased by 50.")
    else:
        print(f"FAILURE: Expected {initial_debt + 50}, got {new_debt_balance}")

if __name__ == "__main__":
    test_manual_adjustment()
