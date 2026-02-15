"""
Integration tests for Account CRUD endpoints.
Uses in-memory SQLite via conftest fixtures.
"""


class TestAccountCRUD:
    """Test account creation, retrieval, update, and deletion."""

    def test_create_checking_account(self, client, auth_headers):
        resp = client.post("/api/accounts", json={
            "name": "My Checking",
            "type": "checking",
            "balance": 3000.00,
            "interest_rate": 0.01,
            "min_payment": 0,
            "payment_frequency": "monthly",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "My Checking"
        assert data["type"] == "checking"
        assert float(data["balance"]) == 3000.00

    def test_create_debt_auto_calculates_min_payment(self, client, auth_headers):
        """When min_payment is 0, backend should auto-calculate it."""
        resp = client.post("/api/accounts", json={
            "name": "Visa Card",
            "type": "debt",
            "balance": 5000.00,
            "interest_rate": 24.99,
            "min_payment": 0,
            "payment_frequency": "monthly",
        }, headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        # min_payment should have been auto-calculated (> 0)
        assert float(data["min_payment"]) > 0

    def test_get_accounts_returns_list(self, client, auth_headers, seeded_account):
        resp = client.get("/api/accounts", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_update_account_balance(self, client, auth_headers, seeded_account):
        acc_id = seeded_account["id"]
        resp = client.patch(
            f"/api/accounts/{acc_id}/balance",
            json={"balance": 7500.00},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert float(resp.json()["balance"]) == 7500.00

    def test_delete_account(self, client, auth_headers):
        # Create then delete
        create_resp = client.post("/api/accounts", json={
            "name": "To Delete",
            "type": "savings",
            "balance": 100.00,
            "interest_rate": 1.00,
            "min_payment": 0,
            "payment_frequency": "monthly",
        }, headers=auth_headers)
        acc_id = create_resp.json()["id"]

        del_resp = client.delete(f"/api/accounts/{acc_id}", headers=auth_headers)
        assert del_resp.status_code == 200
        assert del_resp.json()["ok"] is True


class TestHealthCheck:
    """Basic app health."""

    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
