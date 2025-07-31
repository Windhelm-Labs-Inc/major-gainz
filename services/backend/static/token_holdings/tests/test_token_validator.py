"""Tests for token validator service."""

import pytest
import tempfile
import json
import os
from unittest.mock import Mock, patch, MagicMock

from src.services.token_validator import TokenValidator, TokenValidationError, validate_tokens_before_operation


class TestTokenValidator:
    """Test the TokenValidator class."""

    def setup_method(self):
        """Set up test fixtures."""
        self.validator = TokenValidator()

    def test_valid_hedera_token_id_format(self):
        """Test Hedera token ID format validation."""
        # Valid formats
        assert self.validator._is_valid_hedera_token_id("0.0.123456")
        assert self.validator._is_valid_hedera_token_id("0.0.0")
        assert self.validator._is_valid_hedera_token_id("1.2.999999999")
        
        # Invalid formats
        assert not self.validator._is_valid_hedera_token_id("123456")
        assert not self.validator._is_valid_hedera_token_id("0.0")
        assert not self.validator._is_valid_hedera_token_id("0.0.123.456")
        assert not self.validator._is_valid_hedera_token_id("0.0.abc")
        assert not self.validator._is_valid_hedera_token_id("")
        assert not self.validator._is_valid_hedera_token_id(None)

    @patch('src.services.token_validator.load_tokens_config')
    def test_validate_tokens_config_success(self, mock_load_tokens):
        """Test successful token configuration validation."""
        mock_load_tokens.return_value = {
            "HBAR": "0.0.0",
            "SAUCE": "0.0.731861",
            "KARATE": "0.0.2283230"
        }
        
        # Should not raise exception
        result = self.validator._validate_tokens_config()
        assert len(result) == 3
        assert "HBAR" in result
        assert "SAUCE" in result

    @patch('src.services.token_validator.load_tokens_config')
    def test_validate_tokens_config_empty(self, mock_load_tokens):
        """Test validation with empty configuration."""
        mock_load_tokens.return_value = {}
        
        with pytest.raises(TokenValidationError) as exc_info:
            self.validator._validate_tokens_config()
        
        assert "CRITICAL: tokens_enabled.json is empty" in str(exc_info.value)

    @patch('src.services.token_validator.load_tokens_config')
    def test_validate_tokens_config_invalid_token_id(self, mock_load_tokens):
        """Test validation with invalid token ID format."""
        mock_load_tokens.return_value = {
            "SAUCE": "invalid_token_id"
        }
        
        with pytest.raises(TokenValidationError) as exc_info:
            self.validator._validate_tokens_config()
        
        assert "Invalid Hedera token ID format" in str(exc_info.value)

    @patch('src.services.token_validator.load_tokens_config')
    def test_validate_tokens_config_invalid_symbol(self, mock_load_tokens):
        """Test validation with invalid token symbol."""
        mock_load_tokens.return_value = {
            "": "0.0.123456"  # Empty symbol
        }
        
        with pytest.raises(TokenValidationError) as exc_info:
            self.validator._validate_tokens_config()
        
        assert "Invalid token symbol" in str(exc_info.value)

    @patch('src.services.token_validator.get_db_session')
    @patch('src.services.token_validator.load_tokens_config')
    def test_validate_database_consistency_new_tokens(self, mock_load_tokens, mock_get_session):
        """Test detection of new tokens that need to be added."""
        # Mock database has only HBAR
        mock_session = MagicMock()
        mock_session.__enter__.return_value = mock_session
        mock_session.query().distinct().all.return_value = [('HBAR',)]
        
        # Mock the metadata query to return None for HBAR (simulating no existing metadata)
        # This prevents the token ID mismatch check from triggering
        mock_session.query().filter_by().first.return_value = None
        
        mock_get_session.return_value = mock_session
        
        # Config has HBAR and SAUCE
        mock_load_tokens.return_value = {
            "HBAR": "0.0.0",
            "SAUCE": "0.0.731861"
        }
        
        # Should complete without error (just log warnings about new tokens)
        self.validator._validate_database_consistency({"HBAR": "0.0.0", "SAUCE": "0.0.731861"})

    @patch('src.services.token_validator.get_db_session')
    def test_validate_database_consistency_token_id_mismatch(self, mock_get_session):
        """Test detection of token ID mismatches."""
        # Mock database metadata with different token ID
        mock_metadata = Mock()
        mock_metadata.token_id = "0.0.OLD_ID"
        
        mock_session = MagicMock()
        mock_session.__enter__.return_value = mock_session
        mock_session.query().distinct().all.return_value = [('SAUCE',)]
        mock_session.query().filter_by().first.return_value = mock_metadata
        mock_get_session.return_value = mock_session
        
        # Config has different token ID
        tokens_config = {"SAUCE": "0.0.NEW_ID"}
        
        with pytest.raises(TokenValidationError) as exc_info:
            self.validator._validate_database_consistency(tokens_config)
        
        assert "Token ID mismatch" in str(exc_info.value)
        assert "0.0.OLD_ID" in str(exc_info.value)
        assert "0.0.NEW_ID" in str(exc_info.value)

    def test_validate_tokens_on_saucerswap_no_api_key(self):
        """Test SaucerSwap validation when no API key is configured."""
        validator = TokenValidator()
        validator.pricing_service = None
        
        # Should complete without error (just log warning)
        validator._validate_tokens_on_saucerswap({"HBAR": "0.0.0"})

    def test_validate_tokens_on_saucerswap_api_failure(self):
        """Test SaucerSwap validation when API fails."""
        mock_pricing_service = Mock()
        mock_pricing_service.refresh_price_cache.return_value = False
        
        validator = TokenValidator()
        validator.pricing_service = mock_pricing_service
        
        with pytest.raises(TokenValidationError) as exc_info:
            validator._validate_tokens_on_saucerswap({"SAUCE": "0.0.731861"})
        
        assert "Failed to fetch token list from SaucerSwap" in str(exc_info.value)

    def test_validate_tokens_on_saucerswap_missing_token(self):
        """Test SaucerSwap validation when token is not found."""
        mock_pricing_service = Mock()
        mock_pricing_service.refresh_price_cache.return_value = True
        mock_pricing_service.get_supported_tokens.return_value = [
            {"id": "0.0.123456", "symbol": "OTHER_TOKEN"}
        ]
        
        validator = TokenValidator()
        validator.pricing_service = mock_pricing_service
        
        tokens_config = {"SAUCE": "0.0.731861"}  # Not in supported tokens
        
        with pytest.raises(TokenValidationError) as exc_info:
            validator._validate_tokens_on_saucerswap(tokens_config)
        
        assert "TOKEN(S) NOT FOUND ON SAUCERSWAP" in str(exc_info.value)
        assert "SAUCE (ID: 0.0.731861)" in str(exc_info.value)

    def test_validate_tokens_on_saucerswap_success(self):
        """Test successful SaucerSwap validation."""
        mock_pricing_service = Mock()
        mock_pricing_service.refresh_price_cache.return_value = True
        mock_pricing_service.get_supported_tokens.return_value = [
            {"id": "0.0.731861", "symbol": "SAUCE"},
            {"id": "0.0.123456", "symbol": "OTHER"}
        ]
        
        validator = TokenValidator()
        validator.pricing_service = mock_pricing_service
        
        tokens_config = {
            "HBAR": "0.0.0",  # Should be skipped
            "SAUCE": "0.0.731861"  # Should be found
        }
        
        # Should complete without error
        validator._validate_tokens_on_saucerswap(tokens_config)

    @patch('src.services.token_validator.logger')
    def test_critical_failure_logging(self, mock_logger):
        """Test that critical failures are logged with maximum visibility."""
        with pytest.raises(TokenValidationError):
            self.validator._critical_failure("Test critical error")
        
        # Verify critical logging was called
        mock_logger.critical.assert_called()
        
        # Check that the error message was logged
        log_calls = [call[0][0] for call in mock_logger.critical.call_args_list]
        assert any("Test critical error" in call for call in log_calls)
        assert any("CRITICAL TOKEN VALIDATION FAILURE" in call for call in log_calls)

    @patch('src.services.token_validator.TokenValidator')
    def test_validate_tokens_before_operation_success(self, mock_validator_class):
        """Test the convenience function for successful validation."""
        mock_validator = Mock()
        mock_validator.validate_all_tokens.return_value = True
        mock_validator_class.return_value = mock_validator
        
        # Should complete without error
        validate_tokens_before_operation("test operation")
        
        mock_validator.validate_all_tokens.assert_called_once()

    @patch('src.services.token_validator.TokenValidator')
    def test_validate_tokens_before_operation_failure(self, mock_validator_class):
        """Test the convenience function when validation fails."""
        mock_validator = Mock()
        mock_validator.validate_all_tokens.side_effect = TokenValidationError("Test error")
        mock_validator_class.return_value = mock_validator
        
        with pytest.raises(TokenValidationError):
            validate_tokens_before_operation("test operation")


class TestTokenValidatorIntegration:
    """Integration tests for token validator."""
    
    def test_full_validation_with_real_config_structure(self):
        """Test validation with realistic configuration structure."""
        # Create a temporary config file
        config_data = {
            "tokens_enabled": {
                "HBAR": "0.0.0",
                "SAUCE": "0.0.731861"
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            temp_config_path = f.name
        
        try:
            # Mock the config loading to use our temp file
            with patch('src.services.token_validator.load_tokens_config') as mock_load:
                mock_load.return_value = config_data["tokens_enabled"]
                
                # Mock database session to avoid real DB operations
                with patch('src.services.token_validator.get_db_session') as mock_session:
                    mock_sess = MagicMock()
                    mock_sess.__enter__.return_value = mock_sess
                    mock_sess.query().distinct().all.return_value = []  # Empty DB
                    mock_session.return_value = mock_sess
                    
                    # Create validator without pricing service to skip SaucerSwap validation
                    validator = TokenValidator()
                    validator.pricing_service = None
                    
                    # Should complete successfully
                    result = validator.validate_all_tokens()
                    assert result is True
                    
        finally:
            os.unlink(temp_config_path)