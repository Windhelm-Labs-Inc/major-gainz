# Makefile for Hedera RAG Service
# ---------------------------------
# Common development shortcuts. Invoke with:
#   make <target>



# ---------------------------------------------------------------------------
.PHONY: install install-dev install-all run shell lint test clean build index-build index-clean

# Dependency management
# ---------------------------------------------------------------------------

# Default location for persisted vector index (keep in sync with config.py)
INDEX_DIR ?= index_store

# "make install" → production runtime only (no dev / test tooling)
# "make install-dev" → runtime + developer tooling (ruff, pytest, etc.)
# "make install-all" → everything (all optional groups – handy for full local env)
# ---------------------------------------------------------------------------

# Production-only install (smallest footprint)
install:
	poetry install --only main

# Development install (includes dev group for linting / tests)
install-dev:
	poetry install --with dev

# Full install – pull in every defined dependency group
install-all:
	# Refresh lock file to ensure new/changed dependencies are captured
	poetry update --lock
	poetry install --with dev

# Start the MCP server using Poetry's virtualenv
run:
	poetry run python -m agent_support.hedera_rag_server.server

# Drop into an interactive shell inside Poetry's virtualenv
shell:
	poetry shell

# Static analysis / formatting helpers (optional)
lint:
	poetry run ruff .

# Run unit tests
test:
	poetry run pytest -q

# Build source & wheel distributions for publishing
build:
	poetry build

# Build or reset persistent vector index
index-build:
	poetry run python -m agent_support.hedera_rag_server.build_index


# Delete stored index
index-clean:
	rm -rf $(INDEX_DIR)

# Remove caches / temporary files
clean:
	find . -name "__pycache__" -type d -exec rm -rf {} +
