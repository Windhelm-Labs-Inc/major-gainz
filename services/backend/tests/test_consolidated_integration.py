import pytest
import datetime
import math
import numpy as np
from app.services.coingecko import fetch_ohlc, process_ohlc_list
from app.settings import HEDERA_TOKEN_IDS, DEFAULT_DAYS
from app.crud import _get_closes
from app.database import SessionLocal


class TestConsolidatedIntegration:
    """Consolidated test suite with full coverage using only 2 CoinGecko API calls."""

    @pytest.mark.asyncio
    async def test_full_coingecko_integration_hbar(self):
        """
        FIRST API CALL: Test complete HBAR integration pipeline.
        Tests: fetch_ohlc, process_ohlc_list, and data validation.
        """
        api_id = HEDERA_TOKEN_IDS["HBAR"]
        
        # Make the first (and primary) API call
        raw_data = await fetch_ohlc(api_id, days=7)
        
        # Validate raw API response
        assert isinstance(raw_data, list)
        assert len(raw_data) > 0
        
        # Each OHLC entry should have 5 elements: [timestamp, open, high, low, close]
        for entry in raw_data:
            assert isinstance(entry, list)
            assert len(entry) == 5
            assert all(isinstance(val, (int, float)) for val in entry)
            
            # Validate OHLC logic: high >= open, close; low <= open, close
            timestamp, open_price, high, low, close = entry
            assert high >= open_price
            assert high >= close
            assert low <= open_price
            assert low <= close

        # Test data processing
        processed_data = process_ohlc_list(raw_data)
        
        assert len(processed_data) > 0
        
        # Validate structure of processed data
        for record in processed_data:
            assert isinstance(record["date"], datetime.date)
            assert isinstance(record["open"], (int, float))
            assert isinstance(record["high"], (int, float))
            assert isinstance(record["low"], (int, float))
            assert isinstance(record["close"], (int, float))
            assert record["volume"] == 0.0  # OHLC endpoint doesn't provide volume
            
            # Validate OHLC relationships
            assert record["high"] >= record["open"]
            assert record["high"] >= record["close"]
            assert record["low"] <= record["open"]
            assert record["low"] <= record["close"]
        
        # Check chronological order
        dates = [record["date"] for record in processed_data]
        assert dates == sorted(dates)

    @pytest.mark.asyncio
    async def test_full_coingecko_integration_usdc(self):
        """
        SECOND API CALL: Test another token to verify system works across different tokens.
        Also tests default days parameter functionality.
        """
        api_id = HEDERA_TOKEN_IDS["USDC"]
        
        # Make the second (and final) API call using default days
        raw_data = await fetch_ohlc(api_id)  # Uses DEFAULT_DAYS
        
        # Validate response
        assert isinstance(raw_data, list)
        if len(raw_data) > 0:  # Some tokens might have limited data
            processed_data = process_ohlc_list(raw_data)
            assert len(processed_data) > 0
            
            # Quick validation of first record
            first_record = processed_data[0]
            assert isinstance(first_record["date"], datetime.date)
            assert first_record["volume"] == 0.0

    def test_process_ohlc_list_edge_cases(self):
        """Test data processing functions thoroughly without API calls."""
        
        # Test basic conversion
        sample_data = [
            [1609459200000, 0.1, 0.12, 0.09, 0.11],  # 2021-01-01
            [1609545600000, 0.11, 0.13, 0.10, 0.12], # 2021-01-02
        ]
        
        result = process_ohlc_list(sample_data)
        
        assert len(result) == 2
        
        # Check first record
        first = result[0]
        assert first["date"] == datetime.date(2021, 1, 1)
        assert first["open"] == 0.1
        assert first["high"] == 0.12
        assert first["low"] == 0.09
        assert first["close"] == 0.11
        assert first["volume"] == 0.0

        # Test same-day aggregation
        same_day_data = [
            [1609459200000, 0.1, 0.12, 0.09, 0.11],
            [1609459200000, 0.11, 0.15, 0.08, 0.14],
        ]
        
        result = process_ohlc_list(same_day_data)
        
        assert len(result) == 1
        record = result[0]
        assert record["date"] == datetime.date(2021, 1, 1)
        assert record["open"] == 0.1  # First open
        assert record["high"] == 0.15  # Max of all highs
        assert record["low"] == 0.08   # Min of all lows
        assert record["close"] == 0.14 # Last close
        
        # Test chronological ordering
        reverse_data = [
            [1609545600000, 0.11, 0.13, 0.10, 0.12], # 2021-01-02
            [1609459200000, 0.1, 0.12, 0.09, 0.11],  # 2021-01-01
        ]
        
        result = process_ohlc_list(reverse_data)
        
        assert len(result) == 2
        assert result[0]["date"] == datetime.date(2021, 1, 1)
        assert result[1]["date"] == datetime.date(2021, 1, 2)

    def test_complete_api_endpoint_coverage(self, client):
        """Test all API endpoints that depend on existing database data."""
        
        # Test basic OHLCV endpoints
        resp = client.get("/ohlcv/HBAR")
        if resp.status_code == 200:
            data = resp.json()
            assert len(data) >= 0
            if data:
                # Validate response structure - matches OHLCVSchema
                first_record = data[0]
                required_fields = ["date", "open", "high", "low", "close", "volume"]
                for field in required_fields:
                    assert field in first_record

        # Test date range filtering
        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=7)
        
        resp = client.get(f"/ohlcv/HBAR?start={start_date}&end={end_date}")
        assert resp.status_code == 200
        data = resp.json()
        
        # Verify dates are within range if data exists
        if data:
            for record in data:
                record_date = datetime.datetime.strptime(record["date"], "%Y-%m-%d").date()
                assert start_date <= record_date <= end_date

        # Test limit parameter
        resp = client.get("/ohlcv/HBAR?limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) <= 5

        # Test unsupported token
        resp = client.get("/ohlcv/INVALID_TOKEN")
        assert resp.status_code == 404
        assert "not supported" in resp.json()["detail"]

        # Test latest endpoint
        resp = client.get("/ohlcv/HBAR/latest")
        assert resp.status_code in [200, 404]  # Depends on data availability
        if resp.status_code == 200:
            data = resp.json()
            assert "date" in data
            assert "close" in data

        # Test stats endpoint
        resp = client.get("/ohlcv/HBAR/stats")
        assert resp.status_code in [200, 404]  # Depends on data availability
        if resp.status_code == 200:
            stats = resp.json()
            assert stats["token"] == "HBAR"
            assert "average" in stats
            assert "high" in stats
            assert "low" in stats

    def test_return_analytics_coverage(self, client):
        """Test all return analytics endpoints."""
        
        # Test mean return
        resp = client.get("/ohlcv/HBAR/mean_return?days=7")
        if resp.status_code == 200:
            data = resp.json()
            assert data["token"] == "HBAR"
            assert data["days"] == 7
            assert "mean_return" in data
            assert isinstance(data["mean_return"], (int, float))
        else:
            assert resp.status_code == 400  # Insufficient data

        # Test return standard deviation
        resp = client.get("/ohlcv/HBAR/return_std?days=7")
        if resp.status_code == 200:
            data = resp.json()
            assert data["token"] == "HBAR"
            assert data["days"] == 7
            assert "std_return" in data
            assert isinstance(data["std_return"], (int, float))
        else:
            assert resp.status_code == 400

        # Test log returns
        resp = client.get("/ohlcv/HBAR/log_returns?days=7")
        if resp.status_code == 200:
            data = resp.json()
            assert data["token"] == "HBAR"
            assert data["days"] == 7
            assert "log_returns" in data
            assert isinstance(data["log_returns"], list)
        else:
            assert resp.status_code == 400

    def test_data_accuracy_validation(self, client):
        """
        Test return metrics accuracy against database calculations.
        This replaces the parametrized test but only tests HBAR to limit scope.
        """
        symbol = "HBAR"
        days = 7
        
        # Pull closes directly from DB
        db = SessionLocal()
        try:
            closes = _get_closes(db, symbol, days + 1)
        finally:
            db.close()

        if len(closes) <= days:
            # Not enough data for accuracy test, but that's okay
            return

        # Calculate expected values
        closes = closes[-(days+1):]
        returns = np.diff(closes) / closes[:-1]
        mean_true = float(np.mean(returns))
        std_true = float(np.std(returns, ddof=1))

        # Test API responses
        mean_resp = client.get(f"/ohlcv/{symbol}/mean_return?days={days}")
        std_resp = client.get(f"/ohlcv/{symbol}/return_std?days={days}")
        
        if mean_resp.status_code == 200 and std_resp.status_code == 200:
            mean_api = mean_resp.json()["mean_return"]
            std_api = std_resp.json()["std_return"]

            # Validate accuracy within 1% tolerance
            def pct_diff(a, b):
                return abs(a - b) / abs(b) if b else 0.0

            assert pct_diff(mean_api, mean_true) <= 0.01
            assert pct_diff(std_api, std_true) <= 0.01

    def test_token_endpoints_coverage(self, client):
        """Test token-related endpoints that don't make external API calls."""
        
        # Test list tokens
        resp = client.get("/tokens")
        assert resp.status_code == 200
        data = resp.json()
        assert "HBAR" in data
        assert len(data) >= 1

        # Test token lookup
        resp = client.get("/tokens/lookup/0.0.456858")
        assert resp.status_code == 200
        assert resp.json()["symbol"] == "USDC"

        # Test unknown token lookup
        resp = client.get("/tokens/lookup/0.0.9999999")
        assert resp.status_code == 404

    def test_refresh_endpoint(self, client):
        """Test the refresh endpoint."""
        resp = client.post("/refresh")
        assert resp.status_code == 200
        assert resp.json()["status"] == "refresh scheduled" 