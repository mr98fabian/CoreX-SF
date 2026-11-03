"""The DB bootstrap must fail loudly in production instead of silently falling
back to an ephemeral SQLite file (which hid a dead Supabase connection behind
a healthy-looking /health)."""
import os
import subprocess
import sys

BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")


def _import_database(env_overrides: dict) -> subprocess.CompletedProcess:
    # DATABASE_URL="" (present but empty) stops load_dotenv() from pulling in a developer .env
    env = {k: v for k, v in os.environ.items() if k not in ("DATABASE_URL", "ENVIRONMENT")}
    env["DATABASE_URL"] = ""
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-c", "import database"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True, timeout=60,
    )


def test_production_without_database_url_fails_at_boot():
    r = _import_database({"ENVIRONMENT": "production"})
    assert r.returncode != 0
    assert "DATABASE_URL is not set" in r.stderr


def test_production_with_unreachable_db_fails_and_masks_credentials():
    secret = "S3cretPassw0rd"
    url = f"postgresql://postgres.abcdefgh:{secret}@127.0.0.1:1/postgres"
    r = _import_database({"ENVIRONMENT": "production", "DATABASE_URL": url})
    assert r.returncode != 0
    assert "Cannot connect to the database" in r.stderr
    assert "127.0.0.1:1/postgres" in r.stderr
    assert secret not in r.stderr and secret not in r.stdout
    assert "abcdefgh" not in r.stderr and "abcdefgh" not in r.stdout


def test_development_still_allows_sqlite_fallback():
    r = _import_database({"ENVIRONMENT": "development"})
    assert r.returncode == 0
