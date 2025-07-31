"""Token validation service with critical failure handling."""

import logging
import sys
from typing import Dict, Set, List, Optional
from decimal import Decimal
import requests

from ..config import (
    load_tokens_config, get_saucerswap_api_key,
    load_decimals_config, save_decimals_config, HEDERA_TOKENS_ENDPOINT
)
from ..database import get_db_session, TokenMetadata
from .pricing_service import SaucerSwapPricingService

# Configure critical logger
logger = logging.getLogger(__name__)

# Simple in-memory cache for token decimals to avoid redundant API calls within a session
_decimals_cache = {}


class TokenValidationError(Exception):
    """Critical error in token validation that requires immediate attention."""
    pass


class TokenValidator:
    """Validates token configuration against database and external APIs."""
    
    def __init__(self):
        self.session = requests.Session()
        self.pricing_service = None
        api_key = get_saucerswap_api_key()
        if api_key:
            self.pricing_service = SaucerSwapPricingService(api_key)
        
    def validate_all_tokens(self) -> bool:
        """
        Comprehensive token validation that FAILS LOUDLY on any issues.
        
        Returns True if all validations pass.
        Raises TokenValidationError (terminating process) if any validation fails.
        """
        logger.info("🔍 Starting comprehensive token validation...")
        
        try:
            # Step 1: Load and validate configuration file
            tokens_config = self._validate_tokens_config()
            
            # Step 2: Dynamically fetch and update token decimals
            self._update_token_decimals(tokens_config)
            
            # Step 3: Check database state vs configuration
            self._validate_database_consistency(tokens_config)
            
            # Step 4: Validate tokens exist on SaucerSwap
            self._validate_tokens_on_saucerswap(tokens_config)
            
            logger.info("✅ All token validations passed successfully")
            return True
            
        except TokenValidationError:
            raise # Re-raise to ensure it's caught by CLI
        except Exception as e:
            self._critical_failure(f"Token validation failed: {e}")
    
    def _validate_tokens_config(self) -> Dict[str, str]:
        """Validate tokens_enabled.json file exists and is properly formatted."""
        try:
            tokens_config = load_tokens_config()
            
            if not tokens_config:
                self._critical_failure(
                    "CRITICAL: tokens_enabled.json is empty or missing!\n"
                    "Expected format: {'tokens_enabled': {'HBAR': '0.0.0', 'SAUCE': '0.0.731861'}}\n"
                    "File location: tokens_enabled.json"
                )
            
            # Validate required fields and format
            for token_symbol, token_id in tokens_config.items():
                if not isinstance(token_symbol, str) or not token_symbol.strip():
                    self._critical_failure(f"CRITICAL: Invalid token symbol '{token_symbol}' in tokens_enabled.json")
                
                if not isinstance(token_id, str) or not token_id.strip():
                    self._critical_failure(f"CRITICAL: Invalid token ID '{token_id}' for {token_symbol} in tokens_enabled.json")
                
                # Validate Hedera token ID format (should be like "0.0.123456")
                if token_symbol != "HBAR" and not self._is_valid_hedera_token_id(token_id):
                    self._critical_failure(
                        f"CRITICAL: Invalid Hedera token ID format '{token_id}' for {token_symbol}\n"
                        f"Expected format: '0.0.123456' (three parts separated by dots)"
                    )
            
            logger.info(f"✅ Configuration validated: {len(tokens_config)} tokens found")
            return tokens_config
            
        except TokenValidationError:
            raise  # Re-raise our critical failures
        except Exception as e:
            self._critical_failure(f"CRITICAL: Failed to load tokens_enabled.json: {e}")
    
    def _fetch_token_info_from_hedera(self, token_id: str) -> Optional[Dict]:
        """Fetch detailed token information from Hedera Mirror Node."""
        if not token_id or token_id == "0.0.0":
            return None
        
        url = f"{HEDERA_TOKENS_ENDPOINT}/{token_id}"
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch token info for {token_id}: {e}")
            return None

    def _update_token_decimals(self, tokens_config: Dict[str, str]) -> None:
        """
        Dynamically fetch and save decimal values for any new tokens.
        This makes the system self-configuring for token precision.
        """
        logger.info("🔍 Checking and updating token decimal configurations...")
        
        decimals_data = load_decimals_config()
        updated = False
        
        # HBAR has fixed decimals
        if "HBAR" not in decimals_data:
            decimals_data["HBAR"] = 8
            updated = True
            logger.info("Set default decimals for HBAR to 8")
        
        for token_symbol, token_id in tokens_config.items():
            if token_symbol not in decimals_data:
                logger.info(f"Decimal value for {token_symbol} not found. Fetching from Hedera API...")
                
                token_info = self._fetch_token_info_from_hedera(token_id)
                if token_info and 'decimals' in token_info:
                    try:
                        decimals = int(token_info['decimals'])
                        decimals_data[token_symbol] = decimals
                        _decimals_cache[token_symbol] = decimals
                        updated = True
                        logger.info(f"✅ Fetched and saved decimals for {token_symbol}: {decimals}")
                    except (ValueError, TypeError):
                        self._critical_failure(
                            f"CRITICAL: Invalid 'decimals' value received for {token_symbol} from Hedera API."
                        )
                else:
                    self._critical_failure(
                        f"CRITICAL: Could not fetch 'decimals' for {token_symbol} (ID: {token_id}).\n"
                        f"Please verify the token ID is correct and the Hedera Mirror Node is accessible."
                    )
        
        if updated:
            save_decimals_config(decimals_data)
            logger.info("💾 Saved updated token decimals to src/token_decimals.json")
        else:
            logger.info("✅ All token decimals are up-to-date.")
    
    def _validate_database_consistency(self, tokens_config: Dict[str, str]) -> None:
        """Check if database needs expansion for new tokens."""
        try:
            with get_db_session() as session:
                # Get tokens currently in database
                db_tokens = session.query(TokenMetadata.token_symbol).distinct().all()
                db_token_symbols = {row[0] for row in db_tokens}
                
                # Get tokens from configuration
                config_token_symbols = set(tokens_config.keys())
                
                # Check for new tokens that need to be added
                new_tokens = config_token_symbols - db_token_symbols
                removed_tokens = db_token_symbols - config_token_symbols
                
                if new_tokens:
                    logger.warning(
                        f"🆕 NEW TOKENS DETECTED: {', '.join(new_tokens)}\n"
                        f"These tokens will be added to the database on first refresh."
                    )
                
                if removed_tokens:
                    logger.warning(
                        f"⚠️  TOKENS REMOVED FROM CONFIG: {', '.join(removed_tokens)}\n"
                        f"These tokens remain in database but won't be updated.\n"
                        f"Consider cleaning up old data if these tokens are permanently removed."
                    )
                
                # Validate token IDs haven't changed for existing tokens
                for token_symbol in config_token_symbols & db_token_symbols:
                    db_metadata = session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
                    if db_metadata and db_metadata.token_id != tokens_config[token_symbol]:
                        self._critical_failure(
                            f"CRITICAL: Token ID mismatch for {token_symbol}!\n"
                            f"Database has: '{db_metadata.token_id}'\n"
                            f"Config has:   '{tokens_config[token_symbol]}'\n"
                            f"This indicates either:\n"
                            f"1. The token ID was changed incorrectly in config\n"
                            f"2. The token was migrated/redeployed\n"
                            f"A developer must resolve this before continuing!"
                        )
                
                logger.info("✅ Database consistency validated")
                
        except TokenValidationError:
            raise  # Re-raise our critical failures
        except Exception as e:
            self._critical_failure(f"CRITICAL: Database consistency check failed: {e}")
    
    def _validate_tokens_on_saucerswap(self, tokens_config: Dict[str, str]) -> None:
        """Validate that all configured tokens exist on SaucerSwap."""
        if not self.pricing_service:
            logger.warning("⚠️  SaucerSwap validation skipped - no API key configured")
            return
        
        try:
            logger.info("🔍 Validating tokens exist on SaucerSwap...")
            
            # Refresh price cache to get latest token list
            if not self.pricing_service.refresh_price_cache():
                self._critical_failure(
                    "CRITICAL: Failed to fetch token list from SaucerSwap API!\n"
                    "This could indicate:\n"
                    "1. SaucerSwap API is down\n"
                    "2. Invalid API key\n"
                    "3. Network connectivity issues\n"
                    "Cannot validate token existence - aborting!"
                )
            
            # Get list of supported tokens from SaucerSwap
            supported_tokens = self.pricing_service.get_supported_tokens()
            if not supported_tokens:
                self._critical_failure(
                    "CRITICAL: SaucerSwap returned empty token list!\n"
                    "Cannot validate token existence - this requires immediate investigation!"
                )
            
            supported_token_ids = {token['id'] for token in supported_tokens}
            missing_tokens = []
            
            # Check each configured token
            for token_symbol, token_id in tokens_config.items():
                if token_symbol == "HBAR":
                    # HBAR might not be in SaucerSwap token list
                    continue
                
                if token_id not in supported_token_ids:
                    missing_tokens.append(f"{token_symbol} (ID: {token_id})")
            
            if missing_tokens:
                # Build detailed error message
                error_msg = (
                    f"CRITICAL: {len(missing_tokens)} TOKEN(S) NOT FOUND ON SAUCERSWAP!\n\n"
                    f"Missing tokens:\n"
                )
                for token in missing_tokens:
                    error_msg += f"  ❌ {token}\n"
                
                error_msg += (
                    f"\nThis indicates:\n"
                    f"1. Token ID is incorrect in tokens_enabled.json\n"
                    f"2. Token is not listed on SaucerSwap\n"
                    f"3. Token was delisted or migrated\n\n"
                    f"Available tokens on SaucerSwap: {len(supported_tokens)} found\n"
                    f"Sample available tokens: {[t['symbol'] for t in supported_tokens[:10]]}\n\n"
                    f"A developer must fix the configuration before continuing!"
                )
                
                self._critical_failure(error_msg)
            
            logger.info(f"✅ All {len(tokens_config)} tokens validated on SaucerSwap")
            
        except TokenValidationError:
            raise  # Re-raise our critical failures
        except Exception as e:
            self._critical_failure(f"CRITICAL: SaucerSwap token validation failed: {e}")
    
    def _is_valid_hedera_token_id(self, token_id: str) -> bool:
        """Check if token ID matches Hedera format (e.g., '0.0.123456')."""
        try:
            parts = token_id.split('.')
            if len(parts) != 3:
                return False
            
            # All parts should be numeric
            for part in parts:
                int(part)
            
            return True
        except (ValueError, AttributeError):
            return False
    
    def _critical_failure(self, message: str) -> None:
        """Log critical failure and terminate process."""
        # Log with maximum visibility
        logger.critical("=" * 80)
        logger.critical("🚨 CRITICAL TOKEN VALIDATION FAILURE 🚨")
        logger.critical("=" * 80)
        logger.critical(message)
        logger.critical("=" * 80)
        logger.critical("PROCESS TERMINATED - DEVELOPER INTERVENTION REQUIRED")
        logger.critical("=" * 80)
        
        # Also print to stderr for immediate visibility
        print("\n" + "=" * 80, file=sys.stderr)
        print("🚨 CRITICAL TOKEN VALIDATION FAILURE 🚨", file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print(message, file=sys.stderr)
        print("=" * 80, file=sys.stderr)
        print("PROCESS TERMINATED - DEVELOPER INTERVENTION REQUIRED", file=sys.stderr)
        print("=" * 80 + "\n", file=sys.stderr)
        
        # Raise exception to terminate
        raise TokenValidationError(message)


def validate_tokens_before_operation(operation_name: str = "operation") -> None:
    """
    Convenience function to validate tokens before any major operation.
    
    Args:
        operation_name: Name of the operation for logging context
        
    Raises:
        TokenValidationError: If validation fails (terminates process)
    """
    logger.info(f"🔍 Validating token configuration before {operation_name}...")
    
    validator = TokenValidator()
    validator.validate_all_tokens()
    
    logger.info(f"✅ Token validation passed - proceeding with {operation_name}")