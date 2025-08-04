"""Simple OpenAI API Key Injection Proxy

This router provides a minimal proxy that only injects the API key,
avoiding all the complexity of header manipulation and streaming detection.
"""

from __future__ import annotations

import os
import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from ..settings import logger

# Environment configuration
PROXY_TIMEOUT: float = float(os.getenv("OPENAI_PROXY_TIMEOUT", "60"))

router = APIRouter(tags=["openai_proxy"])


@router.api_route("/v1/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def openai_proxy(full_path: str, request: Request):
    """Simple proxy that only injects the API key, forwards everything else unchanged."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server")

    # Build target URL
    query_string: str | bytes = request.url.query
    target_url = f"https://api.openai.com/v1/{full_path}"
    if query_string:
        target_url += f"?{query_string}"

    # Copy headers except host and any existing authorization
    headers = {k: v for k, v in request.headers.items() if k.lower() not in {"host", "authorization"}}
    headers["Authorization"] = f"Bearer {api_key}"
    # Remove content-length so httpx recalculates it correctly
    headers.pop("content-length", None)

    # Get request body
    body = await request.body()

    logger.debug("Proxying %s %s", request.method, target_url)

    # Simple forward with httpx
    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        response = await client.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body,
        )
        
        # Forward response exactly as received
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
        )


@router.get("/openai/health")
async def health_check():
    try:
        configured = bool(os.getenv("OPENAI_API_KEY"))
        return {"status": "healthy", "openai_configured": configured}
    except Exception as exc:  # pragma: no cover
        logger.exception("OpenAI health check failed: %s", exc)
        return {
            "status": "unhealthy",
            "openai_configured": False,
            "error": str(exc),
        }