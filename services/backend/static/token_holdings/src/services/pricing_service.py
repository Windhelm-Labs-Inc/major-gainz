"""SaucerSwap pricing service for token price data."""

import requests
import time
from abc import ABC, abstractmethod
from typing import Dict, Optional, List
from decimal import Decimal, InvalidOperation
from datetime import datetime, timedelta
import logging
import json

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

    def _is_valid_token_data(self, token_data: dict) -> bool:
        """Validates the structure and content of a single token data dictionary."""
        if not isinstance(token_data, dict):
            logger.warning(f"Invalid data type for token entry: {type(token_data)}")
            return False
        
        token_id = token_data.get("id")
        if not token_id or not isinstance(token_id, str):
            logger.warning(f"Token data missing or invalid 'id': {token_data}")
            return False
            
        price_usd_str = token_data.get("priceUsd")
        if price_usd_str is None:
            logger.warning(f"Token {token_id} missing 'priceUsd' field.")
            return False
        
        try:
            price_usd = Decimal(str(price_usd_str))
            if price_usd < 0:
                logger.warning(f"Token {token_id} has negative price: {price_usd}")
                return False
        except (ValueError, TypeError, InvalidOperation):
            logger.warning(f"Token {token_id} has invalid price format: {price_usd_str}")
            return False
            
        decimals = token_data.get("decimals")
        if decimals is None:
            logger.warning(f"Token {token_id} missing 'decimals' field.")
            return False
        
        try:
            int_decimals = int(decimals)
            if not (0 <= int_decimals <= 50): # Reasonable bounds for decimals
                logger.warning(f"Token {token_id} has unusual decimals value: {decimals}")
        except (ValueError, TypeError):
            logger.warning(f"Token {token_id} has invalid decimals format: {decimals}")
            return False
            
        return True

    def refresh_price_cache(self) -> bool:
        """
        Refreshes the in-memory token price cache from the SaucerSwap API.
        
        Returns:
            True if refresh was successful, False otherwise.
        """
        logger.info("Refreshing SaucerSwap price cache...")
        
        try:
            response = self._make_request("/tokens")
            if response:
                # Validate response structure
                if not isinstance(response, list):
                    logger.error(f"SaucerSwap API returned unexpected format: {type(response)}")
                    return False
                
                new_cache = {}
                for item in response:
                    token_data = None
                    try:
                        # The API might return a list of JSON strings instead of objects
                        if isinstance(item, str):
                            token_data = json.loads(item)
                        elif isinstance(item, dict):
                            token_data = item
                        else:
                            logger.warning(f"Skipping unexpected item type in SaucerSwap response: {type(item)}")
                            continue
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to decode JSON string from SaucerSwap response: {item}")
                        continue
                        
                    if not self._is_valid_token_data(token_data):
                        continue # Skip invalid token entries
                    
                    token_id = token_data.get('id')
                    price_usd_str = token_data.get("priceUsd", "0")
                    
                    try:
                        price_usd = Decimal(str(price_usd_str))
                    except (InvalidOperation, ValueError, TypeError):
                        price_usd = Decimal("0")
                    
                    token_data['price_usd'] = price_usd

                    if token_id:
                        new_cache[token_id] = token_data
                
                if not new_cache:
                    logger.warning("SaucerSwap API returned a list, but it contained no valid token data.")
                    # Don't overwrite existing cache if the new one is empty but the old one wasn't
                    return False if self._price_cache else True

                self._price_cache = new_cache
                self._last_cache_update = datetime.utcnow()
                logger.info(f"Successfully refreshed SaucerSwap price cache with {len(self._price_cache)} tokens.")
                return True
            else:
                logger.error("Failed to refresh SaucerSwap price cache - no response from API.")
                return False
        except Exception as e:
            logger.error(f"Error refreshing SaucerSwap price cache: {e}", exc_info=True)
            return False
    
    def get_token_price_usd(self, token_id: str) -> Optional[Decimal]:
        """
        Get USD price for a token.
        
        Handles HBAR (0.0.0) separately by querying the Hedera exchange rate API.
        """
        # Special handling for HBAR
        if token_id == '0.0.0':
            return self.get_hbar_price_usd()

        if not self._is_cache_valid():
            if not self.refresh_price_cache():
                return None
        
        token_data = self._price_cache.get(token_id)
        if token_data and 'price_usd' in token_data:
            return token_data["price_usd"]
        
        logger.warning(f"Token {token_id} not found in SaucerSwap price data")
        return None

    def get_hbar_price_usd(self) -> Optional[Decimal]:
        """Fetches HBAR to USD exchange rate using Hedera's official sources with fallbacks."""
        
        # Method 1: Try Hedera Mirror Node Exchange Rate API
        logger.info("Fetching HBAR price from Hedera Mirror Node exchange rate API...")
        try:
            response = requests.get(
                "https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate",
                headers=DEFAULT_HEADERS,
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
            
            # Debug log the full response structure for troubleshooting
            logger.debug(f"Mirror Node exchange rate response: {data}")

            current_rate = data.get('current_rate')
            if not current_rate:
                logger.error(f"Missing 'current_rate' field. Available fields: {list(data.keys())}")
                available_rates = [k for k in data.keys() if 'rate' in k.lower()]
                if available_rates:
                    logger.info(f"Available rate fields: {available_rates}")
            else:
                hbar_equiv = current_rate.get('hbar_equivalent')
                cent_equiv = current_rate.get('cent_equivalent')
                expiration_time = current_rate.get('expiration_time')
                
                # Enhanced validation with detailed logging
                if hbar_equiv is None or cent_equiv is None:
                    logger.error(f"Missing rate fields: hbar_equivalent={hbar_equiv}, cent_equivalent={cent_equiv}")
                    logger.error(f"Available current_rate fields: {list(current_rate.keys())}")
                elif hbar_equiv <= 0:
                    logger.error(f"Invalid hbar_equivalent value: {hbar_equiv}")
                else:
                    try:
                        # Correct formula: 1 HBAR = cent_equivalent / (100 * hbar_equivalent)
                        # cent_equivalent is in "cents", hbar_equivalent is the amount of HBAR
                        price_usd = Decimal(cent_equiv) / (Decimal(100) * Decimal(hbar_equiv))
                        logger.info(f"Successfully fetched HBAR price from Mirror Node: ${price_usd:.6f}")
                        logger.debug(f"Rate details: {hbar_equiv} HBAR = {cent_equiv} cents, expires: {expiration_time}")
                        return price_usd
                    except (InvalidOperation, ZeroDivisionError) as calc_error:
                        logger.error(f"Error calculating HBAR price from Mirror Node: {calc_error}")

        except Exception as e:
            logger.warning(f"Mirror Node exchange rate API failed: {e}")

        # Method 2: Fallback to CoinGecko API
        logger.info("Falling back to CoinGecko API for HBAR price...")
        try:
            response = requests.get(
                "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd",
                headers=DEFAULT_HEADERS,
                timeout=REQUEST_TIMEOUT
            )
            response.raise_for_status()
            data = response.json()
            
            hbar_price = data.get('hedera-hashgraph', {}).get('usd')
            if hbar_price:
                price_usd = Decimal(str(hbar_price))
                logger.info(f"Successfully fetched HBAR price from CoinGecko: ${price_usd:.6f}")
                return price_usd
            else:
                logger.error("CoinGecko API did not return HBAR price")
                
        except Exception as e:
            logger.warning(f"CoinGecko API also failed: {e}")

        # Method 3: Use a reasonable fallback price (current market price around $0.20)
        fallback_price = Decimal("0.20")
        logger.warning(f"All price sources failed, using fallback HBAR price: ${fallback_price}")
        return fallback_price
    
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
    
    def get_supported_tokens(self) -> List[Dict]:
        """Get list of token objects supported by SaucerSwap."""
        if not self._is_cache_valid():
            if not self.refresh_price_cache():
                return []
        
        return list(self._price_cache.values())