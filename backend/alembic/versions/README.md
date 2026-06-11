# Alembic migrations

Generate a new migration after changing `models.py`:

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

## Baseline (`bd322c6ada8b`)

The first migration captures the full schema as of June 2026.

- **Fresh database:** `alembic upgrade head` creates everything.
- **Existing database that already has the tables** (e.g. current production):
  run `alembic stamp head` ONCE to mark it as up-to-date **without**
  executing the CREATE TABLEs. After that, future migrations apply
  normally with `alembic upgrade head`.

`DATABASE_URL` is read from the environment / `backend/.env` (see
`alembic/env.py`). Never run `upgrade` against a DB that already has
tables but no `alembic_version` row — stamp it first.
