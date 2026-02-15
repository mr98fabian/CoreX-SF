# CoreX Architecture

## System Overview

```mermaid
graph TB
    subgraph Frontend ["Frontend (Vite + React)"]
        FE[Feature-Based Components]
    end

    subgraph Backend ["Backend (FastAPI)"]
        MAIN[main.py — Slim Entrypoint]
        AUTH[auth.py — JWT Validation]
        
        subgraph Routers
            R1[accounts.py]
            R2[cashflow.py]
            R3[dashboard.py]
            R4[strategy.py]
            R5[transactions.py]
            R6[demo.py]
        end
        
        subgraph Shared
            SCH[schemas.py]
            HLP[helpers.py]
        end
        
        VE[velocity_engine.py]
    end

    subgraph Core ["Core Engine (Pure Python)"]
        CALC[calculators.py]
    end

    subgraph Data ["Data Layer"]
        DB[(Supabase PostgreSQL)]
        MODELS[models.py + database.py]
    end

    FE -->|HTTP + JWT| MAIN
    MAIN --> AUTH
    MAIN --> Routers
    Routers --> Shared
    Routers --> VE
    Routers --> CALC
    Routers --> MODELS
    MODELS --> DB
```

## Design Principles

| Principle               | Implementation                                               |
| ----------------------- | ------------------------------------------------------------ |
| **Separation of Concerns** | Routers handle HTTP, `velocity_engine.py` handles math, `core_engine/` holds pure functions |
| **Dependency Injection**    | Auth via `Depends(get_current_user_id)` — swappable for tests |
| **Config over Code**        | CORS origins, Supabase URL, etc. driven by `os.getenv()`      |
| **Fail Fast**               | Auth checks happen before any DB call                          |
| **Testability**             | In-memory SQLite + demo token for fast integration tests       |

## Authentication Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant SB as Supabase Auth

    FE->>API: Request + Bearer JWT
    API->>API: Extract token
    alt Demo Token
        API-->>FE: Return demo user_id
    else Real Token
        API->>SB: GET /auth/v1/user
        SB-->>API: User data + id
        API-->>FE: Continue with user_id
    end
```

## Data Model

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : owns
    USER ||--o{ CASHFLOW_ITEM : configures
    ACCOUNT ||--o{ TRANSACTION : has
    USER ||--o{ MOVEMENT_LOG : executes

    ACCOUNT {
        int id PK
        string user_id FK
        string name
        string type
        decimal balance
        decimal interest_rate
        decimal min_payment
        int due_day
        int closing_day
    }
    
    TRANSACTION {
        int id PK
        string user_id FK
        int account_id FK
        decimal amount
        string type
        string description
        datetime date
    }
    
    MOVEMENT_LOG {
        int id PK
        string user_id FK
        string status
        int verified_transaction_id FK
    }
```

## Deployment

| Component | Platform | Config                      |
| --------- | -------- | --------------------------- |
| Frontend  | Vercel   | `vercel.json` (SPA rewrites)|
| Backend   | Railway  | `Procfile` (uvicorn)        |
| Database  | Supabase | Managed PostgreSQL          |
