"""Configuration management for token holdings system."""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional

# Base paths
PROJECT_ROOT = Path(__file__).parent.parent
TOKENS_CONFIG_PATH = PROJECT_ROOT / "../../tokens_enabled.json"
APP_SETTINGS_PATH = PROJECT_ROOT / "../../../frontend/appSettings.json"
TEMP_DATA_DIR = PROJECT_ROOT / "temp_data"

# API Configuration
HEDERA_BASE_URL = "https://mainnet-public.mirrornode.hedera.com/api/v1"
HEDERA_ACCOUNTS_ENDPOINT = f"{HEDERA_BASE_URL}/accounts"
HEDERA_TOKENS_ENDPOINT = f"{HEDERA_BASE_URL}/tokens"

# Rate limiting (be conservative to avoid 429s)
REQUESTS_PER_SECOND = 25  # Hedera allows 50, but we'll be safe
RATE_LIMIT_SLEEP = 1.0 / REQUESTS_PER_SECOND

# Request configuration
MAX_PAGE_SIZE = 100
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3
BACKOFF_FACTOR = 2

# Progress reporting
PROGRESS_REPORT_INTERVAL = 10  # Report every N requests

def load_tokens_config() -> Dict[str, str]:
    """Load enabled tokens from configuration file."""
    try:
        with open(TOKENS_CONFIG_PATH, 'r') as f:
            config = json.load(f)
            return config.get('tokens_enabled', {})
    except FileNotFoundError:
        print(f"Warning: Tokens config file not found at {TOKENS_CONFIG_PATH}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing tokens config: {e}")
        return {}

def load_app_settings() -> Dict[str, str]:
    """Load application settings including API keys."""
    try:
        with open(APP_SETTINGS_PATH, 'r') as f:
            settings = json.load(f)
            return settings
    except FileNotFoundError:
        print(f"Warning: App settings file not found at {APP_SETTINGS_PATH}")
        return {}
    except json.JSONDecodeError as e:
        print(f"Error parsing app settings: {e}")
        return {}

def get_saucerswap_api_key() -> Optional[str]:
    """Get SaucerSwap API key from app settings."""
    settings = load_app_settings()
    api_key = settings.get('SAUCER_SWAP_API_KEY')
    if not api_key or api_key == "___":
        print("Warning: SAUCER_SWAP_API_KEY not found or not set in app settings")
        return None
    return api_key

def ensure_temp_dir():
    """Ensure temp data directory exists."""
    TEMP_DATA_DIR.mkdir(exist_ok=True)
    return TEMP_DATA_DIR

# Headers for API requests
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "TokenHoldingsTracker/1.0"
}

# Balance thresholds (in tinybars for HBAR, in smallest unit for tokens)
MIN_BALANCE_THRESHOLDS = {
    "HBAR": 100000000,  # 1 HBAR in tinybars
    "SAUCE": 1000000,   # 1 SAUCE (adjust based on decimals)
    "KARATE": 1000000,  # 1 KARATE (adjust based on decimals)
} 