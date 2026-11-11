"""RLS deny-by-default on every public table (Supabase advisory 2026-11-10)

Supabase reported rls_disabled_in_public: 16 tables had no RLS and 5 more had
"USING (true)" policies for role public, so the anon key embedded in the PWA
could read and write them through PostgREST. KoreX never reads tables through
PostgREST (the frontend uses Supabase only for Auth) and the backend connects
as `postgres` (table owner, BYPASSRLS), so the safe state is: RLS enabled on
every public table and NO policies at all.

Already applied in production on 2026-11-11 through the Supabase MCP
(migration `rls_deny_by_default_public`); this revision is idempotent and keeps
new environments in the same state. Postgres only (SQLite has no RLS).

Rule for new tables: their migration must ENABLE ROW LEVEL SECURITY too.

Revision ID: c4e8a1f7d2b6
Revises: a9e3c7d1f5b2
Create Date: 2026-11-11

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c4e8a1f7d2b6'
down_revision: Union[str, None] = 'a9e3c7d1f5b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DENY_BY_DEFAULT = """
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
    FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;
"""


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(DENY_BY_DEFAULT)


def downgrade() -> None:
    # Deliberately a no-op: going back would re-open the tables to the anon key.
    pass
