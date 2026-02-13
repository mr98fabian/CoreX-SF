import requests
import json

BASE_URL = "http://127.0.0.1:8001/api"

def run_test():
    print("Verifying Manual Cycle Update Impact...")

    # 1. Ensure Chase Account exists
    print("\n1. Checking for 'Chase Cuenta'...")
    res = requests.get(f"{BASE_URL}/accounts")
    accounts = res.json()
    chase = next((a for a in accounts if "Chase Cuenta" in a["name"]), None)
    
    if not chase:
        print("Creating 'Chase Cuenta' for test...")
        chase_data = {
            "name": "Chase Cuenta",
            "type": "checking",
            "balance": 2500.00
        }
        res = requests.post(f"{BASE_URL}/accounts", json=chase_data)
        chase = res.json()
    
    print(f"Chase Account ID: {chase['id']}, Initial Balance: {chase['balance']}")

    # 2. Check Dashboard Initial State
    res = requests.get(f"{BASE_URL}/dashboard")
    dash = res.json()
    initial_equity = dash['attack_equity']
    print(f"Initial Attack Equity: {initial_equity}")

    # 3. Update Balance (Manual Cycle Update)
    new_balance = 5000.00
    print(f"\n2. Updating Chase Balance to {new_balance}...")
    res = requests.patch(f"{BASE_URL}/accounts/{chase['id']}/balance", json={"balance": new_balance})
    
    if res.status_code == 200:
        print("Update Successful.")
        
        # 4. Verify Dashboard Update
        res = requests.get(f"{BASE_URL}/dashboard")
        dash = res.json()
        new_equity = dash['attack_equity']
        print(f"New Attack Equity: {new_equity}")
        
        # Shield is 2000. So 5000 - 2000 = 3000.
        expected_equity = 3000.00
        # logic: attack_equity = max(0, chase_balance - shield_target)
        
        # Note: Dashboard API returns 'attack_equity' as 'amount' inside the widget usually, 
        # but let's check the API response structure.
        # Based on previous context, `get_dashboard_metrics` returns a dict.
        
        if abs(new_equity - expected_equity) < 0.01:
            print("VERIFICATION PASSED: Attack Equity updated correctly.")
        else:
            print(f"VERIFICATION FAILED: Expected {expected_equity}, got {new_equity}")
    else:
        print(f"Update Failed: {res.text}")

if __name__ == "__main__":
    run_test()
