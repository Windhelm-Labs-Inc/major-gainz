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
    maxBytes=1024 * 1024,  # 1MB
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

# Mapping from token symbol to CoinGecko API ID (slug).
# These IDs are required for CoinGecko API requests like /coins/{id}/ohlc and /coins/{id}/market_chart
# The keys are the Hedera token symbols we use internally, values are CoinGecko's API identifiers
HEDERA_TOKEN_IDS: Dict[str, str] = {
    "HBAR": "hedera-hashgraph",  # Native token
    "USDC": "usd-coin",
    "USDT": "tether",
    "SAUCE": "saucerswap",
    "DOVU": "dovu-2",
    "PACK": "hashpack",
    "XPACK": "xpack",
    "KARATE": "karate-combat",
    "JAM": "tune-fm",
    "HGG": "hedera-guild-game",
    "HST": "headstarter",
}

HEDERA_SYMBOL_TOKEN_LOOKUP_ADDRESSES = {
    "HBAR": None,                        # Native token
    "USDC": "0.0.456858",                # Name: USD Coin, Symbol: USDC
    "USDT": "0.0.1084269",               # Name: ssLP-USD Coin-HeadStarter, Symbol: ssLP-USDC-HST
    "SAUCE": "0.0.1456986",              # Name: Wrapped Hbar, Symbol: WHBAR
    "PACK": "0.0.4794920",               # Name: PACK, Symbol: PACK
    "XPACK": "0.0.7243470",             # Name: xPACK, Symbol: xPACK
    "DOVU": "0.0.3716059",               # Name: Dovu, Symbol: DOVU
    "KARATE": "0.0.1159074",             # Name: GRELF, Symbol: GRELF (Karate’s HTS token wrapper)
    "JAM": "0.0.127877",                 # Name: Tune.FM, Symbol: JAM
    "HGG": "0.0.6722561",                # Name: Hedera Guild Game, Symbol: HGG
    "HST": "0.0.968069",                 # Name: HeadStarter, Symbol: HST
}

# Convenience reverse lookup: HTS token ID -> Symbol
HEDERA_TOKEN_ADDRESS_TO_SYMBOL: Dict[str, str] = {
    token_id: symbol for symbol, token_id in HEDERA_SYMBOL_TOKEN_LOOKUP_ADDRESSES.items() if token_id
}

DEFAULT_DAYS: int = 14 