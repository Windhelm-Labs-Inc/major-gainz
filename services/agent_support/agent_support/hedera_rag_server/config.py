"""Central configuration for the Hedera RAG MCP service.

All values can be overridden via environment variables so the service remains
flexible when containerised or deployed in different environments.
"""
from __future__ import annotations

import os

# ---------------------------------------------------------------------------
# Network settings
# ---------------------------------------------------------------------------

HOST: str = os.getenv("MCP_HOST", "0.0.0.0")  # nosec B104 – host is intentionally configurable
PORT: int = int(os.getenv("MCP_PORT", "9090"))

# ---------------------------------------------------------------------------
# Embedding / model settings (extend later if needed)
# ---------------------------------------------------------------------------

EMBED_MODEL_NAME: str = os.getenv(
    "EMBED_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
)
SIMILARITY_TOP_K: int = int(os.getenv("SIMILARITY_TOP_K", "3"))

# ---------------------------------------------------------------------------
# Storage / persistence settings
# ---------------------------------------------------------------------------

INDEX_DIR: str = os.getenv("INDEX_DIR", "index_store")
