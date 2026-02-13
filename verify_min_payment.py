import requests
import uuid

BASE_URL = "http://127.0.0.1:8001/api"

def verify_min_payment():
    print("--- Verifying Auto MIN PAYMENT ---")
    
    # 1. Create Debit Account
    # Use random name to avoid conflict
    acc_name = f"Test Debt {uuid.uuid4().hex[:4]}"
    balance = 5000.00
    apr = 24.00 # 24%
    
    # Expected Min Payment:
    # Monthly Rate = 24 / 100 / 12 = 0.02
    # Interest = 5000 * 0.02 = 100
    # Principal = 5000 * 0.01 = 50
    # Total = 150.00
    
    payload = {
        "name": acc_name,
        "type": "debt",
        "balance": balance,
        "interest_rate": apr,
        "min_payment": 0, # Should be ignored/calc'd
        "payment_frequency": "monthly"
    }
    
    try:
        res = requests.post(f"{BASE_URL}/accounts", json=payload)
        if res.status_code != 200:
            print(f"FAILED to create account: {res.text}")
            return
            
        account = res.json()
        acc_id = account["id"]
        print(f"Created Account: {account['name']} (ID: {acc_id})")
        print(f"Initial Balance: {account['balance']}, APR: {account['interest_rate']}")
        print(f"Min Payment from DB: {account['min_payment']}")
        
        if float(account['min_payment']) == 150.00:
            print("✅ Initial Min Payment calculation CORRECT")
        else:
            print(f"❌ Initial Min Payment calculation FAILED. Expected 150.00, got {account['min_payment']}")

        # 2. Update Balance (Add Charge = Spend 1000)
        # New Balance = 6000
        # Expected Min Payment:
        # Interest = 6000 * 0.02 = 120
        # Principal = 6000 * 0.01 = 60
        # Total = 180.00
        
        print("\nSimulating Manual Adjustment (Adding Charge +1000)...")
        # Backend Logic: Debt account balance -= amount. 
        # To INCREASE balance (Spend), we send NEGATIVE amount.
        # -(-1000) = +1000
        tx_payload = {
            "account_id": acc_id,
            "amount": -1000, 
            "description": "Test Charge",
            "category": "Adjustment",
            "date": "2024-01-01"
        }
        
        res = requests.post(f"{BASE_URL}/transactions/manual", json=tx_payload)
        if res.status_code != 200:
            print(f"FAILED to add transaction: {res.text}")
            return
        
        # 3. Check updated account
        res = requests.get(f"{BASE_URL}/accounts")
        accounts = res.json()
        updated_acc = next(a for a in accounts if a['id'] == acc_id)
        
        print(f"Updated Balance: {updated_acc['balance']}")
        print(f"Updated Min Payment: {updated_acc['min_payment']}")
        
        if float(updated_acc['min_payment']) == 180.00:
            print("✅ Updated Min Payment calculation CORRECT")
        else:
            print(f"❌ Updated Min Payment calculation FAILED. Expected 180.00, got {updated_acc['min_payment']}")

        # 4. Clean up
        requests.delete(f"{BASE_URL}/accounts/{acc_id}")
        print("\nTest Account Deleted.")
        
    except Exception as e:
        print(f"Review Error: {e}")

if __name__ == "__main__":
    verify_min_payment()
