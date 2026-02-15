"""
Test fixtures for CoreX Financial System backend.
Uses in-memory SQLite and the demo token for auth bypass.
"""
import os
import sys

# Ensure backend/ is on the path so imports work correctly from tests/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
# Ensure core_engine is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

# Override DB engine BEFORE importing main
import database
_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
database.engine = _test_engine

from main import app
from auth import DEMO_TOKEN


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once for the test session."""
    SQLModel.metadata.create_all(_test_engine)
    yield
    SQLModel.metadata.drop_all(_test_engine)


@pytest.fixture
def client():
    """FastAPI TestClient with demo auth header pre-configured."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers():
    """Authorization headers using the demo bypass token."""
    return {"Authorization": f"Bearer {DEMO_TOKEN}"}


@pytest.fixture
def seeded_account(client, auth_headers):
    """Create a single test account and return the response data."""
    account_data = {
        "name": "Test Checking",
        "type": "checking",
        "balance": 5000.00,
        "interest_rate": 0.01,
        "min_payment": 0,
        "payment_frequency": "monthly",
    }
    resp = client.post("/api/accounts", json=account_data, headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()


@pytest.fixture
def seeded_debt_account(client, auth_headers):
    """Create a test debt account and return the response data."""
    account_data = {
        "name": "Test Credit Card",
        "type": "debt",
        "balance": 5000.00,
        "interest_rate": 24.99,
        "min_payment": 0,
        "payment_frequency": "monthly",
    }
    resp = client.post("/api/accounts", json=account_data, headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()
