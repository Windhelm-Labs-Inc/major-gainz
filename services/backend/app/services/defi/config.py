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
    """Load API keys from appSettings.json."""
    try:
        # Navigate to frontend directory from backend/app/services/defi/
        app_settings_path = os.path.join(
            os.path.dirname(__file__), "..", "..", "..", "..", "frontend", "appSettings.json"
        )
        app_settings_path = os.path.abspath(app_settings_path)
        
        if not os.path.exists(app_settings_path):
            logger.warning(f"App settings file not found at: {app_settings_path}")
            return {}
            
        with open(app_settings_path, 'r') as f:
            settings = json.load(f)
            
        return {
            'saucerswap': settings.get('SAUCER_SWAP_API_KEY'),
            'openai': settings.get('OPENAI_API_KEY'),
            'walletconnect': settings.get('WALLETCONNECT_PROJECT_ID')
        }
    except Exception as e:
        logger.error(f"Failed to load API keys: {e}")
        return {}

# Load API keys at module import
API_KEYS = load_api_keys()