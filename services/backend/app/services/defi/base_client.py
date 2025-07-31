"""Base client for DeFi API integrations with rate limiting and error handling."""

import time
import requests
from typing import Optional, Dict, Any
from abc import ABC, abstractmethod

from ...settings import logger
from .config import MAX_RETRIES, BACKOFF_FACTOR, REQUEST_TIMEOUT, RATE_LIMIT_SLEEP, DEFAULT_HEADERS


class DeFiAPIError(Exception):
    """Base exception for DeFi API errors."""
    pass


class RateLimitError(DeFiAPIError):
    """Rate limit exceeded error."""
    pass


class ServiceUnavailableError(DeFiAPIError):
    """Service temporarily unavailable error."""
    pass


class BaseAPIClient(ABC):
    """Base class for DeFi API clients with common rate limiting and error handling."""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """Initialize the API client.
        
        Args:
            base_url: Base URL for the API
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        
        if api_key:
            self.session.headers.update({"x-api-key": api_key})
            
        self.request_count = 0
        self.last_request_time = 0
        
    def _make_request_with_retry(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make HTTP request with retry logic and rate limiting.
        
        Args:
            endpoint: API endpoint (will be appended to base_url)
            params: Optional query parameters
            
        Returns:
            JSON response data or None if request failed
            
        Raises:
            RateLimitError: If rate limit exceeded after retries
            ServiceUnavailableError: If service is unavailable
            DeFiAPIError: For other API errors
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        self.request_count += 1
        
        # Rate limiting - ensure minimum time between requests
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        if time_since_last < RATE_LIMIT_SLEEP:
            time.sleep(RATE_LIMIT_SLEEP - time_since_last)
        
        for attempt in range(MAX_RETRIES):
            try:
                logger.debug(f"Making request to {url} (attempt {attempt + 1}/{MAX_RETRIES})")
                
                response = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
                self.last_request_time = time.time()
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", BACKOFF_FACTOR ** attempt))
                    logger.warning(f"Rate limited by {self.__class__.__name__}. Waiting {retry_after}s...")
                    
                    if attempt == MAX_RETRIES - 1:
                        raise RateLimitError(f"Rate limit exceeded after {MAX_RETRIES} attempts")
                    
                    time.sleep(retry_after)
                    continue
                
                # Handle service unavailable
                if response.status_code == 503:
                    wait_time = BACKOFF_FACTOR ** attempt
                    logger.warning(f"Service unavailable (503). Waiting {wait_time}s...")
                    
                    if attempt == MAX_RETRIES - 1:
                        raise ServiceUnavailableError("Service unavailable after retries")
                    
                    time.sleep(wait_time)
                    continue
                
                # Handle not found
                if response.status_code == 404:
                    logger.warning(f"Resource not found (404) for URL: {url}")
                    return None
                
                # Raise for other HTTP errors
                response.raise_for_status()
                
                # Log rate limit info if available
                remaining = response.headers.get("x-ratelimit-remaining")
                if remaining:
                    logger.debug(f"{self.__class__.__name__} API calls remaining: {remaining}")
                
                return response.json()
                
            except requests.RequestException as e:
                wait_time = BACKOFF_FACTOR ** attempt
                logger.warning(f"{self.__class__.__name__} request failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                
                if attempt < MAX_RETRIES - 1:
                    logger.debug(f"Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"{self.__class__.__name__} request failed after {MAX_RETRIES} attempts")
                    raise DeFiAPIError(f"Network error after {MAX_RETRIES} attempts: {e}")
        
        return None
    
    @abstractmethod
    def health_check(self) -> bool:
        """Check if the API service is healthy."""
        pass
    
    def get_request_count(self) -> int:
        """Get the total number of requests made by this client."""
        return self.request_count