"""OpenAI API Proxy with Rate Limiting and Retry Logic

This router provides a proxy that injects the API key and handles
rate limiting with exponential backoff and retry logic.
"""

from __future__ import annotations

import os
import asyncio
import random
import time
from typing import Dict, Any
import httpx
from fastapi import APIRouter, HTTPException, Request, Response

from ..settings import logger

# Environment configuration
PROXY_TIMEOUT: float = float(os.getenv("OPENAI_PROXY_TIMEOUT", "120"))  # Increased for retries
MAX_RETRIES: int = int(os.getenv("OPENAI_MAX_RETRIES", "5"))
BASE_DELAY: float = float(os.getenv("OPENAI_BASE_DELAY", "1.0"))  # Base delay in seconds
MAX_DELAY: float = float(os.getenv("OPENAI_MAX_DELAY", "60.0"))  # Max delay in seconds

router = APIRouter(tags=["openai_proxy"])


async def calculate_backoff_delay(attempt: int, base_delay: float = BASE_DELAY, max_delay: float = MAX_DELAY) -> float:
    """Calculate exponential backoff delay with jitter."""
    # Exponential backoff: base_delay * 2^attempt
    delay = base_delay * (2 ** attempt)
    
    # Add jitter to avoid thundering herd (±25% random variation)
    jitter = delay * 0.25 * (2 * random.random() - 1)
    delay += jitter
    
    # Cap at max_delay
    return min(delay, max_delay)


async def make_openai_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    headers: Dict[str, str],
    body: bytes,
    attempt: int = 0
) -> httpx.Response:
    """Make request to OpenAI with retry logic for rate limiting."""
    
    try:
        response = await client.request(
            method=method,
            url=url,
            headers=headers,
            content=body,
        )
        
        # Handle rate limiting with exponential backoff
        if response.status_code == 429:
            if attempt < MAX_RETRIES:
                # Extract retry-after header if present
                retry_after = response.headers.get("retry-after")
                if retry_after:
                    try:
                        # OpenAI sometimes sends retry-after in seconds
                        delay = float(retry_after)
                        # Cap the delay to our max
                        delay = min(delay, MAX_DELAY)
                    except (ValueError, TypeError):
                        # Fallback to exponential backoff
                        delay = await calculate_backoff_delay(attempt)
                else:
                    delay = await calculate_backoff_delay(attempt)
                
                logger.warning(
                    "Rate limited (429) on attempt %d/%d for %s %s. Retrying in %.2fs",
                    attempt + 1, MAX_RETRIES + 1, method, url, delay
                )
                
                await asyncio.sleep(delay)
                return await make_openai_request(client, method, url, headers, body, attempt + 1)
            else:
                logger.error(
                    "Max retries (%d) exceeded for %s %s. Returning 429.",
                    MAX_RETRIES, method, url
                )
                
        # Handle other server errors with limited retry
        elif response.status_code >= 500 and attempt < 2:  # Only retry server errors twice
            delay = await calculate_backoff_delay(attempt, base_delay=0.5, max_delay=5.0)
            logger.warning(
                "Server error (%d) on attempt %d/3 for %s %s. Retrying in %.2fs",
                response.status_code, attempt + 1, method, url, delay
            )
            await asyncio.sleep(delay)
            return await make_openai_request(client, method, url, headers, body, attempt + 1)
            
        return response
        
    except httpx.TimeoutException:
        if attempt < 2:  # Retry timeouts twice
            delay = await calculate_backoff_delay(attempt, base_delay=2.0, max_delay=10.0)
            logger.warning(
                "Request timeout on attempt %d/3 for %s %s. Retrying in %.2fs",
                attempt + 1, method, url, delay
            )
            await asyncio.sleep(delay)
            return await make_openai_request(client, method, url, headers, body, attempt + 1)
        else:
            logger.error("Request timeout after 3 attempts for %s %s", method, url)
            raise
    
    except Exception as e:
        logger.error("Unexpected error for %s %s: %s", method, url, str(e))
        raise


@router.api_route("/v1/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def openai_proxy(full_path: str, request: Request):
    """Proxy with rate limiting, exponential backoff, and retry logic."""

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

    start_time = time.time()
    logger.debug("Proxying %s %s", request.method, target_url)

    try:
        # Make request with retry logic
        async with httpx.AsyncClient(timeout=PROXY_TIMEOUT) as client:
            response = await make_openai_request(
                client=client,
                method=request.method,
                url=target_url,
                headers=headers,
                body=body
            )
            
            elapsed = time.time() - start_time
            logger.debug(
                "Proxy completed %s %s in %.2fs (status: %d)",
                request.method, target_url, elapsed, response.status_code
            )
            
            # Forward response exactly as received
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=dict(response.headers),
            )
            
    except httpx.TimeoutException:
        elapsed = time.time() - start_time
        logger.error("Proxy timeout after %.2fs for %s %s", elapsed, request.method, target_url)
        raise HTTPException(status_code=504, detail="OpenAI API request timed out")
        
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "Proxy error after %.2fs for %s %s: %s",
            elapsed, request.method, target_url, str(e)
        )
        raise HTTPException(status_code=502, detail=f"OpenAI API request failed: {str(e)}")


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