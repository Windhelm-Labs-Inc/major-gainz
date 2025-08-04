"""Entry point that exposes an MCP server via Streamable HTTP transport.

The server offers two simple tools:

1. ``hello`` – classic "Hello World" style echo
2. ``tell_me_a_secret`` – returns an immutable truth

The code relies on **FastMCP** which is the de-facto standard framework for
writing Model Context Protocol servers in Python.
"""
from __future__ import annotations

from fastmcp import FastMCP
from fastapi import APIRouter, FastAPI, Response
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request

# Initialise centralised logging early so subsequent imports pick it up
from hedera_rag_server.logging_config import _root  # noqa: F401  # side-effect import

import logging
logger = logging.getLogger(__name__)

# Importing rag_index triggers loading/building the vector index at startup
from hedera_rag_server.rag_index import query_knowledge, _LLAMA_AVAILABLE

mcp = FastMCP("Hedera-RAG-Server")

# ---------------------------------------------------------------------------
# MCP tools
# ---------------------------------------------------------------------------


@mcp.tool()
def hello(name: str = "World") -> str:  # noqa: D401, ANN001
    """Return a short greeting."""
    logger.info("hello tool invoked name=%s", name)
    return f"Hello, {name}! 👋"


@mcp.tool()
def tell_me_a_secret() -> str:  # noqa: D401
    """Reveal the ultimate secret."""
    logger.debug("tell_me_a_secret tool invoked")
    return "Windhelm will always win, everything"

# ---------------------------------------------------------------------------
# Health / readiness endpoints (FastAPI routes)
# ---------------------------------------------------------------------------

router = APIRouter()


@router.get("/health", tags=["infra"])
async def health() -> dict[str, str]:
    """Always returns 200 to signal the process is alive."""
    logger.debug("/health endpoint called")
    return {"status": "ok"}


@router.get("/ready", tags=["infra"])
async def ready() -> dict[str, str]:
    """Readiness probe reporting whether the RAG index is available."""
    logger.debug("/ready endpoint called _LLAMA_AVAILABLE=%s", _LLAMA_AVAILABLE)
    return {"ready": str(_LLAMA_AVAILABLE).lower()}


# Register routes on the underlying FastAPI app provided by FastMCP
if hasattr(mcp, "app"):
    # Add our health/ready routes
    mcp.app.include_router(router)  # type: ignore[attr-defined]


if __name__ == "__main__":
    from hedera_rag_server.config import HOST, PORT
    import uvicorn

    # Create a custom FastAPI app with CORS
    app = FastAPI(title="Hedera RAG Server with CORS")
    
    # Add CORS middleware FIRST
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Add explicit CORS preflight handlers for /mcp endpoints
    @app.options("/mcp")
    @app.options("/mcp/")
    async def cors_preflight():
        logger.debug("CORS preflight OPTIONS handler called")
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, HEAD",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            }
        )
    
    @app.head("/mcp")
    @app.head("/mcp/")
    async def cors_head():
        logger.debug("CORS HEAD handler called")
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, HEAD",
                "Access-Control-Allow-Headers": "*",
            }
        )
    
    # Add our health/ready routes to the main app
    app.include_router(router)
    
    # Create MCP endpoints with CORS support
    from fastapi import Request
    from fastapi.responses import StreamingResponse
    import asyncio
    
    # Start MCP server in background thread
    import threading
    import time
    
    mcp_server_ready = asyncio.Event()
    
    def start_mcp_background():
        """Start MCP server in background"""
        # Give main thread time to set up
        time.sleep(0.5)
        try:
            logger.info("Starting background MCP server on port 9091...")
            mcp.run(transport="http", host="127.0.0.1", port=9091)
        except Exception as e:
            logger.error("Failed to start MCP server: %s", e)
    
    # Start MCP in background thread
    mcp_thread = threading.Thread(target=start_mcp_background, daemon=True)
    mcp_thread.start()
    
    # Wait a moment for MCP server to start
    time.sleep(1)
    
    # Create proxy endpoints for MCP with CORS
    @app.api_route("/mcp{path:path}", methods=["GET", "POST", "DELETE", "OPTIONS", "HEAD"])
    async def mcp_handler(request: Request, path: str = ""):
        """Handle all MCP requests with CORS support"""
        
        # Handle CORS preflight
        if request.method == "OPTIONS":
            return Response(
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, HEAD",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Max-Age": "86400",
                }
            )
        
        # Handle HEAD requests
        if request.method == "HEAD":
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS, HEAD",
                    "Access-Control-Allow-Headers": "*",
                }
            )
        
        # Proxy to actual MCP server
        import httpx
        
        # Track sessions to maintain state
        session_id = request.headers.get("mcp-session-id")
        
        try:
            # Use persistent client for session continuity
            if not hasattr(mcp_handler, '_clients'):
                mcp_handler._clients = {}
            
            if session_id and session_id in mcp_handler._clients:
                client = mcp_handler._clients[session_id]
            else:
                client = httpx.AsyncClient(timeout=30.0)
                if session_id:
                    mcp_handler._clients[session_id] = client
            
            # Build target URL - MCP server expects requests at root
            # For /mcp -> /mcp, /mcp/ -> /mcp/, /mcp/something -> /mcp/something
            if path.startswith("/"):
                target_path = "/mcp" + path
            else:
                target_path = "/mcp/" + path if path else "/mcp/"
            
            url = f"http://127.0.0.1:9091{target_path}"
            
            # Get request body
            body = None
            if request.method in ["POST", "PUT", "PATCH"]:
                body = await request.body()
            
            # Forward headers (exclude problematic ones)
            headers = {}
            for key, value in request.headers.items():
                if key.lower() not in ["host", "content-length"]:
                    headers[key] = value
            
            # Make request to MCP server
            if session_id and session_id in mcp_handler._clients:
                # Use persistent client for existing session
                response = await mcp_handler._clients[session_id].request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body,
                    params=dict(request.query_params)
                )
            else:
                # Use temporary client for new/unknown sessions
                async with httpx.AsyncClient(timeout=30.0) as temp_client:
                    response = await temp_client.request(
                        method=request.method,
                        url=url,
                        headers=headers,
                        content=body,
                        params=dict(request.query_params)
                    )
            
            # Build response headers with CORS
            response_headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Expose-Headers": "*",
            }
            
            # Forward important headers
            for key, value in response.headers.items():
                if key.lower() in ["content-type", "mcp-session-id", "cache-control"]:
                    response_headers[key] = value
                    
            # Store new session ID if returned
            new_session_id = response.headers.get("mcp-session-id")
            if new_session_id and new_session_id not in mcp_handler._clients:
                mcp_handler._clients[new_session_id] = httpx.AsyncClient(timeout=30.0)
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=response_headers,
                media_type=response.headers.get("content-type")
            )
                
        except Exception as e:
            logger.error("MCP proxy error: %s", e)
            return Response(
                content='{"error": "MCP server unavailable"}',
                status_code=503,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "*", 
                    "Access-Control-Allow-Headers": "*",
                },
                media_type="application/json"
            )
    
    logger.info("Starting Hedera RAG Server with CORS on %s:%s", HOST, PORT)
    uvicorn.run(app, host=HOST, port=PORT)
