"""Tests for token filter service."""

import pytest
from decimal import Decimal
from unittest.mock import Mock

from src.services.token_filter_service import TokenFilterService
from src.services.pricing_service import PricingServiceInterface


class TestTokenFilterService:
    """Test suite for token filter service."""
    
    @pytest.fixture
    def mock_pricing_service(self):
        """Create mock pricing service."""
        service = Mock(spec=PricingServiceInterface)
        service.get_token_price_usd.return_value = Decimal("0.02")  # $0.02 per token
        return service
    
    @pytest.fixture
    def filter_service(self, mock_pricing_service):
        """Create filter service with mock pricing service."""
        return TokenFilterService(mock_pricing_service)
    
    @pytest.fixture
    def sample_holders(self):
        """Sample holder data for testing."""
        return [
            {"account_id": "0.0.1", "balance": 1000.0},  # $20 USD
            {"account_id": "0.0.2", "balance": 500.0},   # $10 USD
            {"account_id": "0.0.3", "balance": 100.0},   # $2 USD
            {"account_id": "0.0.4", "balance": 50.0},    # $1 USD
            {"account_id": "0.0.5", "balance": 25.0},    # $0.50 USD
        ]
    
    def test_filter_holders_by_usd_value_min_filter(self, filter_service, sample_holders, mock_pricing_service):
        """Test filtering holders by minimum USD value."""
        # Filter for holders with at least $5 USD
        min_usd = Decimal("5.0")
        filtered = filter_service.filter_holders_by_usd_value(
            sample_holders, "0.0.test", min_usd_value=min_usd
        )
        
        # Should return holders with >= $5 (first 2 holders)
        assert len(filtered) == 2
        assert filtered[0]["account_id"] == "0.0.1"
        assert filtered[1]["account_id"] == "0.0.2"
        
        # Check USD values are added
        assert filtered[0]["usd_value"] == 20.0
        assert filtered[1]["usd_value"] == 10.0
        assert filtered[0]["price_usd"] == 0.02
        
        mock_pricing_service.get_token_price_usd.assert_called_with("0.0.test")
    

    

    
    def test_filter_holders_no_filters(self, filter_service, sample_holders):
        """Test that no filtering returns all holders."""
        filtered = filter_service.filter_holders_by_usd_value(
            sample_holders, "0.0.test"
        )
        
        assert len(filtered) == len(sample_holders)
        assert filtered == sample_holders
    
    def test_filter_holders_no_price_data(self, filter_service, sample_holders):
        """Test filtering when no price data is available."""
        # Mock pricing service to return None
        filter_service.pricing_service.get_token_price_usd.return_value = None
        
        filtered = filter_service.filter_holders_by_usd_value(
            sample_holders, "0.0.test", min_usd_value=Decimal("5.0")
        )
        
        # Should return all holders unchanged
        assert len(filtered) == len(sample_holders)
        assert filtered == sample_holders
    
    def test_calculate_usd_values(self, filter_service, sample_holders, mock_pricing_service):
        """Test adding USD values without filtering."""
        enriched = filter_service.calculate_usd_values(sample_holders, "0.0.test")
        
        assert len(enriched) == len(sample_holders)
        
        # Check USD values are added correctly
        assert enriched[0]["usd_value"] == 20.0  # 1000 * 0.02
        assert enriched[1]["usd_value"] == 10.0  # 500 * 0.02
        assert enriched[2]["usd_value"] == 2.0   # 100 * 0.02
        
        # Check original data is preserved
        assert enriched[0]["account_id"] == "0.0.1"
        assert enriched[0]["balance"] == 1000.0
    
    def test_calculate_usd_values_no_price(self, filter_service, sample_holders):
        """Test USD calculation when no price data is available."""
        filter_service.pricing_service.get_token_price_usd.return_value = None
        
        enriched = filter_service.calculate_usd_values(sample_holders, "0.0.test")
        
        # Should return original holders unchanged
        assert enriched == sample_holders
    
    def test_get_minimum_token_balance_for_usd(self, filter_service, mock_pricing_service):
        """Test calculating minimum token balance for USD amount."""
        # Mock return value for get_tokens_for_usd_amount
        mock_pricing_service.get_tokens_for_usd_amount.return_value = Decimal("50.0")
        
        result = filter_service.get_minimum_token_balance_for_usd("0.0.test", Decimal("1.0"))
        
        assert result == Decimal("50.0")
        mock_pricing_service.get_tokens_for_usd_amount.assert_called_with("0.0.test", Decimal("1.0"))
    
    def test_custom_balance_key(self, filter_service, mock_pricing_service):
        """Test filtering with custom balance key."""
        holders = [
            {"account_id": "0.0.1", "custom_balance": 1000.0},
            {"account_id": "0.0.2", "custom_balance": 100.0},
        ]
        
        filtered = filter_service.filter_holders_by_usd_value(
            holders, "0.0.test", min_usd_value=Decimal("5.0"), balance_key="custom_balance"
        )
        
        assert len(filtered) == 1  # Only $20 should pass $5 filter, $2 is below minimum
        assert filtered[0]["usd_value"] == 20.0
    
    def test_invalid_balance_handling(self, filter_service, mock_pricing_service):
        """Test handling of invalid balance values."""
        holders = [
            {"account_id": "0.0.1", "balance": 1000.0},     # Valid
            {"account_id": "0.0.2", "balance": "invalid"},   # Invalid
            {"account_id": "0.0.3", "balance": None},        # Invalid
            {"account_id": "0.0.4", "balance": 100.0},      # Valid
        ]
        
        filtered = filter_service.filter_holders_by_usd_value(
            holders, "0.0.test", min_usd_value=Decimal("1.0")
        )
        
        # Should only return holders with valid balances
        assert len(filtered) == 2
        assert filtered[0]["account_id"] == "0.0.1"
        assert filtered[1]["account_id"] == "0.0.4"