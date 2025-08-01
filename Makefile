# Simple Makefile to streamline local development

# Load environment variables from top-level .env file
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Ports can be overridden: `make dev BACKEND_PORT=8001`
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 8080

# --- Environment Sync Functions ------------------------------------------

# Sync top-level .env to service-specific .env files
# sync-env target has been deprecated

	
# @if [ -f .env ]; then \
# 	echo "# Auto-generated from top-level .env - DO NOT EDIT MANUALLY" > services/backend/.env; \
# 	echo "# Use the top-level .env file to make changes" >> services/backend/.env; \
# 	echo "" >> services/backend/.env; \
# 	grep -E "^(OPENAI_API_KEY|DATABASE_URL|SAUCER_SWAP_API_KEY|HEDERA_NETWORK|DEFI_TEST_MODE|UVICORN_HOST|UVICORN_LOG_LEVEL|CORS_ORIGINS)=" .env >> services/backend/.env 2>/dev/null || true; \
# 	echo "# Auto-generated from top-level .env - DO NOT EDIT MANUALLY" > services/frontend/.env.local; \
# 	echo "# Use the top-level .env file to make changes" >> services/frontend/.env.local; \
# 	echo "" >> services/frontend/.env.local; \
# 	grep -E "^(VITE_WALLETCONNECT_PROJECT_ID|VITE_HEDERA_NETWORK)=" .env >> services/frontend/.env.local 2>/dev/null || true; \
# 	echo "✅ Environment variables synced to services"; \
# else \
# 	echo "❌ Top-level .env file not found. Copy .env.example to .env first."; \
# 	exit 1; \
# fi

# --- Backend --------------------------------------------------------------

backend-dev:
	cd services/backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

# --- Frontend -------------------------------------------------------------

frontend-install:
	cd services/frontend && npm install

frontend-build:
	cd services/frontend && npm run build

frontend-dev:
	cd services/frontend && npm run dev -- --port $(FRONTEND_PORT) --host 0.0.0.0

frontend-dev-secure:
	cd services/frontend && npm run dev-secure -- --port $(FRONTEND_PORT) --host 0.0.0.0

# --- Combined Dev ---------------------------------------------------------
# Starts backend (in background) then the frontend dev server.
# Ctrl+C will stop both (frontend sends INT; backend trap handled by make).

dev: frontend-install
	# Run backend + frontend with proper signal handling
	bash -c '\
	  set -e; \
	  cleanup() { \
	    echo ""; \
	    echo "Shutting down services..."; \
	    if [ ! -z "$$BACK_PID" ] && kill -0 $$BACK_PID 2>/dev/null; then \
	      echo "Stopping backend (PID: $$BACK_PID)..."; \
	      kill $$BACK_PID 2>/dev/null || true; \
	      wait $$BACK_PID 2>/dev/null || true; \
	    fi; \
	    echo "Services stopped."; \
	  }; \
	  trap cleanup INT TERM EXIT; \
	  echo "Starting backend..."; \
	  (cd services/backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)) & \
	  BACK_PID=$$!; \
	  echo "Waiting for backend to start..."; \
	  sleep 2; \
	  echo "Starting frontend..."; \
	  echo "Backend PID: $$BACK_PID"; \
	  echo "Frontend: http://0.0.0.0:$(FRONTEND_PORT)"; \
	  echo "Backend: http://0.0.0.0:$(BACKEND_PORT)"; \
	  echo ""; \
	  echo "Press Ctrl+C to stop both services"; \
	  echo ""; \
	  cd services/frontend && npm run dev -- --port $(FRONTEND_PORT) --host 0.0.0.0; \
	'

dev-secure: frontend-install
	# SECURE: Build + serve bundled files (no source exposure)
	bash -c '\
	  set -e; \
	  cleanup() { \
	    echo ""; \
	    echo "Shutting down services..."; \
	    if [ ! -z "$$BACK_PID" ] && kill -0 $$BACK_PID 2>/dev/null; then \
	      echo "Stopping backend (PID: $$BACK_PID)..."; \
	      kill $$BACK_PID 2>/dev/null || true; \
	      wait $$BACK_PID 2>/dev/null || true; \
	    fi; \
	    echo "Services stopped."; \
	  }; \
	  trap cleanup INT TERM EXIT; \
	  echo "Building frontend securely..."; \
	  (cd services/frontend && npm run build); \
	  echo "Starting backend..."; \
	  (cd services/backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)) & \
	  BACK_PID=$$!; \
	  echo "Waiting for backend to start..."; \
	  sleep 2; \
	  echo "Starting SECURE frontend (bundled only)..."; \
	  echo "Backend PID: $$BACK_PID"; \
	  echo "Frontend: http://0.0.0.0:$(FRONTEND_PORT)"; \
	  echo "Backend: http://0.0.0.0:$(BACKEND_PORT)"; \
	  echo ""; \
	  echo "Press Ctrl+C to stop both services"; \
	  echo ""; \
	  (cd services/frontend && npm run preview -- --port $(FRONTEND_PORT) --host 0.0.0.0); \
	'

.PHONY: backend-dev frontend-install frontend-build frontend-dev frontend-dev-secure dev dev-secure

# Run backend Python tests via Poetry / pytest
backend-tests:
	cd services/backend && poetry run pytest tests/ -v

.PHONY: backend-tests 


# Rebuild backend database from scratch (drops sqlite file and
# repopulates via refresh_all_tokens).
backend-rebuild-db:
	cd services/backend && poetry run python -m scripts.rebuild_db

.PHONY: backend-rebuild-db 

# Note -temporarily removing, as we would need new scripts given .env changes # Build and run using Docker script (with volume mounts)
# docker-dev:
# 	./docker-build-and-run.sh

.PHONY: docker-dev docker-dev-internal

# Run using Docker Compose
	docker compose up --build

.PHONY: docker-compose-dev
