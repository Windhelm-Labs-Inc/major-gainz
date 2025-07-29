.PHONY: help install test production interactive export

# Default target
help:
	@echo "Token Holdings Tracking System"
	@echo "==============================="
	@echo ""
	@echo "Available commands:"
	@echo "  make install     - Setup environment and install dependencies"
	@echo "  make test        - Run all tests (unit + integration)"
	@echo "  make production  - Build production database (unlimited accounts, \$$1 USD min)"
	@echo "  make interactive - Interactive refresh mode (prompts for old data)"
	@echo "  make export      - Export all token data to CSV files"
	@echo ""
	@echo "Examples:"
	@echo "  make install && make production  # Setup and build production DB"
	@echo "  make interactive                 # Smart refresh with prompts"
	@echo "  make export                      # Export current data to CSV"

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
	@echo "🧪 Running all tests..."
	poetry run pytest --cov=src --cov-report=term-missing
	@echo "✅ All tests completed!"

# Production database build
production:
	@echo "🏗️  Building production database..."
	@echo "  📊 Unlimited accounts per token"
	@echo "  💰 Minimum USD filter: \$$1.00"  
	@echo "  🪙 All enabled tokens (HBAR, SAUCE, KARATE)"
	@echo ""
	poetry run python -m src.cli refresh --min-usd 1 --export-csv
	@echo ""
	@echo "📊 Production database status:"
	poetry run python -m src.cli status
	@echo "✅ Production database build completed!"

# Interactive mode
interactive:
	@echo "🤔 Starting interactive refresh mode..."
	@echo "  📅 Checks data age and prompts for updates"
	@echo "  🔄 Smart refresh for tokens older than 24 hours"
	@echo "  📋 Batch processing with confirmation"
	@echo ""
	poetry run python -m src.cli refresh --interactive --export-csv
	@echo "✅ Interactive refresh completed!"

# Export data
export:
	@echo "📄 Exporting all token data to CSV..."
	poetry run python -m src.cli export
	@echo "📊 Exporting summary of all tokens..."
	poetry run python -m src.cli export --summary
	@echo "📁 Checking exported files..."
	@ls -la temp_data/ 2>/dev/null || echo "No temp directory found"
	@echo "✅ Export completed!" 