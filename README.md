# Major Gainz – Technical Walkthrough

AI-assisted portfolio intelligence for the Hedera network. This doc is a practical, end-to-end guide to features, APIs, services, and how they fit together.

## At a glance

- Frontend: React + Vite app (port 8080) with lazy-loaded charts and a chat UI that renders components on demand
- Backend: FastAPI (port 8000) with routes for portfolio, DeFi, OHLCV, analytics, holders, OpenAI proxy, and MCP proxy
- Agent Support: Small RAG+MCP server used via backend `/mcp/*` proxy
- Token Holdings: CLI-driven SQLite system that ingests holder data and powers holders APIs

Run targets (common):

Don't use make dev, stick to containers.  
make docker-compose-local if you place a env file. 
make docker-compose-dev if you will be injecting them through a secret manager or similar. 

```bash

# Secure preview (build frontend, serve static via backend)
make dev-secure

# Docker compose dev
make docker-compose-dev
```

Default ports:
- Frontend (Vite): http://localhost:8080
- Backend (FastAPI): http://localhost:8000

## Frontend features

- Major Gainz page (`services/frontend/src/majorgainz/MajorGainzPage.tsx`):
  - Wallet target input (HashPack pairing optional), header badge with rank, quick actions, chat window
  - Builds a ChartContext from live data: portfolio, DeFi positions, returns analytics, selected token
- Chat-driven components:
  - Agent replies can include tags like `[CHART:portfolio-chart]`
  - `ChatWindow` parses tags and emits a `ComponentInstruction`
  - `ChatComponentRegistry` lazy-loads and renders the matching component with context
- Charts:
  - `PortfolioChart` (Chart.js Doughnut via `react-chartjs-2`)
  - `RiskScatter` (Chart.js Scatter)
  - `DefiHeatmap` (DOM-based heatmap using APY/TVL, risk-coded)
  - `CorrelationMatrix` (DOM grid using provided correlation coefficients)
  - `TokenHolderAnalysis` (fetches `/api/token_holdings/{symbol}` for percentiles/top holders)
  - `MGTokenHoldersInteractive` (interactive top/distribution/cumulative views)
- Prompt suggestions: collapsed pill button labeled “Mission Context Assist” that expands to context-aware prompts

Security:
- OpenAI key never shipped to browser. Chat uses backend proxy at `/api/v1/...`
- Vite dev server proxies `/api` and `/mcp` to backend (configurable)

## Backend API (summary)

All endpoints are available both at their base path and under `/api` (duplicate router for the frontend), e.g., `/portfolio/...` and `/api/portfolio/...`.

Portfolio
- `GET /portfolio/{address}?network=mainnet|testnet`
  - Returns wallet holdings with USD valuations (prices from local OHLCV DB)

DeFi
- `GET /defi/positions/{account_id}?network=mainnet|testnet` – condensed positions (TVL, counts, SaucerSwap/Bonzo data)
- `GET /defi/profile/{account_id}?include_risk_analysis=true&testnet=false` – full cross-protocol profile
- `GET /defi/profile/{account_id}/saucerswap?testnet=false` – SaucerSwap-only profile
- `GET /defi/profile/{account_id}/bonzo` – Bonzo-only portfolio
- `GET /defi/health` – protocol health
- `GET /defi/pools/saucerswap?version=v1|v2|all&testnet=false` – pools listing
- `GET /defi/pools/summary?account_id={optional}&testnet=false` – 10‑min cached global pools snapshot (optionally with user positions)

OHLCV (SaucerSwap; requires `SAUCER_SWAP_API_KEY`)
- `GET /ohlcv/{token}?days=90&interval=DAY` – raw candles from SaucerSwap (normalized)
- `GET /ohlcv/{token}/latest` – latest candle (from local DB)
- `GET /ohlcv/{token}/stats?start=YYYY-MM-DD&end=YYYY-MM-DD` – summary statistics
- `GET /ohlcv/{token}/mean_return?days=30`, `.../return_std?days=30`, `.../log_returns?days=30` – computed metrics

Analytics
- `GET /analytics/returns/{address}?network=mainnet|testnet&days=90` – per-token expected returns, volatility, Sharpe, and pairwise correlations used by the frontend charts

Token holders (static DB powered)
- Read-only views (no body):
  - `GET /holders/{symbol}/top?limit=10`
  - `GET /holders/{symbol}/percentiles?list=99,95,90,75,50,25,10,5,1`
  - `GET /holders/{symbol}/summary`
- User-specific percentile + top holders (POST):
  - `POST /token_holdings/{token}` with body `{ address: string, token_balance: string }`

OpenAI proxy
- `ANY /v1/{full_path}` – proxies to `https://api.openai.com/v1/{full_path}` with:
  - Exponential backoff on 429 with jitter and `retry-after` support
  - Limited retries on 5xx and timeouts

