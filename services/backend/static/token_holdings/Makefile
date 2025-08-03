

.PHONY: help install test production interactive status portfolio env-shell

# Load environment variables from .env if available and export them so they
# are accessible inside all recipe commands.
ifneq (,$(wildcard ../../../../.env))
include ../../../../.env
export
endif

# Default target
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  install       - Install dependencies and initialize the database"
	@echo "  test          - Run the full test suite"
	@echo "  production    - Build the production database (unlimited accounts, min_usd 1)"
	@echo "  interactive   - Run in interactive mode to refresh stale token data"
	@echo "  status        - Show the current status of the token holdings database"
	@echo "  portfolio     - Look up a portfolio by address"

# Install and setup
install:
	@echo "🔧 Setting up Token Holdings System..."
	@echo "📦 Installing Poetry dependencies..."
	poetry install --with dev
	@echo "🔧 Initializing database..."
	poetry run python -m src.cli init
	@echo "📊 Checking system status..."
	poetry run python -m src.cli status
	@echo "✅ Installation completed!"

# Run all tests
test:
	@echo "🧪 Running test suite..."
	poetry run pytest

# Production database build
production:
	@echo "🏗️  Building production database..."
	@echo "  📊 Unlimited accounts per token"
	@echo "  💰 Minimum USD filter: \$1.00"
	@echo "  🪙 All enabled tokens (HBAR, SAUCE, KARATE)\n"
	@echo "📦 Backing up existing database..."
	@mv token_holdings.db token_holdings.db.$$(date +%Y%m%d%H%M%S).bak || true
	poetry run python -m src.cli refresh --min-usd 1 --export-csv
	@echo ""
	@echo "📊 Production database status:"
	poetry run python -m src.cli status
	@echo "✅ Production database build completed!"

# Interactive mode
interactive:
	@echo "🤔 Starting interactive refresh mode..."
	@echo "  📋 Batch processing with confirmation"
	@echo ""
	poetry run python -m src.cli refresh --interactive --export-csv
	@echo "✅ Interactive refresh completed!" 

status:
	@echo "📊 Checking system status..."
	poetry run python -m src.cli status 

portfolio:
	@echo "🔎 Looking up portfolio..."
	poetry run python -m analytics.portfolio

# -----------------------------------------------------------------------------
# Development helpers
# -----------------------------------------------------------------------------

# Start a new interactive shell with project environment variables loaded.
env-shell:
	@echo "🔒 Opening subshell with project environment..."
	@bash -c "set -a && source ../../../../.env && set +a && exec $${SHELL:-bash} -i" 