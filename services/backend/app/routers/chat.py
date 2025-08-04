"""OpenAI Reverse Proxy Router

This router exposes a wildcard path under /v1/* that transparently proxies
requests to https://api.openai.com/v1/* while injecting the secret
Authorization header.  It supports both regular JSON responses and Server-
Sent Event (streaming) responses used when the `stream=true` query parameter
is supplied.
"""

from __future__ import annotations

import asyncio
import os
import json
import typing as _t

import httpx
from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse

from ..settings import logger

# ---------------------------------------------------------------------------
# Configurable parameters (env-driven so we can tune in each environment)
# ---------------------------------------------------------------------------
# Deprecated constant – kept for backward compat; requests now fetch live value
OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
PROXY_TIMEOUT: float = float(os.getenv("OPENAI_PROXY_TIMEOUT", "30"))
MAX_RETRIES: int = int(os.getenv("OPENAI_PROXY_RETRIES", "3"))
BACKOFF_SECONDS: float = float(os.getenv("OPENAI_PROXY_BACKOFF", "0.5"))

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
}

router = APIRouter(tags=["openai_proxy"])


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _strip_hop_headers(headers: httpx.Headers | dict[str, str]) -> dict[str, str]:
    """Return a copy minus hop-by-hop headers that should not be forwarded."""
    return {k: v for k, v in headers.items() if k.lower() not in HOP_BY_HOP_HEADERS}


async def _sleep_backoff(attempt: int) -> None:
    await asyncio.sleep(BACKOFF_SECONDS * (2**attempt))


async def _forward_with_retries(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes | None,
    max_retries: int,
) -> httpx.Response:
    """Forward the request, retrying only when it is safe to do so."""

    # Retry policy: safe (GET/HEAD) or explicit idempotency key present.
    safe_to_retry = method.upper() in {"GET", "HEAD"} or "Idempotency-Key" in headers
    if not safe_to_retry or max_retries <= 1:
        return await client.request(method, url, headers=headers, content=body)

    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            response = await client.request(method, url, headers=headers, content=body)
            return response
        except httpx.RequestError as exc:
            last_exc = exc
            logger.warning(
                "OpenAI proxy attempt %d/%d failed: %s", attempt + 1, max_retries, exc
            )
            if attempt < max_retries - 1:
                await _sleep_backoff(attempt)
    # All retries exhausted
    raise last_exc  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Wildcard proxy endpoint
# ---------------------------------------------------------------------------

@router.api_route("/v1/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def openai_proxy(full_path: str, request: Request):
    """Wildcard handler that proxies any /v1/* call to api.openai.com."""

    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OpenAI API key not configured on server",
        )

    # ------------------------------------------------------------------
    # Assemble outbound request details
    # ------------------------------------------------------------------
    query_string: str | bytes = request.url.query
    target_url = f"https://api.openai.com/v1/{full_path}"
    if query_string:
        target_url += f"?{query_string}"

    # Copy headers except `host`; inject Authorization (live key)
    outbound_headers = {k: v for k, v in request.headers.items() if k.lower() != "host"}

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured on server")
    outbound_headers["Authorization"] = f"Bearer {api_key}"

    body = await request.body()

    # Detect streaming: ?stream=true || JSON {"stream": true}
    is_stream = request.query_params.get("stream") in {"true", "1"}
    if not is_stream and request.headers.get("content-type", "").startswith("application/json"):
        try:
            payload = json.loads(body or b"{}") if isinstance(body, (bytes, bytearray)) else body  # type: ignore[arg-type]
            if isinstance(payload, dict):
                is_stream = bool(payload.get("stream"))
        except (ValueError, TypeError):
            pass

    async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
        # Streaming logic ------------------------------------------------
        if is_stream:
            # Use context manager manually so we can forward chunks while controlling lifetime.
            upstream_cm = client.stream(
                request.method, target_url, headers=outbound_headers, content=body
            )
            upstream = await upstream_cm.__aenter__()

            async def _aiter():  # type: ignore[return-value]
                try:
                    try:
                        async for chunk in upstream.aiter_raw():
                            yield chunk
                    except httpx.StreamConsumed:
                        # Fallback for cases where the response body was eagerly read (e.g. mock transport).
                        if upstream.content:
                            yield upstream.content
                finally:
                    # Ensure the upstream connection is closed when client side stops reading.
                    await upstream_cm.__aexit__(None, None, None)

            # Strip hop-by-hop headers from upstream before forwarding.
            forwarded_headers = _strip_hop_headers(upstream.headers)
            return StreamingResponse(
                _aiter(),
                status_code=upstream.status_code,
                headers=forwarded_headers,
            )

        # Non-streaming logic -------------------------------------------
        resp = await _forward_with_retries(
            client,
            request.method,
            target_url,
            outbound_headers,
            body,
            MAX_RETRIES,
        )
        forwarded_headers = _strip_hop_headers(resp.headers)
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            headers=forwarded_headers,
        )


# ---------------------------------------------------------------------------
# Health endpoint (kept for backward compatibility)
# ---------------------------------------------------------------------------

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
