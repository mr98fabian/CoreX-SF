# KoreX API Reference

> Base URL: `http://localhost:8000` (dev) or your Railway domain (prod)  
> Auth: All endpoints except `/health` require `Authorization: Bearer <token>` header.

---

## Health

| Method | Endpoint  | Auth | Description       |
| ------ | --------- | ---- | ----------------- |
| GET    | `/health` | No   | Returns `{"status": "ok"}` |

---

## Accounts

| Method | Endpoint                      | Description                          |
| ------ | ----------------------------- | ------------------------------------ |
| GET    | `/api/accounts`               | List all user accounts               |
| POST   | `/api/accounts`               | Create account (auto-calcs min_pay)  |
| PUT    | `/api/accounts/{id}`          | Update account fields                |
| PATCH  | `/api/accounts/{id}/balance`  | Quick balance update                 |
| DELETE | `/api/accounts/{id}`          | Delete account + cascaded cleanup    |
| DELETE | `/api/accounts`               | Hard reset — wipe all user data      |

### Create Account Body
```json
{
  "name": "My Visa",
  "type": "debt",
  "balance": 5000.00,
  "interest_rate": 24.99,
  "min_payment": 0,
  "payment_frequency": "monthly",
  "due_day": 15,
  "closing_day": 25
}
```

---

## Cashflow

| Method | Endpoint                  | Description                               |
| ------ | ------------------------- | ----------------------------------------- |
| GET    | `/api/cashflow`           | List recurring items + virtual debt items  |
| POST   | `/api/cashflow`           | Create recurring income/expense            |
| DELETE | `/api/cashflow/{id}`      | Delete cashflow item                       |
| GET    | `/api/cashflow/projection`| Day-by-day balance projection (1-12 months)|

#### Projection Query Params
- `months` (int, 1-12, default 3)

---

## Dashboard

| Method | Endpoint                         | Description                             |
| ------ | -------------------------------- | --------------------------------------- |
| GET    | `/api/dashboard`                 | Main metrics (debt, cash, velocity)     |
| GET    | `/api/dashboard/cashflow_monitor`| Income/expense totals by timeframe      |

#### Cashflow Monitor Query Params
- `timeframe`: `daily`, `weekly`, `monthly`, `annual`
- `type`: `income`, `expense`

---

## Strategy

| Method | Endpoint                             | Description                              |
| ------ | ------------------------------------ | ---------------------------------------- |
| GET    | `/api/strategy/velocity`             | Velocity status + projections            |
| GET    | `/api/strategy/peace-shield`         | Shield health + recommendations          |
| GET    | `/api/strategy/tactical-gps`         | Suggested movements (attack schedule)    |
| POST   | `/api/strategy/execute-movement`     | Execute a debt transfer movement         |
| GET    | `/api/strategy/executed-movements`   | History of all executed movements        |
| GET    | `/api/strategy/command-center`       | Consolidated strategy dashboard          |
| POST   | `/api/strategy/simulator`            | Purchase impact simulator                |

---

## Transactions

| Method | Endpoint                              | Description                             |
| ------ | ------------------------------------- | --------------------------------------- |
| POST   | `/api/transactions`                   | Create transaction (auto-updates balance)|
| POST   | `/api/transactions/manual`            | Create manual transaction               |
| GET    | `/api/transactions/recent`            | Last 50 transactions                    |
| GET    | `/api/transactions/classified`        | Categorized transactions                |
| GET    | `/api/cashflow-intelligence`          | AI-powered cashflow insights            |
| POST   | `/api/plaid/create-link-token`        | Start Plaid Link flow                   |
| POST   | `/api/plaid/exchange-token`           | Exchange public token for access token  |
| GET    | `/api/plaid/accounts/{access_token}`  | Fetch Plaid accounts                    |
| POST   | `/api/plaid/import-accounts`          | Import Plaid accounts to KoreX          |
| POST   | `/api/plaid/sync-transactions`        | Sync and auto-verify transactions       |

---

## Demo

| Method | Endpoint               | Description                               |
| ------ | ---------------------- | ----------------------------------------- |
| POST   | `/api/demo/seed`       | Populate DB with stress-test data         |
