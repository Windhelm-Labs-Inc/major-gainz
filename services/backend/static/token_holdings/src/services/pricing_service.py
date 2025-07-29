"""SaucerSwap pricing service for token price data."""

import requests
import time
from abc import ABC, abstractmethod
from typing import Dict, Optional, List
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
import logging

from ..config import DEFAULT_HEADERS, REQUEST_TIMEOUT, MAX_RETRIES, BACKOFF_FACTOR

logger = logging.getLogger(__name__)


class PricingServiceInterface(ABC):
    """Interface for pricing services following Interface Segregation Principle."""
    
    @abstractmethod
    def get_token_price_usd(self, token_id: str) -> Optional[Decimal]:
        """Get USD price for a token."""
        pass
    
    @abstractmethod
    def get_tokens_for_usd_amount(self, token_id: str, usd_amount: Decimal) -> Optional[Decimal]:
        """Get number of tokens equivalent to USD amount."""
        pass
    
    @abstractmethod
    def refresh_price_cache(self) -> bool:
        """Refresh cached price data."""
        pass


class SaucerSwapPricingService(PricingServiceInterface):
    """SaucerSwap API integration for token pricing."""
    
    def __init__(self, api_key: str, base_url: str = "https://api.saucerswap.finance"):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            **DEFAULT_HEADERS,
            "x-api-key": api_key
        })
        
        # Cache for price data to minimize API calls
        self._price_cache: Dict[str, Dict] = {}
        self._cache_expiry = timedelta(minutes=5)  # Cache for 5 minutes
        self._last_cache_update: Optional[datetime] = None
    
    def _is_cache_valid(self) -> bool:
        """Check if price cache is still valid."""
        if not self._last_cache_update:
            return False
        return datetime.utcnow() - self._last_cache_update < self._cache_expiry
    
    def _make_request(self, endpoint: str) -> Optional[Dict]:
        """Make authenticated request to SaucerSwap API with retry logic."""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        for attempt in range(MAX_RETRIES):
            try:
                response = self.session.get(url, timeout=REQUEST_TIMEOUT)
                
                if response.status_code == 429:
                    # Rate limiting - check retry headers
                    retry_after = int(response.headers.get("Retry-After", BACKOFF_FACTOR ** attempt))
                    logger.warning(f"SaucerSwap rate limited. Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                
                response.raise_for_status()
                
                # Log rate limit info for monitoring
                remaining = response.headers.get("x-ratelimit-remaining")
                if remaining:
                    logger.debug(f"SaucerSwap API calls remaining: {remaining}")
                
                return response.json()
                
            except requests.RequestException as e:
                wait_time = BACKOFF_FACTOR ** attempt
                logger.warning(f"SaucerSwap API request failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(wait_time)
                else:
                    logger.error(f"SaucerSwap API request failed after {MAX_RETRIES} attempts")
                    return None
        
        return None
    
    def refresh_price_cache(self) -> bool:
        """Refresh cached price data from SaucerSwap API."""
        try:
            logger.info("Refreshing SaucerSwap price cache...")
            tokens_data = self._make_request("/tokens")
            
            if not tokens_data:
                logger.error("Failed to fetch tokens data from SaucerSwap")
                return False
            
            # Validate response format
            if not isinstance(tokens_data, list):
                logger.error(f"Unexpected response format from SaucerSwap: expected list, got {type(tokens_data)}")
                return False
            
            # Update cache
            self._price_cache = {}
            successful_updates = 0
            
            for token in tokens_data:
                try:
                    if not isinstance(token, dict):
                        logger.warning(f"Skipping invalid token data: {token}")
                        continue
                    
                    token_id = token.get("id", "").strip()
                    if not token_id:
                        logger.warning("Skipping token with missing ID")
                        continue
                    
                    # Validate price data
                    price_usd_str = token.get("priceUsd", "0")
                    try:
                        price_usd = Decimal(str(price_usd_str))
                        if price_usd < 0:
                            logger.warning(f"Negative price for token {token_id}: {price_usd}")
                            price_usd = Decimal("0")
                    except (ValueError, TypeError, InvalidOperation) as e:
                        logger.warning(f"Invalid price data for token {token_id}: {price_usd_str} - {e}")
                        price_usd = Decimal("0")
                    
                    # Validate decimals
                    decimals = token.get("decimals", 0)
                    try:
                        decimals = int(decimals)
                        if decimals < 0 or decimals > 50:  # Reasonable bounds
                            logger.warning(f"Unusual decimals value for token {token_id}: {decimals}")
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid decimals for token {token_id}: {e}")
                        decimals = 0
                    
                    self._price_cache[token_id] = {
                        "symbol": token.get("symbol", ""),
                        "decimals": decimals,
                        "price_usd": price_usd,
                        "updated_at": datetime.utcnow()
                    }
                    successful_updates += 1
                    
                except Exception as e:
                    logger.warning(f"Error processing token data {token}: {e}")
                    continue
            
            self._last_cache_update = datetime.utcnow()
            logger.info(f"Price cache updated with {successful_updates}/{len(tokens_data)} tokens")
            return successful_updates > 0
            
        except (requests.RequestException, ConnectionError, TimeoutError) as e:
            logger.error(f"Network error refreshing price cache: {e}")
            return False
        except (ValueError, TypeError) as e:
            logger.error(f"Data validation error refreshing price cache: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error refreshing price cache: {e}")
            return False
    
    def get_token_price_usd(self, token_id: str) -> Optional[Decimal]:
        """Get USD price for a token."""
        if not self._is_cache_valid():
            if not self.refresh_price_cache():
                return None
        
        token_data = self._price_cache.get(token_id)
        if token_data:
            return token_data["price_usd"]
        
        logger.warning(f"Token {token_id} not found in SaucerSwap price data")
        return None
    
    def get_tokens_for_usd_amount(self, token_id: str, usd_amount: Decimal) -> Optional[Decimal]:
        """Get number of tokens equivalent to USD amount."""
        price_usd = self.get_token_price_usd(token_id)
        
        if not price_usd or price_usd == 0:
            logger.warning(f"No valid price found for token {token_id}")
            return None
        
        try:
            token_amount = usd_amount / price_usd
            return token_amount
        except (ValueError, ZeroDivisionError) as e:
            logger.error(f"Error calculating token amount for {token_id}: {e}")
            return None
    
    def get_token_info(self, token_id: str) -> Optional[Dict]:
        """Get complete token information including price data."""
        if not self._is_cache_valid():
            if not self.refresh_price_cache():
                return None
        
        return self._price_cache.get(token_id)
    
    def get_supported_tokens(self) -> List[str]:
        """Get list of token IDs supported by SaucerSwap."""
        if not self._is_cache_valid():
            if not self.refresh_price_cache():
                return []
        
        return list(self._price_cache.keys())