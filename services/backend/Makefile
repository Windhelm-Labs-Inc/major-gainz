# Backend service Makefile ------------------------------------------------------
# Mirrors top-level tasks but scoped to the backend directory only.
# -----------------------------------------------------------------------------
# Usage (from project root or this directory):
#   make -C services/backend install   # install deps & init venv
#   make -C services/backend dev       # run FastAPI with autoreload
#   make -C services/backend test      # run pytest
#   make -C services/backend env-shell # open subshell with .env exported
# -----------------------------------------------------------------------------

# Bring vars from repo root .env if it exists so Poetry/uvicorn inherit them
ifneq (, $(wildcard ../../.env))
    include ../../.env
    export
endif

# Configurable defaults --------------------------------------------------------
BACKEND_PORT ?= 8000
PY := $(shell which python3)

# Internal helper – ensure Poetry env exists & deps are installed --------------
poetry-setup:
	@# Create / reuse the venv and install locked deps (+dev)
	@poetry env use $(PY) >/dev/null || true
	@poetry lock --no-interaction
	@poetry install --with dev --no-root --no-interaction

# Targets ----------------------------------------------------------------------
.PHONY: install dev test env-shell clean

install: poetry-setup
	@echo "✅ Backend dependencies installed"

# FastAPI dev server with auto-reload
# Example: make dev BACKEND_PORT=9000

dev: poetry-setup
	@echo "🚀 Starting backend on port $(BACKEND_PORT) …"
	@poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

test: poetry-setup
	@echo "🧪 Running backend tests …"
	@poetry run pytest tests/ -v

# Open subshell with env vars & poetry venv activated
env-shell: poetry-setup
	@echo "🔒 Spawning subshell (exit to return)"
	@bash -c "source \
	  <(poetry env info --path 2>/dev/null)/bin/activate && exec $${SHELL:-bash} -i"

# Remove virtual-env (for troubleshooting)
clean:
	@echo "🧹 Removing Poetry virtualenv"
	@poetry env remove --all || true
