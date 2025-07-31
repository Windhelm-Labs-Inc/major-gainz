import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

class TestTokenHoldings:
    """Test suite for the token_holdings endpoint."""

    def setup_method(self):
        """Set up the test client before each test."""
        self.client = TestClient(app)

    def teardown_method(self):
        """Clean up resources after each test."""
        pass  # No-op for this suite

    @patch('app.routers.token_holdings.get_token_holdings_data')
    def test_get_holdings_data_hbar(self, mock_get_data):
        """Test the /token_holdings/HBAR endpoint."""
        mock_get_data.return_value = {
            "token_name": "HBAR",
            "token_id": "0.0.1",
            "last_updated_at": "2025-07-29 03:44:34",
            "address": "0.0.12345",
            "token_balance": 1000.0,
            "percentile_rank": 50.0,
            "percentile_balances": {"p50": 1000.0},
            "top_10_holders": [{"account_id": "0.0.54321", "balance": 50000.0}]
        }
        
        request_body = {
            "address": "0.0.12345",
            "token_balance": "1000"
        }
        
        response = self.client.post("/token_holdings/HBAR", json=request_body)
        
        assert response.status_code == 200
        
        mock_get_data.assert_called_once_with(
            token="HBAR",
            address="0.0.12345",
            token_balance="1000"
        )
        
        data = response.json()
        assert data["token_name"] == "HBAR"
        assert "token_id" in data
        assert "last_updated_at" in data

    @patch('app.routers.token_holdings.get_token_holdings_data')
    def test_get_holdings_data_pack(self, mock_get_data):
        """Test the /token_holdings/PACK endpoint."""
        mock_get_data.return_value = {
            "token_name": "PACK",
            "token_id": "0.0.4794920",
            "last_updated_at": "2025-07-29 03:44:35",
            "address": "0.0.54321",
            "token_balance": 250.0,
            "percentile_rank": 75.0,
            "percentile_balances": {"p75": 250.0},
            "top_10_holders": [{"account_id": "0.0.12345", "balance": 10000.0}]
        }
        
        request_body = {
            "address": "0.0.54321",
            "token_balance": "250"
        }
        
        response = self.client.post("/token_holdings/PACK", json=request_body)
        
        assert response.status_code == 200
        
        mock_get_data.assert_called_once_with(
            token="PACK",
            address="0.0.54321",
            token_balance="250"
        )
        
        data = response.json()
        assert data["token_name"] == "PACK"
        assert data["percentile_rank"] == 75.0

    def test_get_holdings_data_not_found(self):
        """Test the endpoint with a token that does not exist."""
        request_body = {
            "address": "0.0.12345",
            "token_balance": "100"
        }
        
        response = self.client.post("/token_holdings/NONEXISTENT", json=request_body)
        
        assert response.status_code == 404
        assert "Token not found" in response.json()["detail"]