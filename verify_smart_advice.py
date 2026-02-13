import requests
from decimal import Decimal
from datetime import date, timedelta

BASE_URL = "http://127.0.0.1:8001/api"

def test_smart_advice():
    print("--- Verifying Smart Velocity Advice ---")

    # 1. Setup: Delete all accounts to start clean
    requests.delete(f"{BASE_URL}/accounts")
    
    # 2. Create Accounts
    # Checking: $5000 (Equity = $5000 - Shield $2000 = $3000 Surplus)
    checking = requests.post(f"{BASE_URL}/accounts", json={
        "name": "Chase Checking",
        "type": "checking",
        "balance": 5000.00
    }).json()
    
    # Debt: $10,000 at 20% APR
    debt = requests.post(f"{BASE_URL}/accounts", json={
        "name": "Amex Platinum",
        "type": "debt",
        "balance": 10000.00,
        "interest_rate": 20.00,
        "min_payment": 200.00
    }).json()

    # 3. Create Income Cashflow (Next Payday logic)
    # Set payday to 15th of month
    requests.post(f"{BASE_URL}/cashflow", json={
        "name": "Salary",
        "amount": 3000.00,
        "day_of_month": 15,
        "category": "Income"
    })

    # 4. Check Dashboard (Scenario A: Surplus)
    print("\nScenario A: Has Surplus ($3000)")
    dash = requests.get(f"{BASE_URL}/dashboard").json()
    target = dash['velocity_target']
    
    print(f"Action Date: {target.get('action_date')}")
    print(f"Justification: {target.get('justification')}")
    print(f"Daily Interest: {target.get('daily_interest_saved')}")
    
    assert target['action_date'] == date.today().isoformat(), "Should be Today when surplus exists"
    assert "excedente" in target['justification'], "Justification should mention surplus"
    
    expected_interest = 10000 * (0.20 / 365)
    print(f"Expected Interest ~ {expected_interest:.2f}")

    # 5. Check Dashboard (Scenario B: No Surplus)
    # Spend money to drop below shield
    # Shield is default 1000 or user set? Let's assume default 1000 or 2000. 
    # Current code uses User.shield_target.
    
    # Update Balance of Checking to $500 (Below Shield)
    requests.patch(f"{BASE_URL}/accounts/{checking['id']}/balance", json={"balance": 500.00})
    
    print("\nScenario B: No Surplus ($500 vs Shield)")
    dash = requests.get(f"{BASE_URL}/dashboard").json()
    target = dash['velocity_target']
    
    print(f"Action Date: {target.get('action_date')}")
    print(f"Justification: {target.get('justification')}")
    
    # Calculate expected next payday
    today = date.today()
    if today.day < 15:
        expected_payday = date(today.year, today.month, 15)
    else:
        # Next month
        if today.month == 12:
            expected_payday = date(today.year + 1, 1, 15)
        else:
            expected_payday = date(today.year, today.month + 1, 15)
            
    assert target['action_date'] == expected_payday.isoformat(), f"Should be {expected_payday} when no surplus"
    assert "pausa" in target['justification'] or "espera" in target['justification'].lower(), "Justification should imply waiting"

    print("\n✅ Smart Advice Logic Verified!")

if __name__ == "__main__":
    test_smart_advice()
