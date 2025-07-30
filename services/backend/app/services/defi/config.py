"""Configuration for DeFi integrations."""

import os
import json
from typing import Optional, Dict
from ...settings import logger

# API Base URLs
SAUCERSWAP_BASE_URL = "https://api.saucerswap.finance"
SAUCERSWAP_TESTNET_URL = "https://test-api.saucerswap.finance"
BONZO_BASE_URL = "https://data.bonzo.finance"
HEDERA_MIRROR_URL = "https://mainnet-public.mirrornode.hedera.com/api/v1"

# Rate limiting configuration
import os

# Use test-friendly settings when in test mode
if os.getenv('DEFI_TEST_MODE') == 'true':
    MAX_RETRIES = 2
    BACKOFF_FACTOR = 1.5
    REQUEST_TIMEOUT = 5  # 5 seconds for tests
    RATE_LIMIT_SLEEP = 0.01  # 10ms between requests for tests
else:
    MAX_RETRIES = 5
    BACKOFF_FACTOR = 2
    REQUEST_TIMEOUT = 30
    RATE_LIMIT_SLEEP = 0.1  # 100ms between requests

# Risk thresholds for analysis
LOW_LIQUIDITY_THRESHOLD_USD = 1000.0
HIGH_UTILIZATION_THRESHOLD = 90.0
UNHEALTHY_HF_THRESHOLD = 1.2

# Default headers
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "OriginsDefi/1.0.0"
}

def load_api_keys() -> Dict[str, Optional[str]]:
    """Load API keys from environment variables (secure) or fallback to appSettings.json."""
    # Try environment variables first (secure approach)
    env_keys = {
        'saucerswap': os.getenv('SAUCER_SWAP_API_KEY'),
        'openai': os.getenv('OPENAI_API_KEY'),
        'walletconnect': os.getenv('WALLETCONNECT_PROJECT_ID')
    }
    
    # Filter out placeholder/invalid values
    def is_valid_key(key: Optional[str]) -> bool:
        if not key:
            return False
        # Check for common placeholder patterns
        placeholders = [
            'your-saucerswap-api-key-here',
            'your-openai-api-key-here', 
            'sk-proj-your-openai-api-key-here',
            'sk-proj-placeholder-replace-with-real-key'
        ]
        return key not in placeholders and not key.startswith('your-') and not key.startswith('placeholder')
    
    # Clean environment keys - set invalid ones to None
    cleaned_env_keys = {
        'saucerswap': env_keys['saucerswap'] if is_valid_key(env_keys['saucerswap']) else None,
        'openai': env_keys['openai'] if is_valid_key(env_keys['openai']) else None,
        'walletconnect': env_keys['walletconnect'] if is_valid_key(env_keys['walletconnect']) else None
    }
    
    # Log what we found and warn about placeholders
    if env_keys['saucerswap'] and not cleaned_env_keys['saucerswap']:
        logger.warning("SaucerSwap API key found but appears to be placeholder - replace with real key in .env")
    if env_keys['openai'] and not cleaned_env_keys['openai']:
        logger.warning("OpenAI API key found but appears to be placeholder - replace with real key in .env")
    
    # If we have any environment variables (even if some are placeholders), use the cleaned version
    if any(env_keys.values()):
        valid_keys = [k for k, v in cleaned_env_keys.items() if v]
        if valid_keys:
            logger.info(f"Loading API keys from environment variables (secure): {valid_keys}")
        else:
            logger.warning("Environment variables found but all appear to be placeholders")
        return cleaned_env_keys
    
    # Fallback to appSettings.json for backward compatibility
    try:
        logger.warning("Environment variables not found, falling back to appSettings.json (less secure)")
        # Navigate to frontend directory from backend/app/services/defi/
        app_settings_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "appSettings.json"
        )
        app_settings_path = os.path.abspath(app_settings_path)
        
        if not os.path.exists(app_settings_path):
            logger.warning(f"App settings file not found at: {app_settings_path}")
            return env_keys  # Return env_keys (even if None values)
            
        with open(app_settings_path, 'r') as f:
            settings = json.load(f)
            
        return {
            'saucerswap': env_keys['saucerswap'] or settings.get('SAUCER_SWAP_API_KEY'),
            'openai': env_keys['openai'] or settings.get('OPENAI_API_KEY'),
            'walletconnect': env_keys['walletconnect'] or settings.get('WALLETCONNECT_PROJECT_ID')
        }
    except Exception as e:
        logger.error(f"Failed to load API keys from both environment and settings file: {e}")
        return env_keys  # Return env_keys (even if None values)

# Load API keys at module import
API_KEYS = load_api_keys()

# DEBUG: Print loaded API keys
print("🔍 DEBUG - DeFi Config API Keys Loaded:")
print(f"API_KEYS: {API_KEYS}")
print("=" * 50)