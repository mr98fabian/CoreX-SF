"""Revoke public-schema grants from anon and authenticated (close the GraphQL surface)

c4e8a1f7d2b6 left RLS on with zero policies, so the anon key could not READ rows, but the
roles anon and authenticated still held table grants. pg_graphql builds its schema from
those grants, so introspection exposed every table and column of public.

KoreX never reads tables through PostgREST or GraphQL: the frontend uses Supabase only
for Auth, and the backend connects directly as `postgres` (owner). service_role and
postgres are NOT touched.

What this revokes (state read from production on 2026-11-13):
  - every table privilege on all 22 public tables (SELECT, INSERT, UPDATE, DELETE,
    TRUNCATE, REFERENCES, TRIGGER, MAINTAIN), for anon and authenticated;
  - USAGE/SELECT/UPDATE on the public sequences, for anon and authenticated;
  - the DEFAULT PRIVILEGES of role postgres in public for tables and sequences, so a
    table created by a future migration does not come back open.
Not touched: function EXECUTE grants, and the default privileges owned by
supabase_admin (only that role can change them; our migrations create tables as postgres).

Postgres only, and only where the Supabase roles exist (CI/local Postgres and SQLite skip).
downgrade() restores exactly the previous grants.

Revision ID: e5b9d3f1a7c2
Revises: d7a2c5e9b14f
Create Date: 2026-11-13

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e5b9d3f1a7c2'
down_revision: Union[str, None] = 'd7a2c5e9b14f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ONLY_WITH_SUPABASE_ROLES = """
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
{body}
    END IF;
END $$;
"""

REVOKE = """
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
"""

RESTORE = """
        GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
        ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
"""


def _run(body: str) -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(_ONLY_WITH_SUPABASE_ROLES.format(body=body))


def upgrade() -> None:
    _run(REVOKE)


def downgrade() -> None:
    _run(RESTORE)
