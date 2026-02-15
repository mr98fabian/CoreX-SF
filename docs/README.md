# CoreX Financial System

> **Velocity Banking Engine** — A full-stack application that automates debt elimination using the Velocity Banking strategy.

## Tech Stack

| Layer      | Technology                             |
| ---------- | -------------------------------------- |
| Frontend   | React + TypeScript + Vite              |
| Backend    | FastAPI (Python 3.11+)                 |
| Database   | Supabase (PostgreSQL) / SQLite (dev)   |
| Auth       | Supabase Auth (JWT)                    |
| Deployment | Vercel (frontend) + Railway (backend)  |

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm / pnpm

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
```

## Running Tests

```bash
cd backend
pytest -v
```

## Project Structure

```
CoreX Financial System/
├── backend/
│   ├── main.py              # Slim entrypoint (CORS, startup, router registration)
│   ├── auth.py              # JWT authentication dependency
│   ├── database.py          # Engine + table creation + seed data
│   ├── models.py            # SQLModel / Pydantic models
│   ├── schemas.py           # Shared Pydantic request schemas
│   ├── helpers.py           # Shared utilities (FK bypass, conversions)
│   ├── velocity_engine.py   # Core Velocity Banking algorithms
│   ├── routers/
│   │   ├── accounts.py      # Account CRUD
│   │   ├── cashflow.py      # Recurring items + projection
│   │   ├── dashboard.py     # Metrics + cashflow monitor
│   │   ├── strategy.py      # Velocity, Shield, GPS, Simulator
│   │   ├── transactions.py  # Transactions + Plaid sync
│   │   └── demo.py          # Stress-test data seeding
│   └── tests/
│       ├── conftest.py       # Fixtures (in-memory SQLite, demo auth)
│       ├── test_calculators.py
│       ├── test_velocity_engine.py
│       ├── test_accounts.py
│       └── test_dashboard.py
├── core_engine/
│   ├── __init__.py
│   └── calculators.py       # Pure financial math (no DB dependency)
├── frontend/
│   └── src/
│       └── features/        # Feature-based architecture
└── docs/
    ├── API.md
    └── ARCHITECTURE.md
```

## License

Private — All rights reserved.
