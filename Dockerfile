###############################################################################
# Multi-stage, single-port Dockerfile
#   • Exposes ONLY 8080 externally.
#   • Internally runs:
#       – FastAPI backend (also serves static frontend & /mcp proxy) on 8080
#       – RAG MCP server on 9090 (not exposed)
#   • Uses Node build stage + Python deps stage to keep runtime layer slim.
###############################################################################

########## 1️⃣  Build React frontend ###########################################
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Pass the location of the MCP proxy so Vite embeds the correct URL
ENV VITE_API_BASE=/api
ENV VITE_RAG_BASE=/mcp

COPY services/frontend/package*.json ./
# Install *all* deps (prod + dev) for build
RUN npm install
COPY services/frontend/ ./
RUN npm run build # → /frontend/dist

########## 2️⃣  Install Python dependencies ###################################
FROM python:3.11-slim AS python-deps
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip poetry

# --- Install Python dependencies for each sub-project -------------------
WORKDIR /build

# Copy only dependency manifests first (better Docker cache utilisation)
COPY services/backend/pyproject.toml services/backend/poetry.lock* ./backend/
COPY services/agent_support/pyproject.toml services/agent_support/poetry.lock* ./agent_support/
COPY services/backend/static/token_holdings/pyproject.toml ./token_holdings/

# Install deps for each project (without building the local package itself)
# Regenerate lock files if pyproject changed, then install
# Install backend & token_holdings into global site-packages (NumPy 2.x)
RUN poetry install -C backend --no-root --only=main && \
    poetry install -C token_holdings --no-root --only=main

# ----- Dedicated virtualenv for agent_support (needs NumPy <1.25) -----
ENV POETRY_VIRTUALENVS_CREATE=true \
    POETRY_VIRTUALENVS_IN_PROJECT=true
RUN poetry lock -C agent_support --no-interaction && \
    poetry install -C agent_support --no-root --only=main

# Expose the venv path for later stage
ENV AGENT_VENV_PATH=/build/agent_support/.venv

########## 3️⃣  Runtime image ###################################################
FROM python:3.11-slim AS runtime
LABEL org.opencontainers.image.description="Quick-Origins all-in-one (single-port)"

WORKDIR /app

# --- Python env from builder -------------------------------------------------
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin
# Copy dedicated agent_support virtualenv
COPY --from=python-deps /build/agent_support/.venv /agent_support_venv
# Fix virtualenv paths by updating pyvenv.cfg
RUN sed -i 's|/build/agent_support/.venv|/agent_support_venv|g' /agent_support_venv/pyvenv.cfg || true

# --- Application code --------------------------------------------------------
COPY services/backend/app ./services/backend/app
COPY services/agent_support/agent_support ./services/agent_support/agent_support
COPY services/backend/static/token_holdings/src ./services/backend/static/token_holdings/src

# --- Frontend bundle ---------------------------------------------------------
COPY --from=frontend-builder /frontend/dist ./services/frontend/dist

# --- SQLite databases --------------------------------------------------------
COPY services/backend/ohlcv.db ./services/backend/ohlcv.db
COPY services/backend/tokens_enabled.json ./services/backend/tokens_enabled.json
COPY services/backend/static/token_holdings/token_holdings.db ./services/backend/static/token_holdings/token_holdings.db

RUN mkdir -p ./services/backend/logs

ENV PORT=8080 \
    WEBSITES_PORT=8080

EXPOSE 8080

# -------- Launch script ------------------------------------------------------
COPY <<'EOF' /start.sh
#!/bin/sh
set -e

# 1. FastAPI backend (serves API, static files, and /mcp proxy)
cd /app/services/backend
uvicorn app.main:app --host 0.0.0.0 --port 8080 &
BACKEND_PID=$!

# 2. RAG server (internal only)  
cd /app/services/agent_support
PYTHONPATH=/app/services/agent_support/agent_support:${PYTHONPATH:-} \
PATH=/agent_support_venv/bin:${PATH} \
/agent_support_venv/bin/python -m agent_support.hedera_rag_server.server &
RAG_PID=$!

trap "kill $BACKEND_PID $RAG_PID" TERM INT
wait $BACKEND_PID $RAG_PID
EOF
RUN chmod +x /start.sh

CMD ["/start.sh"]
