#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"
DEBUG=0

# ---- CLI -----------------------------------------------------------------
if [[ "${1:-}" == "--debug" ]]; then DEBUG=1; shift; fi

# ---- helper: load .env ---------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    # skip comments / blank
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    # key=value (allow quoted value)
    if [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      # strip surrounding quotes if present
      val="${val%\"}"
      val="${val#\"}"
      val="${val%\'}"
      val="${val#\'}"
      export "$key"="$val"
      (( DEBUG )) && echo "env: $key=***loaded***"
    fi
  done < "$ENV_FILE"
fi

# ---- required / optional -------------------------------------------------
REQ_KEYS=(OPENAI_API_KEY)
OPT_KEYS=(SAUCER_SWAP_API_KEY WALLETCONNECT_PROJECT_ID HEDERA_NETWORK)

for key in "${REQ_KEYS[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "❌  $key not set (env or .env)."
    exit 1
  fi
done

echo "✅  env vars loaded. Starting compose ..."
cd "$PROJECT_ROOT"
docker compose build --no-cache
docker compose up