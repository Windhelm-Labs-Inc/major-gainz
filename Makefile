# Simple Makefile to streamline local development

# Load environment variables from top-level .env file
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Ports can be overridden: `make dev BACKEND_PORT=8001`
BACKEND_PORT ?= 8000
FRONTEND_PORT ?= 8080
RAG_PORT ?= 9090

# --- Environment Sync Functions ------------------------------------------

# Source and export environment variables into a new interactive shell
# Usage: `make env-export` – opens a subshell with all variables from .env
# Exit the subshell to return to your original shell.
env-export:
	@if [ -f .env ]; then \
		echo "🔒 Opening subshell with .env loaded (type 'exit' to return)"; \
		bash -c 'set -a; . .env; set +a; exec $${SHELL:-bash} -i'; \
	else \
		echo "❌ .env file not found"; \
		exit 1; \
	fi

# --- Backend --------------------------------------------------------------

backend-dev:
	cd services/backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)

# --- RAG MCP Service -------------------------------------------------------
rag-dev:
	cd services/agent_support && poetry run python -m agent_support.hedera_rag_server.server --host 0.0.0.0 --port $(RAG_PORT)

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
	# Run backend + RAG + frontend with proper signal handling
	bash -c '\
	  set -e; \
	  cleanup() { \
	    echo ""; \
	    echo "Shutting down services..."; \
	    for pid in $$BACK_PID $$RAG_PID; do \
	      if [ -n "$$pid" ] && kill -0 $$pid 2>/dev/null; then \
	        echo "Stopping PID $$pid ..."; \
	        kill $$pid 2>/dev/null || true; \
	        wait $$pid 2>/dev/null || true; \
	      fi; \
	    done; \
	    echo "Services stopped."; \
	  }; \
	  trap cleanup INT TERM EXIT; \
	  echo "Starting backend ..."; \
	  (cd services/backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT)) & \
	  BACK_PID=$$!; \
	  sleep 2; \
	  echo "Starting RAG server ..."; \
	  (cd services/agent_support && poetry run python -m agent_support.hedera_rag_server.server --host 0.0.0.0 --port $(RAG_PORT)) & \
	  RAG_PID=$$!; \
	  sleep 2; \
	  echo "Starting frontend ..."; \
	  echo "Backend PID:  $$BACK_PID"; \
	  echo "RAG PID:      $$RAG_PID"; \
	  echo "Frontend URL: http://0.0.0.0:$(FRONTEND_PORT)"; \
	  echo "Backend  URL: http://0.0.0.0:$(BACKEND_PORT)"; \
	  echo "RAG      URL: http://0.0.0.0:$(RAG_PORT)/health"; \
	  echo ""; \
	  echo "Press Ctrl+C to stop all services"; \
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

.PHONY: backend-dev rag-dev frontend-install frontend-build frontend-dev frontend-dev-secure dev dev-secure

# Run backend Python tests via Poetry / pytest
backend-poetry-setup:
	cd services/backend && (poetry env info --path >/dev/null 2>&1 || poetry env use $(shell which python3)) && poetry lock --no-interaction && poetry install --with dev --no-root --no-interaction

backend-tests: backend-poetry-setup
	cd services/backend && poetry run pytest -q

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

# Run using Docker Compose (base only)

docker-compose-dev:
	docker compose -f docker-compose.yml up --build

.PHONY: docker-compose-dev

# Run using base + local overrides (.env, live mounts)
docker-compose-local:
	docker compose -f docker-compose.yml -f docker-compose.local.yml build --no-cache
	docker compose -f docker-compose.yml -f docker-compose.local.yml up

.PHONY: docker-compose-local
