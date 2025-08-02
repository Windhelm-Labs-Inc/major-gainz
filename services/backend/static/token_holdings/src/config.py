"""Configuration management for token holdings system."""

import os
import json
from typing import Dict, Optional

# --- Path Configuration ---
# Build paths relative to the project root to ensure consistency
# __file__ -> src/config.py
# os.path.dirname(__file__) -> src/
# os.path.dirname(os.path.dirname(__file__)) -> project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))

DB_PATH = os.path.join(PROJECT_ROOT, 'token_holdings.db')
TEMP_DATA_PATH = os.path.join(PROJECT_ROOT, 'temp_data')

# Path for the externally managed tokens_enabled.json file
# This should resolve to ../../tokens_enabled.json from the project root
TOKENS_CONFIG_PATH = os.path.abspath(os.path.join(PROJECT_ROOT, '..', '..', 'tokens_enabled.json'))

# Path for the dynamically populated token_decimals.json file
DECIMALS_CONFIG_PATH = os.path.join(PROJECT_ROOT, 'src', 'token_decimals.json')

# Path for the external app settings with API keys
APP_SETTINGS_PATH = os.path.join(PROJECT_ROOT, '..', '..', '..', 'frontend', 'appSettings.json')

# --- API & Rate Limiting Configuration ---
REQUESTS_PER_SECOND = 25
RATE_LIMIT_SLEEP = 1 / REQUESTS_PER_SECOND  # 40ms sleep between requests
MAX_PAGE_SIZE = 100
REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 5
BACKOFF_FACTOR = 2

# --- Hedera Mirror Node Endpoints ---
HEDERA_BASE_URL = "https://mainnet-public.mirrornode.hedera.com/api/v1"
HEDERA_ACCOUNTS_ENDPOINT = f"{HEDERA_BASE_URL}/accounts"
HEDERA_TOKENS_ENDPOINT = f"{HEDERA_BASE_URL}/tokens"

# --- Balance Thresholds ---
# Minimum balance to be included in the results
MIN_BALANCE_THRESHOLDS = {
    "HBAR": 1_000_000_000,  # 10 HBAR
    "SAUCE": 1,
    "KARATE": 1
}

# --- Progress Reporting ---
PROGRESS_REPORT_INTERVAL = 20  # Print progress every 20 API requests

# --- Default Headers ---
DEFAULT_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "TokenHoldingsTracker/1.0.0"
}

# --- Configuration Loading Functions ---

def load_config_from_json(path: str) -> Dict:
    """Load configuration from a JSON file with robust error handling."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️  Warning: Could not read or parse config file at {path}: {e}")
        return {}

def save_config_to_json(path: str, data: Dict) -> None:
    """Save configuration data to a JSON file."""
    try:
        with open(path, 'w') as f:
            json.dump(data, f, indent=4)
    except IOError as e:
        print(f"⚠️  Warning: Could not write to config file at {path}: {e}")

def load_tokens_config() -> Dict[str, str]:
    """Load the enabled tokens configuration."""
    config = load_config_from_json(TOKENS_CONFIG_PATH)
    return config.get("tokens_enabled", {})

def load_decimals_config() -> Dict[str, int]:
    """Load the token decimals configuration."""
    return load_config_from_json(DECIMALS_CONFIG_PATH)

def save_decimals_config(decimals_data: Dict[str, int]) -> None:
    """Save the token decimals configuration."""
    save_config_to_json(DECIMALS_CONFIG_PATH, decimals_data)

# Getting rid of old appSettings.json 
def get_saucerswap_api_key() -> str:
    """Retrieve the SaucerSwap API key from environment variables.

    Raises:
        ValueError: If the SAUCER_SWAP_API_KEY is not set in the environment.
    """
    api_key = os.getenv("SAUCER_SWAP_API_KEY")
    if not api_key:
        raise ValueError("SAUCER_SWAP_API_KEY environment variable not set.")
    return api_key


# We return the Path to enable easy path arithmetic with the `/` operator (Path.__truediv__).
from pathlib import Path

def ensure_temp_dir() -> Path:
    """Ensure the temp_data directory exists and return it as a Path object."""
    path_obj = Path(TEMP_DATA_PATH)
    path_obj.mkdir(parents=True, exist_ok=True)
    return path_obj 