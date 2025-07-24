# Simple Makefile to streamline local development

# Ports can be overridden: `make dev BACKEND_PORT=8001`
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 3000

# --- Backend --------------------------------------------------------------

backend-dev:
	cd services/backend && poetry run uvicorn app.main:app --reload --port $(BACKEND_PORT)

# --- Frontend -------------------------------------------------------------

frontend-install:
	cd services/frontend && npm install

frontend-build:
	cd services/frontend && npm run build

frontend-dev:
	cd services/frontend && npm run dev -- --port $(FRONTEND_PORT)

# --- Combined Dev ---------------------------------------------------------
# Starts backend (in background) then the frontend dev server.
# Ctrl+C will stop both (frontend sends INT; backend trap handled by make).

dev: frontend-install
	# Run backend + frontend in a bash subshell so the background process persists
	bash -c '\
	  (cd services/backend && poetry run uvicorn app.main:app --reload --port $(BACKEND_PORT)) & \
	  BACK_PID=$$!; \
	  sleep 2; \
	  cd services/frontend && npm run dev -- --port $(FRONTEND_PORT); \
	  echo "Stopping backend..."; \
	  kill $$BACK_PID 2>/dev/null || true'

.PHONY: backend-dev frontend-install frontend-build frontend-dev dev

# Run backend Python tests via Poetry / pytest
backend-tests:
	cd services/backend && poetry run pytest -v

.PHONY: backend-tests 

# -----------------------------------------------------------
# Rebuild backend database from scratch (drops sqlite file and
# repopulates via refresh_all_tokens).
# -----------------------------------------------------------

backend-rebuild-db:
	cd services/backend && poetry run python -m scripts.rebuild_db

.PHONY: backend-rebuild-db 