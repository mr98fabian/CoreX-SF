import requests
import json
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000/api"

def test_transactions():
    print("--- Starting Transaction Verification ---")
    
    # 1. Get an account to test with
    print("Fetching accounts...")
    res = requests.get(f"{BASE_URL}/accounts")
    if not res.ok:
        print(f"FAILED: Could not fetch accounts. {res.status_code}")
        return
    accounts = res.json()
    if not accounts:
        print("FAILED: No accounts found. Seed data might not have run.")
        return
        
    # Pick a 'debt' account for interesting logic
    target_acc = next((a for a in accounts if a['type'] == 'debt'), accounts[0])
    print(f"Testing with Account: {target_acc['name']} (ID: {target_acc['id']}, Type: {target_acc['type']}, Initial Balance: {target_acc['balance']})")
    
    initial_balance = Decimal(str(target_acc['balance']))
    
    # 2. Add a PAYMENT (Positive amount)
    # For DEBT: Payment reduces balance.
    # For ASSET: Payment (Income) increases balance.
    payment_amount = Decimal("100.00")
    print(f"\nSending Payment of ${payment_amount}...")
    
    payload = {
        "account_id": target_acc['id'],
        "amount": float(payment_amount),
        "description": "Test Payment",
        "category": "payment",
        "date": "2023-10-27"
    }
    
    start_tx_res = requests.post(f"{BASE_URL}/transactions", json=payload)
    if not start_tx_res.ok:
        print(f"FAILED: Could not create transaction. {start_tx_res.text}")
        return
    
    print("Transaction created successfully.")
    
    # 3. Verify Account Balance Update
    print("Verifying new balance...")
    res = requests.get(f"{BASE_URL}/accounts")
    updated_acc = next(a for a in res.json() if a['id'] == target_acc['id'])
    new_balance = Decimal(str(updated_acc['balance']))
    
    print(f"Old Balance: {initial_balance}")
    print(f"New Balance: {new_balance}")
    
    expected_balance = initial_balance
    if target_acc['type'] == 'debt':
        expected_balance -= payment_amount
    else:
        expected_balance += payment_amount
        
    if new_balance == expected_balance:
        print("SUCCESS: Balance updated correctly.")
    else:
        print(f"FAILED: Balance mismatch. Expected {expected_balance}, got {new_balance}")

    # 4. Verify Transaction History
    print("\nVerifying Transaction History...")
    hist_res = requests.get(f"{BASE_URL}/accounts/{target_acc['id']}/transactions")
    if not hist_res.ok:
         print(f"FAILED: Could not fetch history. {hist_res.status_code}")
         return
         
    history = hist_res.json()
    if len(history) > 0 and history[0]['description'] == "Test Payment":
        print("SUCCESS: Transaction found in history.")
    else:
        print("FAILED: Transaction not found in history.")

if __name__ == "__main__":
    try:
        test_transactions()
    except Exception as e:
        print(f"ERROR: {e}")
