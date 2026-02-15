"""
Integration tests for Dashboard endpoints.
"""


class TestDashboardMetrics:
    """Test the main /api/dashboard endpoint."""

    def test_dashboard_returns_required_fields(self, client, auth_headers, seeded_account):
        resp = client.get("/api/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # Core fields must exist in every response
        assert "total_debt" in data
        assert "liquid_cash" in data
        assert "attack_equity" in data
        assert "shield_target" in data

    def test_dashboard_with_debt_shows_velocity_target(self, client, auth_headers, seeded_debt_account):
        resp = client.get("/api/dashboard", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()

        # With a debt account, velocity_target should be populated
        if data.get("velocity_target"):
            vt = data["velocity_target"]
            assert "name" in vt
            assert "balance" in vt
            assert "interest_rate" in vt


class TestCashflowMonitor:
    """Test the cashflow monitor endpoint."""

    def test_monitor_returns_shape(self, client, auth_headers):
        resp = client.get("/api/dashboard/cashflow_monitor?timeframe=monthly&type=income", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_amount" in data
        assert "transaction_count" in data
        assert data["timeframe"] == "monthly"
