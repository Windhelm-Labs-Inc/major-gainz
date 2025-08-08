from typing import Optional, Dict
import os
import logging
from logging.handlers import RotatingFileHandler

# Logging configuration
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

# Create logger
logger = logging.getLogger("origins")
logger.setLevel(logging.DEBUG)

# Create console handler with INFO level
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Create file handler with DEBUG level
log_file = os.path.join(LOG_DIR, "origins.log")
file_handler = RotatingFileHandler(
    log_file,
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=4,  # Keep 5 files total (1 current + 4 backups)
)
file_handler.setLevel(logging.DEBUG)

# Create formatters and add them to handlers
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
file_handler.setFormatter(formatter)

# Add handlers to logger
logger.addHandler(console_handler)
logger.addHandler(file_handler)

# ---- Token Configuration ------------------------------------------------------
# Tokens and decimals are loaded from JSON files so we avoid hard-coded mappings.
#   •  tokens_enabled.json  – symbol ➜ HTS token id
#   •  token_decimals.json  – symbol ➜ decimals
# This ensures a single source-of-truth across the backend.

from pathlib import Path
import json
from decimal import Decimal

ROOT_DIR = Path(__file__).resolve().parent
TOKENS_ENABLED_PATH = (ROOT_DIR / ".." / "tokens_enabled.json").resolve()
TOKEN_DECIMALS_PATH = (ROOT_DIR / "../static/token_holdings/src/token_decimals.json").resolve()

# Load enabled tokens
with open(TOKENS_ENABLED_PATH, "r", encoding="utf-8") as _f:
    _tokens_enabled_json = json.load(_f)

TOKENS_ENABLED: Dict[str, str] = _tokens_enabled_json.get("tokens_enabled", {})

# Look-up helpers
SYMBOL_TO_TOKEN_ID: Dict[str, str] = TOKENS_ENABLED
TOKEN_ID_TO_SYMBOL: Dict[str, str] = {tid: sym for sym, tid in SYMBOL_TO_TOKEN_ID.items()}

# Create case-insensitive lookup for tokens
def _create_case_insensitive_token_map() -> Dict[str, str]:
    """Create a case-insensitive token symbol to token ID mapping."""
    case_map = {}
    for symbol, token_id in TOKENS_ENABLED.items():
        # Add original case
        case_map[symbol] = token_id
        # Add uppercase version
        case_map[symbol.upper()] = token_id
        # Add lowercase version
        case_map[symbol.lower()] = token_id
    return case_map

CASE_INSENSITIVE_SYMBOL_TO_TOKEN_ID = _create_case_insensitive_token_map()

def get_token_id_for_symbol(symbol: str) -> str:
    """Get token ID for symbol with case-insensitive lookup."""
    # First try exact match
    if symbol in SYMBOL_TO_TOKEN_ID:
        return SYMBOL_TO_TOKEN_ID[symbol]
    
    # Try case-insensitive lookup
    if symbol in CASE_INSENSITIVE_SYMBOL_TO_TOKEN_ID:
        return CASE_INSENSITIVE_SYMBOL_TO_TOKEN_ID[symbol]
    
    # If not found, raise KeyError with helpful message
    raise KeyError(f"Token symbol '{symbol}' not found in supported tokens: {list(SYMBOL_TO_TOKEN_ID.keys())}")

def is_supported_symbol(symbol: str) -> bool:
    """Return True if the provided symbol is present in the enabled tokens map (case-insensitive)."""
    if symbol in SYMBOL_TO_TOKEN_ID:
        return True
    if symbol in CASE_INSENSITIVE_SYMBOL_TO_TOKEN_ID:
        return True
    return False

# Load decimals
try:
    with open(TOKEN_DECIMALS_PATH, "r", encoding="utf-8") as _f:
        TOKEN_DECIMALS: Dict[str, int] = json.load(_f)
except FileNotFoundError:
    TOKEN_DECIMALS = {}

DEFAULT_DECIMALS = 8

def get_decimals(symbol: str) -> int:
    """Return decimals for a token symbol, defaulting to 8."""
    return TOKEN_DECIMALS.get(symbol.upper(), DEFAULT_DECIMALS)

# Retain 3 months of data (~90 days)
DEFAULT_DAYS: int = 90

# CoinGecko API ID mappings for external price data
# Note: These are CoinGecko API IDs, not Hedera token IDs
HEDERA_TOKEN_IDS: Dict[str, str] = {
    "HBAR": "hedera-hashgraph",
    "USDC": "usd-coin",
    # Add more mappings as needed for CoinGecko integration
}

# ---- OpenAI Proxy Configuration ----------------------------------------------
# Environment variables for configuring the OpenAI API proxy with rate limiting
# and retry logic (see app/routers/chat.py):
#
# OPENAI_API_KEY                - Your OpenAI API key (required)
# OPENAI_PROXY_TIMEOUT         - Request timeout in seconds (default: 120)
# OPENAI_MAX_RETRIES           - Maximum retry attempts for rate limits (default: 5)
# OPENAI_BASE_DELAY            - Base delay for exponential backoff in seconds (default: 1.0)
# OPENAI_MAX_DELAY             - Maximum delay between retries in seconds (default: 60.0)
#
# Example .env configuration:
# OPENAI_API_KEY=sk-your-api-key-here
# OPENAI_PROXY_TIMEOUT=120
# OPENAI_MAX_RETRIES=5
# OPENAI_BASE_DELAY=1.0
# OPENAI_MAX_DELAY=60.0 