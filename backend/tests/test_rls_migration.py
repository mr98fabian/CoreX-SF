"""RLS deny-by-default (Supabase advisory 2026-11-10): the migration covers
every public table dynamically, drops every policy, is Postgres-only, and its
downgrade never re-opens the tables."""
from pathlib import Path

MIG = next((Path(__file__).resolve().parents[1] / "alembic" / "versions").glob("c4e8a1f7d2b6_*.py")).read_text(encoding="utf-8")


def test_enables_rls_on_every_public_table_and_drops_every_policy():
    assert "FROM pg_tables WHERE schemaname = 'public'" in MIG
    assert "ENABLE ROW LEVEL SECURITY" in MIG
    assert "FROM pg_policies WHERE schemaname = 'public'" in MIG and "DROP POLICY" in MIG
    assert "CREATE POLICY" not in MIG  # deny by default: no policy opens anything


def test_postgres_only_and_downgrade_does_not_reopen():
    assert 'dialect.name != "postgresql"' in MIG
    down = MIG[MIG.index("def downgrade"):]
    assert "DISABLE ROW LEVEL SECURITY" not in down and "CREATE POLICY" not in down
    assert "down_revision: Union[str, None] = 'a9e3c7d1f5b2'" in MIG
