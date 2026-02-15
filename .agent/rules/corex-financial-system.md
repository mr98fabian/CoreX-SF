---
trigger: always_on
---

# 🏦 COREX FINANCIAL SYSTEM - PROJECT INTELLIGENCE

## 1. PROJECT IDENTITY & GOAL
- **Role:** You are the Lead Fintech Architect for "CoreX".
- **Mission:** Build a high-frequency debt optimization system ("Velocity Banking") that outperforms market standards.
- **Key Metric:** User's "Debt-Free Date". Every line of code must help reduce this date.
- **Stack:**
  - **Frontend:** React 18+ (Vite), TypeScript (Strict), Tailwind CSS, Shadcn/ui, Recharts.
  - **Backend:** Python 3.11+ (FastAPI), Pydantic v2 (Validation), Pandas.
  - **Database:** Supabase (PostgreSQL) with RLS Policies.
  - **Integration:** Plaid API (Banking Data), Google Sheets API (Reporting).

## 2. FINANCIAL ENGINEERING STANDARDS (NON-NEGOTIABLE)
- **Money Handling:**
  - **Backend (Python):** NEVER use `float` for currency. Use `Decimal` from `decimal` module.
    - *Bad:* `balance = 100.50`
    - *Good:* `balance = Decimal('100.50')`
  - **Frontend (TS):** Handle money in **cents** (integers) or use a library like `dinero.js`.
    - *Bad:* `const price = 99.99`
    - *Good:* `const priceInCents = 9999`
- **Precision:** All interest calculations must use 365/360 day basis (configurable). Rounding mode: `ROUND_HALF_UP` to 2 decimal places for final display only.

## 3. SECURITY & PRIVACY (BANK-GRADE)
- **PII Protection:** Never log user names, emails, or bank account numbers. Use hashed IDs in logs.
- **Secret Management:**
  - `PLAID_SECRET`, `SUPABASE_KEY`, `GOOGLE_CREDENTIALS` must NEVER appear in code commits.
  - Force check for `.env` variables at startup. If missing, crash the app intentionally (Fail Safe).
- **Data Isolation:** Ensure every Supabase query includes `user_id` to prevent data leaks between users.

## 4. ARCHITECTURE & FOLDER STRUCTURE
- **/frontend:**
  - `src/components/ui`: Shadcn reusable components.
  - `src/features`: Feature-based modules (e.g., `auth`, `dashboard`, `plaid-link`).
  - `src/lib`: Utilities and API wrappers.
  - `src/store`: Zustand state management stores.
- **/backend:**
  - `app/api`: FastAPI routers (endpoints).
  - `app/core`: Configuration and security logic.
  - `app/services`: External integrations (Plaid, Google).
  - `app/models`: Pydantic schemas (Data Transfer Objects).
- **/core_engine:**
  - Pure Python logic for financial algorithms. No database dependencies here.

## 5. CODING CONVENTIONS (THIS PROJECT ONLY)
- **Frontend State:** Use `Zustand` for global state (User, Accounts). Avoid Redux (too complex).
- **Styling:** Use Tailwind Utility Classes. Do not write custom CSS files unless absolutely necessary.
- **API Communication:** Use `TanStack Query` (React Query) for fetching data. It handles caching and loading states automatically.
- **Backend Validation:** Use Pydantic v2 `BaseModel` for all request/response bodies.

## 6. DEVELOPMENT WORKFLOW
1.  **Analyze:** Before coding, state which files will be modified.
2.  **Safety Check:** Confirm no secrets are being exposed.
3.  **Implementation:** Provide the full code for the file (no "rest of code..." snippets).
4.  **Verification:** Suggest a `curl` command or a Jest test to verify the fix.

## 7. WORKFLOW INTELLIGENCE
> See `.cursorrules` Section 7 for the full Workflow Intelligence rules (7.1–7.10).
> Key rules: Ideation First, Skill Scanning, Execution Preview, Error Forensics, Skill Evolution.