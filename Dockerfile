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
ENV VITE_RAG_MCP_URL=/mcp/

COPY services/frontend/package*.json ./
RUN npm ci --only=production
COPY services/frontend/ ./
RUN npm run build # → /frontend/dist

########## 2️⃣  Install Python dependencies ###################################
FROM python:3.11-slim AS python-deps
ENV POETRY_VIRTUALENVS_CREATE=false \
    POETRY_NO_INTERACTION=1
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir --upgrade pip poetry

WORKDIR /build
COPY services/backend/pyproject.toml services/backend/poetry.lock* ./backend/
COPY services/agent_support/pyproject.toml services/agent_support/poetry.lock* ./agent_support/
COPY services/backend/static/token_holdings/pyproject.toml ./token_holdings/
RUN poetry install --no-root --only=main

########## 3️⃣  Runtime image ###################################################
FROM python:3.11-slim AS runtime
LABEL org.opencontainers.image.description="Quick-Origins all-in-one (single-port)"

WORKDIR /app

# --- Python env from builder -------------------------------------------------
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-deps /usr/local/bin /usr/local/bin

# --- Application code --------------------------------------------------------
COPY services/backend/app ./services/backend/app
COPY services/agent_support/agent_support ./services/agent_support/agent_support
COPY services/backend/static/token_holdings/src ./services/backend/static/token_holdings/src

# --- Frontend bundle ---------------------------------------------------------
COPY --from=frontend-builder /frontend/dist ./services/frontend/dist

# --- SQLite databases --------------------------------------------------------
COPY services/backend/ohlcv.db ./services/backend/ohlcv.db
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
MCP_PORT=${MCP_PORT:-9090} python -m agent_support.hedera_rag_server.server &
RAG_PID=$!

trap "kill $BACKEND_PID $RAG_PID" TERM INT
wait $BACKEND_PID $RAG_PID
EOF
RUN chmod +x /start.sh

CMD ["/start.sh"]
