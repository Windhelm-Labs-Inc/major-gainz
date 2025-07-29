# 🪙 Token Holdings Analytics Engine

> A professional-grade, command-line tool for deep analysis of token holder distributions on the Hedera Hashgraph network.

This system provides a powerful toolkit for developers, analysts, and researchers to track, analyze, and export detailed statistics about token holder distributions. It identifies top holders, calculates percentile rankings, and provides USD-valued filtering for comprehensive market analysis.

![Data Flow Diagram](https://i.imgur.com/example.png)  <!-- Replace with actual diagram URL later -->

## ✨ Key Features

- **Comprehensive Holder Analysis**: Fetches complete holder lists for any HTS token.
- **Top Holder & Percentile Tracking**: Automatically calculates the top 10 holders and 99 percentile levels.
- **Real-Time USD Valuation**: Integrates with the SaucerSwap API to provide USD values for all holdings.
- **Advanced Filtering**: Focus your analysis by filtering holders by minimum USD value.
- **Robust & Resilient**: Built-in rate limiting, exponential backoff, and atomic database transactions.
- **Automated Workflows**: `Makefile` commands for common tasks like full database builds and interactive updates.
- **Data Export**: Generates timestamped CSV files for external analysis, with SHA-256 hashes for integrity.
- **Smart Interactive Mode**: Checks data freshness and intelligently prompts to update only stale tokens.

---

## 🚀 Quick Start

Get up and running in three commands.

**Prerequisites**: Python 3.9+, Poetry

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd token_holdings

# 2. Install dependencies and initialize the database
make install

# 3. Run a full production build
# This fetches all holders for enabled tokens with a $1 min USD filter
make production
```

After these steps, your database will be populated, and initial CSV exports will be available in the `temp_data/` directory.

---

## Workflow & Usage

### Daily Monitoring (Interactive Mode)

For regular checks, the interactive mode is the most efficient workflow. It only updates data that is more than 24 hours old.

```bash
make interactive
```

The system will:
1.  Check the age of the data for each token.
2.  Present a table showing which tokens are stale.
3.  Prompt you to select which stale tokens to refresh.
4.  Execute the refresh and export the new data.

### Deep Analysis (Production Mode)

For comprehensive, weekly, or ad-hoc analysis, use the production command.

```bash
make production
```

This command runs a full data refresh for all configured tokens with default production settings:
- **Max Accounts**: Unlimited
- **Min USD Value**: $1.00
- **CSV Export**: Enabled

### Custom Analysis (Direct CLI Usage)

For more granular control, you can use the `cli.py` script directly.

```bash
# Refresh a specific token with a $500 minimum USD value
poetry run python -m src.cli refresh --token SAUCE --min-usd 500 --export-csv

# Get the top 5,000 holders for HBAR, without any USD filtering
poetry run python -m src.cli refresh --token HBAR --max-accounts 5000 --disable-usd

# Just export the current database state to CSV without refreshing data
make export

# See all available commands and options
poetry run python -m src.cli --help
```

---

## ⚙️ Configuration

The system is configured via two external JSON files.

1.  **Enabled Tokens (`tokens_enabled.json`)**
    This file, located externally, defines which tokens the system should track.

    ```json
    {
      "tokens_enabled": {
        "HBAR": "0.0.0",
        "SAUCE": "0.0.731861", 
        "KARATE": "0.0.2283230"
      }
    }
    ```

2.  **API Key (`appSettings.json`)**
    To enable USD price features, add your SaucerSwap API key to this file, located at `../../../frontend/appSettings.json`.

    ```json
    {
      "SAUCER_SWAP_API_KEY": "your_api_key_here"
    }
    ```
    > **Note**: If the API key is missing, USD-related features will be automatically and gracefully disabled.

---

## 📁 Data Outputs

### CSV Exports

All CSV files are saved to the `temp_data/` directory with a timestamp and a corresponding `.hash` file containing the SHA-256 checksum.

-   **Individual Token Files**: `sauce_holdings_20250129T143022Z.csv`
-   **Summary File**: `all_tokens_summary_20250129T143022Z.csv` (contains all top-10 holders from all tokens)

### Database

The `token_holdings.db` SQLite file contains the canonical data in four main tables:
-   `token_metadata`: Tracks refresh status, parameters, and file outputs.
-   `token_holdings`: Stores individual holder records, balances, and rankings.
-   `token_price_history`: Keeps a historical log of fetched token prices.
-   `refresh_logs`: Contains detailed logs for every operation performed.

---

## 🛠️ Development

### Running Tests

The project includes a comprehensive test suite.

```bash
# Run all unit and integration tests
make test
```

### System Status & Troubleshooting

-   **Check System Health**: `poetry run python -m src.cli status`
-   **Database Locked?**: This usually means another process is running. If it's stuck, you can safely delete `token_holdings.db` and run `make install` to rebuild it.
-   **Token Validation Errors**: If the validator fails on startup, check the error message. It's designed to fail loudly if `tokens_enabled.json` has missing tokens or if token IDs don't match the database, preventing data corruption.

This system is designed for robust, reliable, and insightful analysis of the Hedera token ecosystem.
