"""
Demo Router — Development & stress-test seeding endpoints.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session
from sqlalchemy import text
from datetime import datetime, timedelta

from database import engine
from auth import get_current_user_id

router = APIRouter(prefix="/api", tags=["demo"])


@router.post("/dev/seed-stress-test")
async def seed_stress_test(user_id: str = Depends(get_current_user_id)):
    """Seed Carlos Mendoza stress-test dataset."""
    try:
        return _seed_impl(user_id)
    except Exception as e:
        import traceback
        return {"status": "error", "detail": str(e), "tb": traceback.format_exc()}


def _seed_impl(user_id: str):
    with Session(engine) as session:
        uid = user_id

        # ── 1. CLEAR existing data ──
        session.execute(text("DELETE FROM transactions WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM movement_log WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM accounts WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})
        session.execute(text("DELETE FROM cashflow_items WHERE user_id = CAST(:uid AS uuid)"), {"uid": uid})

        # ── 1b. DISABLE FK checks for demo seeding ──
        session.execute(text("SET session_replication_role = 'replica'"))

        # ── 2. ACCOUNTS ──
        accounts_data = [
            # === ASSETS (4) === (14th field = credit_limit)
            ("Chase Business Checking", "checking", 12450.00, 0.01, 0, None, None, False, "revolving", "credit_card", None, None, None, None),
            ("Wells Fargo Personal", "checking", 3200.00, 0.01, 0, None, None, False, "revolving", "credit_card", None, None, None, None),
            ("Ally Savings (Emergency)", "savings", 8500.00, 4.25, 0, None, None, False, "revolving", "credit_card", None, None, None, None),
            ("Marcus Savings (Investment)", "savings", 15000.00, 4.40, 0, None, None, False, "revolving", "credit_card", None, None, None, None),
            # === REVOLVING DEBT (6) ===
            ("Amex Platinum Business", "debt", 18500.00, 24.99, 450.00, 5, 28, True, "revolving", "credit_card", None, None, None, 35000.00),
            ("Chase Sapphire Reserve", "debt", 7200.00, 21.49, 180.00, 12, 5, False, "revolving", "credit_card", None, None, None, 25000.00),
            ("Capital One Venture X", "debt", 4800.00, 19.99, 120.00, 20, 13, False, "revolving", "credit_card", None, None, None, 15000.00),
            ("Citi Double Cash", "debt", 2300.00, 17.49, 60.00, 28, 21, False, "revolving", "credit_card", None, None, None, 10000.00),
            ("HELOC - Property #2", "debt", 45000.00, 8.75, 375.00, 1, 25, False, "revolving", "heloc", None, None, None, 100000.00),
            ("UIL - Pacific Life", "debt", 0.00, 5.50, 0.00, 1, None, False, "revolving", "uil", None, None, None, 75000.00),
            # === FIXED / AMORTIZED DEBT (7) ===
            ("Mortgage - Casa Principal", "debt", 385000.00, 6.875, 2850.00, 1, None, False, "fixed", "mortgage", 420000.00, 360, 312, None),
            ("Mortgage - Rental #1", "debt", 220000.00, 7.25, 1680.00, 15, None, False, "fixed", "mortgage", 250000.00, 360, 288, None),
            ("Mortgage - Rental #2", "debt", 175000.00, 7.50, 1395.00, 15, None, False, "fixed", "mortgage", 200000.00, 360, 300, None),
            ("Tesla Model X Lease", "debt", 42000.00, 4.99, 780.00, 10, None, False, "fixed", "auto_loan", 65000.00, 72, 48, None),
            ("Range Rover Sport", "debt", 35000.00, 5.49, 650.00, 18, None, False, "fixed", "auto_loan", 55000.00, 60, 36, None),
            ("SBA Business Loan", "debt", 85000.00, 9.25, 1200.00, 25, None, False, "fixed", "personal_loan", 120000.00, 120, 84, None),
            ("Student Loan (MBA)", "debt", 28000.00, 5.50, 310.00, 5, None, False, "fixed", "student_loan", 45000.00, 120, 60, None),
        ]

        acc_insert = text("""
            INSERT INTO accounts (user_id, name, type, balance, interest_rate, min_payment,
                due_day, closing_day, is_velocity_target, interest_type, debt_subtype,
                original_amount, loan_term_months, remaining_months, credit_limit)
            VALUES (CAST(:uid AS uuid), :name, :type, :balance, :rate, :min_pay,
                :due_day, :closing_day, :vel_target, :int_type, :debt_sub,
                :orig_amt, :term, :remaining, :credit_lim)
            RETURNING id, name
        """)

        acc_map = {}
        for a in accounts_data:
            result = session.execute(acc_insert, {
                "uid": uid, "name": a[0], "type": a[1],
                "balance": a[2], "rate": a[3], "min_pay": a[4],
                "due_day": a[5], "closing_day": a[6], "vel_target": a[7],
                "int_type": a[8], "debt_sub": a[9],
                "orig_amt": a[10], "term": a[11], "remaining": a[12],
                "credit_lim": a[13],
            })
            row = result.fetchone()
            acc_map[row[1]] = row[0]

        # ── 3. CASHFLOW ITEMS ──
        # Link ALL cashflows to Chase Business Checking so Today's Check-In
        # confirmations actually update the account balance.
        checking_id = acc_map.get("Chase Business Checking")

        cf_insert = text("""
            INSERT INTO cashflow_items (user_id, name, amount, category, frequency,
                is_variable, day_of_month, day_of_week, month_of_year,
                account_id, is_income)
            VALUES (CAST(:uid AS uuid), :name, :amount, :category, :freq,
                :is_var, :dom, :dow, :moy,
                :acc_id, :is_inc)
        """)

        cashflows_data = [
            ("LLC Distribution", 8500.00, "income", "monthly", False, 1, None, None),
            ("W2 Consulting", 4200.00, "income", "biweekly", False, 15, 4, None),
            ("Rental Income #1", 2800.00, "income", "monthly", False, 5, None, None),
            ("Rental Income #2", 2200.00, "income", "monthly", False, 5, None, None),
            ("Freelance Projects", 1500.00, "income", "monthly", True, 15, None, None),
            ("Dividends - Brokerage", 350.00, "income", "monthly", False, 20, None, None),
            ("Airbnb Guest Payments", 900.00, "income", "weekly", True, 1, 0, None),
            ("Annual Bonus", 12000.00, "income", "annually", False, 15, None, 3),
            ("Property Tax - Casa", 580.00, "expense", "monthly", False, 1, None, None),
            ("Property Tax - Rental #1", 320.00, "expense", "monthly", False, 1, None, None),
            ("Property Tax - Rental #2", 280.00, "expense", "monthly", False, 1, None, None),
            ("HOA - Rental #1", 250.00, "expense", "monthly", False, 1, None, None),
            ("Insurance Bundle (3 props + 2 cars)", 890.00, "expense", "monthly", False, 10, None, None),
            ("Utilities - All Properties", 420.00, "expense", "monthly", True, 15, None, None),
            ("Internet + Phone Bundle", 280.00, "expense", "monthly", False, 18, None, None),
            ("Gym + Country Club", 350.00, "expense", "monthly", False, 1, None, None),
            ("Kids School Tuition", 1800.00, "expense", "monthly", False, 5, None, None),
            ("Groceries + Household", 600.00, "expense", "weekly", True, 1, 5, None),
        ]

        for cf in cashflows_data:
            is_income = cf[2] == "income"
            session.execute(cf_insert, {
                "uid": uid, "name": cf[0], "amount": cf[1], "category": cf[2],
                "freq": cf[3], "is_var": cf[4], "dom": cf[5], "dow": cf[6], "moy": cf[7],
                "acc_id": checking_id, "is_inc": is_income,
            })

        # ── 4. HISTORICAL TRANSACTIONS ──
        today = datetime.now()
        tx_insert = text("""
            INSERT INTO transactions (user_id, account_id, amount, description, category, date)
            VALUES (CAST(:uid AS uuid), :acc_id, :amount, :desc, :cat, :dt)
        """)

        transactions_data = [
            (acc_map.get("Chase Business Checking"), 8500.00, "LLC Distribution - February", "salary", 14),
            (acc_map.get("Chase Business Checking"), 4200.00, "W2 Consulting Biweekly", "salary", 7),
            (acc_map.get("Chase Business Checking"), 2800.00, "Rental Income - Property #1", "rental", 10),
            (acc_map.get("Chase Business Checking"), 2200.00, "Rental Income - Property #2", "rental", 10),
            (acc_map.get("Amex Platinum Business"), 450.00, "Velocity Execution: MIN PAYMENT Amex", "payment", 20),
            (acc_map.get("Chase Sapphire Reserve"), 180.00, "Velocity Execution: MIN PAYMENT Chase Sapphire", "payment", 18),
            (acc_map.get("Amex Platinum Business"), 2500.00, "Velocity Execution: ATTACK Amex Platinum", "payment", 13),
            (acc_map.get("Chase Business Checking"), -890.00, "Insurance Bundle - All Policies", "insurance", 5),
            (acc_map.get("Chase Business Checking"), -1800.00, "Kids School Tuition - February", "education", 10),
            (acc_map.get("Chase Business Checking"), -600.00, "Groceries - Costco + Whole Foods", "food", 3),
            (acc_map.get("Chase Business Checking"), 900.00, "Airbnb Guest Payment - Weekend Stay", "rental", 2),
            (acc_map.get("Chase Business Checking"), -350.00, "Gym + Country Club Monthly", "lifestyle", 1),
        ]

        for tx in transactions_data:
            session.execute(tx_insert, {
                "uid": uid, "acc_id": tx[0], "amount": tx[1], "desc": tx[2],
                "cat": tx[3], "dt": (today - timedelta(days=tx[4])).strftime("%Y-%m-%d"),
            })

        # Re-enable FK constraints
        session.execute(text("SET session_replication_role = 'origin'"))
        session.commit()

    return {
        "status": "success",
        "message": "Carlos Mendoza Stress Test loaded",
        "summary": {
            "accounts": len(accounts_data),
            "cashflows": len(cashflows_data),
            "transactions": len(transactions_data),
            "total_debt": sum(a[2] for a in accounts_data if a[1] == "debt"),
            "total_assets": sum(a[2] for a in accounts_data if a[1] in ["checking", "savings"]),
            "shield_target": 5000.00,
        },
    }

