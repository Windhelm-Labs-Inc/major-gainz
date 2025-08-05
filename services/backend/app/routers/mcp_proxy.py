from fastapi import APIRouter, Request, Response
from fastapi.responses import StreamingResponse
import httpx

router = APIRouter()

# Base URL where the RAG MCP server runs *inside the container*.
# Keep loopback so traffic never leaves the container network.
import os

# Build MCP base from environment with sane defaults
# Connect to the main RAG server (which has /mcp proxy endpoints), not the background MCP server
_RAG_HOST = os.getenv("MCP_HOST", "127.0.0.1")  
_RAG_PORT = int(os.getenv("MCP_PORT", "9090"))  # Main FastAPI server port (config.py default)
_INTERNAL_MCP_BASE = f"http://{_RAG_HOST}:{_RAG_PORT}"


# CORS pre-flight handlers
@router.options("/mcp")
@router.options("/mcp/")
@router.options("/mcp/{full_path:path}")
async def _mcp_preflight(full_path: str | None = None):  # noqa: D401
    return Response(status_code=204, headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
    })

# Main proxy (no OPTIONS here)
@router.api_route("/mcp", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])  # root
@router.api_route("/mcp/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def mcp_proxy(request: Request, full_path: str | None = None) -> Response:
    """Simple reverse-proxy so the frontend can hit /mcp/* on :8080 and
    have it internally forwarded to the MCP RAG service on 127.0.0.1:9090.

    We forward the original method, headers, query params and body verbatim.
    """
    # Handle CORS pre-flight locally
    if request.method == "OPTIONS":
        return Response(status_code=204, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "86400",
        })

    # Ensure we always hit the /mcp endpoint on the RAG server
    if full_path:
        url = f"{_INTERNAL_MCP_BASE}/mcp/{full_path}"
    else:
        url = f"{_INTERNAL_MCP_BASE}/mcp/"

    # FastAPI uses an immutable header mapping, we convert to a regular dict.
    headers = dict(request.headers)
    # Remove client‐specific headers that httpx will set automatically or
    # that we do not want to forward.
    headers.pop("host", None)

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method=request.method,
            url=url,
            params=request.query_params,
            headers=headers,
            content=await request.body(),
            timeout=None,
        )
        
        response_headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*", 
            "Access-Control-Allow-Headers": "*",
        }
        for k, v in response.headers.items():
            if k.lower() in {"content-type", "mcp-session-id", "cache-control"}:
                response_headers[k] = v
        
        return StreamingResponse(
            response.aiter_bytes(),
            status_code=response.status_code,
            headers=response_headers,
        )
