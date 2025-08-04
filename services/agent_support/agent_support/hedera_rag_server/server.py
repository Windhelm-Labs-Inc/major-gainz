"""Entry point that exposes an MCP server via Streamable HTTP transport.

The server offers two simple tools:

1. ``hello`` – classic "Hello World" style echo

The code relies on **FastMCP** which is the de-facto standard framework for
writing Model Context Protocol servers in Python.
"""
from __future__ import annotations

from fastmcp import FastMCP
from fastapi import APIRouter

# Importing rag_index triggers loading/building the vector index at startup
from hedera_rag_server.rag_index import query_knowledge, _LLAMA_AVAILABLE

mcp = FastMCP("Hedera-RAG-Server")

# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------


@mcp.tool()
def hello(name: str = "World") -> str:  # noqa: D401, ANN001
    """Return a short greeting."""
    return f"Hello, {name}! 👋"

# ---------------------------------------------------------------------------
# Health / readiness endpoints (FastAPI routes)
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/health", tags=["infra"])
async def health() -> dict[str, str]:
    """Always returns 200 to signal the process is alive."""
    return {"status": "ok"}


@router.get("/ready", tags=["infra"])
async def ready() -> dict[str, str]:
    """Readiness probe reporting whether the RAG index is available."""
    return {"ready": str(_LLAMA_AVAILABLE).lower()}


# Register routes on the underlying FastAPI app provided by FastMCP
if hasattr(mcp, "app"):
    mcp.app.include_router(router)  # type: ignore[attr-defined]


if __name__ == "__main__":
    from hedera_rag_server.config import HOST, PORT

    # Run the server.  We use "http" (Streamable HTTP) transport so that the
    # service is reachable from any MCP-capable client over a standard
    # TCP/IP connection.
    mcp.run(transport="http", host=HOST, port=PORT)
