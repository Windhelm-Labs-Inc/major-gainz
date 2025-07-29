# Token Holdings Tracker

Track token holder statistics for HBAR, SAUCE, and KARATE tokens on Hedera network.

## Quick Start

```bash
# Setup virtual environment and install dependencies
make setup

# Initialize database
make init

# Run a quick test
make test
```

## Commands

- `make setup` - Setup project with Poetry and venv
- `make init` - Initialize database  
- `make refresh` - Refresh all token data
- `make refresh-interactive` - Interactive mode (prompts for old data)
- `make status` - Check token status
- `make test` - Run pytest tests
- `make system-test` - Run system integration test

## Poetry Commands

```bash
# Activate virtual environment
poetry shell

# Run CLI directly
poetry run python -m src.cli --help
```

## Interactive Mode

The system includes an intelligent interactive mode that checks data age and prompts for updates:

```bash
# Interactive mode - prompts for tokens older than 24 hours
poetry run python -m src.cli refresh --interactive

# Or using make
make refresh-interactive
```

Interactive mode will:
- ✅ Check the age of each token's data
- 📊 Display a status table with refresh recommendations  
- 🤔 Prompt you for each token older than 24 hours
- 📋 Collect your choices and confirm before proceeding
- 🚀 Batch update all selected tokens
- 📈 Provide comprehensive summary

## USD Filtering & Pricing

The system integrates with [SaucerSwap API](https://docs.saucerswap.finance/v/developer/rest-api/) to provide USD-based filtering:

```bash
# Filter holders with minimum $10 USD value
poetry run python -m src.cli refresh --token SAUCE --min-usd 10

# Disable USD features entirely
poetry run python -m src.cli refresh --disable-usd
```

**Features:**
- 💰 **Real-time Pricing**: Fetches current USD prices from SaucerSwap
- 🔍 **USD Filtering**: Filter holders by USD value of their holdings
- 📊 **Price Storage**: Stores historical price data for analysis
- ⚡ **Smart Caching**: 5-minute price cache to minimize API calls
- 🛡️ **Rate Limiting**: Respects SaucerSwap API rate limits

## Development

```bash
make install-dev  # Install with dev dependencies
make format       # Format code with Black
make lint         # Lint with Flake8
make type-check   # Type checking with MyPy
```
