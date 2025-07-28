.PHONY: help setup install install-dev init refresh export status top percentiles cleanup clean test format lint

# Default target
help:
	@echo "Token Holdings Tracking System"
	@echo "==============================="
	@echo ""
	@echo "Available commands:"
	@echo "  make setup       - Setup virtual environment and install dependencies"
	@echo "  make install     - Alias for setup"
	@echo "  make install-dev - Install with development dependencies"
	@echo "  make init        - Initialize database and directories"
	@echo "  make refresh     - Refresh all token data"
	@echo "  make refresh-hbar - Refresh only HBAR data"
	@echo "  make refresh-sauce - Refresh only SAUCE data"
	@echo "  make refresh-karate - Refresh only KARATE data"
	@echo "  make refresh-interactive - Interactive mode (prompts for old data)"
	@echo "  make refresh-interactive-quick - Interactive mode with limited accounts"
	@echo "  make export      - Export all token data to CSV"
	@echo "  make export-summary - Export summary of all tokens"
	@echo "  make status      - Show status of all tokens"
	@echo "  make top-holders - Show top holders for all tokens"
	@echo "  make percentiles - Show percentiles for all tokens"
	@echo "  make cleanup     - Clean up old data"
	@echo "  make clean       - Remove database and temp files"
	@echo "  make test        - Run basic system test"

# Setup and install dependencies
setup:
	@echo "🔧 Setting up virtual environment and Poetry..."
	python -m venv .venv
	@echo "📦 Installing Poetry dependencies..."
	poetry install
	@echo "✅ Setup completed!"

install: setup

install-dev:
	@echo "📦 Installing Poetry dependencies with dev tools..."
	poetry install --with dev
	@echo "✅ Development dependencies installed!"

# Initialize system
init:
	@echo "🔧 Initializing Token Holdings System..."
	poetry run python -m src.cli init
	@echo "✅ System initialized!"

# Refresh commands
refresh:
	@echo "🚀 Refreshing all token data..."
	poetry run python -m src.cli refresh --export-csv

refresh-hbar:
	@echo "🚀 Refreshing HBAR data..."
	poetry run python -m src.cli refresh --token HBAR --export-csv

refresh-sauce:
	@echo "🚀 Refreshing SAUCE data..."
	poetry run python -m src.cli refresh --token SAUCE --export-csv

refresh-karate:
	@echo "🚀 Refreshing KARATE data..."
	poetry run python -m src.cli refresh --token KARATE --export-csv

refresh-quick:
	@echo "🚀 Quick refresh (limited accounts)..."
	poetry run python -m src.cli refresh --max-accounts 10000 --export-csv

refresh-interactive:
	@echo "🤔 Interactive refresh mode..."
	poetry run python -m src.cli refresh --interactive --export-csv

refresh-interactive-quick:
	@echo "🤔 Interactive refresh mode (limited accounts)..."
	poetry run python -m src.cli refresh --interactive --max-accounts 10000 --export-csv

# Export commands
export:
	@echo "📄 Exporting all token data to CSV..."
	poetry run python -m src.cli export

export-summary:
	@echo "📊 Exporting summary of all tokens..."
	poetry run python -m src.cli export --summary

export-top-only:
	@echo "📄 Exporting top holders only..."
	poetry run python -m src.cli export --top-only

# Status and query commands
status:
	@echo "📊 Checking token status..."
	poetry run python -m src.cli status

top-holders:
	@echo "🏆 Showing top holders..."
	@echo "HBAR Top 10:"
	poetry run python -m src.cli top --token HBAR --limit 10 || echo "No HBAR data"
	@echo ""
	@echo "SAUCE Top 10:"
	poetry run python -m src.cli top --token SAUCE --limit 10 || echo "No SAUCE data"
	@echo ""
	@echo "KARATE Top 10:"
	poetry run python -m src.cli top --token KARATE --limit 10 || echo "No KARATE data"

percentiles:
	@echo "📈 Showing percentiles..."
	@echo "HBAR Percentiles:"
	poetry run python -m src.cli percentiles --token HBAR --percentiles "99,95,90,75,50,25,10,5,1" || echo "No HBAR data"
	@echo ""
	@echo "SAUCE Percentiles:"
	poetry run python -m src.cli percentiles --token SAUCE --percentiles "99,95,90,75,50,25,10,5,1" || echo "No SAUCE data"
	@echo ""
	@echo "KARATE Percentiles:"
	poetry run python -m src.cli percentiles --token KARATE --percentiles "99,95,90,75,50,25,10,5,1" || echo "No KARATE data"

# Maintenance commands
cleanup:
	@echo "🗑️  Cleaning up old data..."
	poetry run python -m src.cli cleanup --keep 3

clean:
	@echo "🧹 Removing database, temporary files, and virtual environment..."
	rm -f token_holdings.db
	rm -rf temp_data/
	rm -rf .venv/
	@echo "✅ Clean complete!"

# Test command
test:
	@echo "🧪 Running basic system test..."
	@echo "1. Initializing system..."
	poetry run python -m src.cli init
	@echo "2. Checking status..."
	poetry run python -m src.cli status
	@echo "3. Running quick refresh for HBAR (1000 accounts)..."
	poetry run python -m src.cli refresh --token HBAR --max-accounts 1000 --export-csv
	@echo "4. Showing results..."
	poetry run python -m src.cli status
	poetry run python -m src.cli top --token HBAR --limit 5
	@echo "✅ Test completed!"

# Development helpers
logs:
	@echo "📋 Recent refresh logs:"
	sqlite3 token_holdings.db "SELECT token_symbol, operation, message, created_at FROM refresh_logs ORDER BY created_at DESC LIMIT 20;"

db-info:
	@echo "💾 Database information:"
	@echo "Database size:"
	ls -lh token_holdings.db 2>/dev/null || echo "Database not found"
	@echo ""
	@echo "Table counts:"
	sqlite3 token_holdings.db "SELECT 'token_metadata', COUNT(*) FROM token_metadata UNION ALL SELECT 'token_holdings', COUNT(*) FROM token_holdings UNION ALL SELECT 'refresh_logs', COUNT(*) FROM refresh_logs;" 2>/dev/null || echo "Database not initialized"

temp-files:
	@echo "📁 Temporary files:"
	ls -la temp_data/ 2>/dev/null || echo "No temp directory found"

# Development tools
format:
	@echo "🎨 Formatting code with Black..."
	poetry run black src/

lint:
	@echo "🔍 Linting code with Flake8..."
	poetry run flake8 src/

type-check:
	@echo "🔍 Type checking with MyPy..."
	poetry run mypy src/

shell:
	@echo "🐚 Starting Poetry shell..."
	poetry shell 