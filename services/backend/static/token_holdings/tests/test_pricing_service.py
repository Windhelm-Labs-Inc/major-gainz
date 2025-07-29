"""Tests for SaucerSwap pricing service."""

import pytest
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from src.services.pricing_service import SaucerSwapPricingService


class TestSaucerSwapPricingService:
    """Test suite for SaucerSwap pricing service."""
    
    @pytest.fixture
    def mock_tokens_response(self):
        """Mock response from SaucerSwap tokens API."""
        return [
            {
                "id": "0.0.731861",
                "icon": "/images/tokens/sauce.svg",
                "symbol": "SAUCE",
                "decimals": 6,
                "price": "36806544",
                "priceUsd": 0.01760954,
                "dueDiligenceComplete": True,
                "isFeeOnTransferToken": False
            },
            {
                "id": "0.0.2283230",
                "symbol": "KARATE",
                "decimals": 8,
                "priceUsd": 0.005,
                "dueDiligenceComplete": True,
                "isFeeOnTransferToken": False
            }
        ]
    
    @pytest.fixture
    def pricing_service(self):
        """Create pricing service instance for testing."""
        return SaucerSwapPricingService("test-api-key")
    
    def test_initialization(self):
        """Test service initialization."""
        service = SaucerSwapPricingService("test-key", "https://test.api")
        assert service.api_key == "test-key"
        assert service.base_url == "https://test.api"
        assert "x-api-key" in service.session.headers
        assert service.session.headers["x-api-key"] == "test-key"
    
    def test_cache_validity(self, pricing_service):
        """Test price cache validity logic."""
        # Initially cache should be invalid
        assert not pricing_service._is_cache_valid()
        
        # Set cache update time
        pricing_service._last_cache_update = datetime.utcnow()
        assert pricing_service._is_cache_valid()
        
        # Test expired cache
        pricing_service._last_cache_update = datetime.utcnow() - timedelta(minutes=10)
        assert not pricing_service._is_cache_valid()
    
    @patch('src.services.pricing_service.requests.Session.get')
    def test_make_request_success(self, mock_get, pricing_service, mock_tokens_response):
        """Test successful API request."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_tokens_response
        mock_response.headers.get.return_value = "9999"
        mock_get.return_value = mock_response
        
        result = pricing_service._make_request("/tokens")
        
        assert result == mock_tokens_response
        mock_get.assert_called_once()
    
    @patch('src.services.pricing_service.requests.Session.get')
    def test_make_request_rate_limited(self, mock_get, pricing_service):
        """Test handling of rate limiting."""
        # First call returns 429, second succeeds
        rate_limited_response = MagicMock()
        rate_limited_response.status_code = 429
        rate_limited_response.headers.get.return_value = "1"
        
        success_response = MagicMock()
        success_response.status_code = 200
        success_response.json.return_value = {"test": "data"}
        success_response.headers.get.return_value = "9998"
        
        mock_get.side_effect = [rate_limited_response, success_response]
        
        with patch('time.sleep') as mock_sleep:
            result = pricing_service._make_request("/tokens")
        
        assert result == {"test": "data"}
        mock_sleep.assert_called_once_with(1)
        assert mock_get.call_count == 2
    
    @patch('src.services.pricing_service.requests.Session.get')
    def test_refresh_price_cache(self, mock_get, pricing_service, mock_tokens_response):
        """Test price cache refresh."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_tokens_response
        mock_response.headers.get.return_value = "9999"
        mock_get.return_value = mock_response
        
        success = pricing_service.refresh_price_cache()
        
        assert success is True
        assert len(pricing_service._price_cache) == 2
        assert "0.0.731861" in pricing_service._price_cache
        assert "0.0.2283230" in pricing_service._price_cache
        
        sauce_data = pricing_service._price_cache["0.0.731861"]
        assert sauce_data["symbol"] == "SAUCE"
        assert sauce_data["price_usd"] == Decimal("0.01760954")
        assert sauce_data["decimals"] == 6
    
    def test_get_token_price_usd(self, pricing_service, mock_tokens_response):
        """Test getting token USD price."""
        # Mock successful cache refresh
        with patch.object(pricing_service, '_make_request', return_value=mock_tokens_response):
            price = pricing_service.get_token_price_usd("0.0.731861")
            assert price == Decimal("0.01760954")
            
            # Test non-existent token
            price = pricing_service.get_token_price_usd("0.0.999999")
            assert price is None
    
    def test_get_tokens_for_usd_amount(self, pricing_service, mock_tokens_response):
        """Test calculating token amount for USD value."""
        with patch.object(pricing_service, '_make_request', return_value=mock_tokens_response):
            # Test with SAUCE token
            tokens = pricing_service.get_tokens_for_usd_amount("0.0.731861", Decimal("1.0"))
            expected = Decimal("1.0") / Decimal("0.01760954")
            assert abs(tokens - expected) < Decimal("0.0001")
            
            # Test with non-existent token
            tokens = pricing_service.get_tokens_for_usd_amount("0.0.999999", Decimal("1.0"))
            assert tokens is None
    
    def test_get_token_info(self, pricing_service, mock_tokens_response):
        """Test getting complete token information."""
        with patch.object(pricing_service, '_make_request', return_value=mock_tokens_response):
            info = pricing_service.get_token_info("0.0.731861")
            assert info is not None
            assert info["symbol"] == "SAUCE"
            assert info["decimals"] == 6
            assert info["price_usd"] == Decimal("0.01760954")
            
            # Test non-existent token
            info = pricing_service.get_token_info("0.0.999999")
            assert info is None
    
    def test_get_supported_tokens(self, pricing_service, mock_tokens_response):
        """Test getting supported tokens list."""
        with patch.object(pricing_service, '_make_request', return_value=mock_tokens_response):
            tokens = pricing_service.get_supported_tokens()
            assert len(tokens) == 2
            assert "0.0.731861" in tokens
            assert "0.0.2283230" in tokens
    
    @patch('src.services.pricing_service.requests.Session.get')
    def test_api_failure_handling(self, mock_get, pricing_service):
        """Test handling of API failures."""
        mock_get.side_effect = Exception("Network error")
        
        success = pricing_service.refresh_price_cache()
        assert success is False
        
        price = pricing_service.get_token_price_usd("0.0.731861")
        assert price is None


# Integration test (minimal API calls)
@pytest.mark.integration
def test_saucerswap_integration():
    """Integration test with real SaucerSwap API (if API key is available)."""
    from src.config import get_saucerswap_api_key
    
    api_key = get_saucerswap_api_key()
    if not api_key:
        pytest.skip("SaucerSwap API key not available")
    
    service = SaucerSwapPricingService(api_key)
    
    # Test cache refresh - this is the only real API call
    success = service.refresh_price_cache()
    assert success is True
    
    # Test with known tokens (using cached data now)
    supported_tokens = service.get_supported_tokens()
    assert len(supported_tokens) > 0
    
    # Test price retrieval for SAUCE token if available
    if "0.0.731861" in supported_tokens:
        price = service.get_token_price_usd("0.0.731861")
        assert price is not None
        assert price > 0
        
        # Test token amount calculation
        tokens_for_dollar = service.get_tokens_for_usd_amount("0.0.731861", Decimal("1.0"))
        assert tokens_for_dollar is not None
        assert tokens_for_dollar > 0