MCP proxy
- `ANY /mcp{path}` – reverse-proxy to the Agent Support RAG server (configurable host/port)

Static frontend
- If `services/frontend/dist` exists, backend serves it at `/` (API routes have precedence)

## Agent Support (RAG + MCP)

Located under `services/agent_support/agent_support/hedera_rag_server`.

- Exposes two trivial MCP tools (`hello`, `tell_me_a_secret`) and two health routes:
  - `GET /health` – liveness
  - `GET /ready` – readiness (reports whether LlamaIndex is available)
- On startup (when run as `__main__`):
  - Runs a background MCP server (default port 9091)
  - Exposes `/mcp/*` on the main FastAPI app (default port 9090) with CORS
- Backend `/mcp/*` forwards to this service
- RAG index: loads or builds a LlamaIndex vector store from static FACTS + `knowledge_base/`; falls back to keyword match if LlamaIndex unavailable

Config (env; defaults):
- `MCP_HOST=0.0.0.0`, `MCP_PORT=9090` (front door)
- Background MCP server port: `9091`
- `INDEX_DIR=index_store`, `EMBED_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2`, `SIMILARITY_TOP_K=3`

## Token Holdings system (static DB + CLI)

Located under `services/backend/static/token_holdings`.

Purpose
- Ingests Hedera holders for configured tokens and persists to `token_holdings.db`
- Provides top holders and percentile markers used by backend routes

Key commands (`python -m src.cli` via Poetry/Makefile), examples:

```bash
# Initialize DB and validate tokens configuration/decimals
poetry run python -m src.cli init

# Refresh all tokens (or a single symbol) with optional filters
poetry run python -m src.cli refresh --token HBAR --max-accounts 50000 --min-usd 10

# Status table
poetry run python -m src.cli status

# Top holders and percentile markers
poetry run python -m src.cli top --token HBAR --limit 10
poetry run python -m src.cli percentiles --token HBAR --percentiles 99,95,90,75,50,25,10

# Clean old batches (keep latest 5)
poetry run python -m src.cli cleanup --keep 5
```

Schema highlights (`src/database/models.py`):
- `TokenMetadata` – per-token refresh tracking and pricing metadata
- `TokenHolding` – holder entries and percentile markers (ranked, indexed)
- `TokenPriceHistory`, `RefreshLog` – auditability and pricing snapshots

Pricing and filters
- `SaucerSwapPricingService` caches `/tokens` prices; special handling for HBAR via Mirror Node → CoinGecko → fallback
- `TokenFilterService` adds USD values or filters by min-USD

Validation (fails loudly)
- `TokenValidator` checks `tokens_enabled.json`, fetches decimals from Mirror Node into `src/token_decimals.json`, ensures DB consistency, and verifies tokens exist on SaucerSwap when API key is set

## Environment

Backend
- `OPENAI_API_KEY` – required for chat proxy
- `SAUCER_SWAP_API_KEY` – required for OHLCV and enables USD features in token holdings
- `HEDERA_NETWORK` – default `mainnet`
- `MCP_HOST`, `MCP_PORT` – agent_support proxy target (defaults 127.0.0.1:9090)
- `DATABASE_URL` – optional; defaults to local SQLite for OHLCV if unset

Frontend (bundled at build time)
- `VITE_WALLETCONNECT_PROJECT_ID` – optional
- `VITE_HEDERA_NETWORK` – defaults to `mainnet`
- Dev proxy target for backend can be overridden with `BACKEND_PORT` (defaults 8000)

## End-to-end flow

1) User sets target wallet; frontend hooks fetch:
- `/api/portfolio/{address}` → holdings and USD
- `/api/defi/positions/{address}` → condensed DeFi summary
- `/api/analytics/returns/{address}` → returns/vol/Sharpe (+ correlations)
- `/api/defi/pools/summary` → global pools for heatmap context

2) User chats; frontend `useMGAgent` posts to `/api/v1/chat/completions`; response may include chart tags

3) Chat renders components lazily via registry with live context

4) Holders analysis uses either POST `/api/token_holdings/{symbol}` (user-specific) or read-only `/api/holders/*`

## Notes & caveats

- Without `SAUCER_SWAP_API_KEY`, OHLCV service and token price features will not function (and startup tasks that depend on them may fail)
- Holders APIs require a populated `token_holdings.db` (use the CLI `init` + `refresh`)
- CORS is permissive for dev; deploy behind appropriate gateways in production

## Project layout

```
services/
  backend/         FastAPI app (routers include: portfolio, defi, ohlcv, analytics, holders, token_holdings, chat, mcp_proxy)
  frontend/        React app (Vite dev server proxies /api and /mcp to backend)
  agent_support/   RAG MCP service (proxied via backend /mcp)
```
