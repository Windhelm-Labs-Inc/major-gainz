import os
import time
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


class RecordingForwardingTransport(httpx.AsyncBaseTransport):
    """Spy transport that records the outbound request then forwards it."""

    def __init__(self, original_async_client_cls: type[httpx.AsyncClient]):
        self._original_async_client_cls = original_async_client_cls
        self.last_request: httpx.Request | None = None

    async def handle_async_request(
        self, request: httpx.Request
    ) -> httpx.Response:  # noqa: D401  (fastapi response is fine)
        self.last_request = request
        # Forward using a real AsyncClient so we hit api.openai.com.
        async with self._original_async_client_cls() as live:
            upstream_resp = await live.send(request)
            # Read the bytes so we can rebuild the response without gzip header.
            raw = await upstream_resp.aread()
            headers = dict(upstream_resp.headers)
            # Remove Content-Encoding so downstream client doesn't double-decompress.
            headers.pop("Content-Encoding", None)
            headers.pop("content-encoding", None)
            headers.pop("Content-Length", None)
            return httpx.Response(
                status_code=upstream_resp.status_code,
                headers=headers,
                content=raw,
                request=request,
            )


@pytest.mark.openai_live
def test_live_openai_completion(monkeypatch):
    """End-to-end test that actually hits api.openai.com via the proxy."""

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key.startswith("sk-test"):
        pytest.skip("OPENAI_API_KEY is not configured for live proxy test")

    # Capture original so we don't recurse when spy forwards the request.
    _OriginalAsyncClient = httpx.AsyncClient  # noqa: N806

    spy_transport = RecordingForwardingTransport(_OriginalAsyncClient)

    # Patch httpx.AsyncClient constructor inside the app to use our spy transport.
    def _patched_async_client(*args, **kwargs):  # noqa: ANN001
        kwargs["transport"] = spy_transport
        return _OriginalAsyncClient(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _patched_async_client)

    client = TestClient(app)

    start = time.time()
    response = client.post(
        "/v1/chat/completions",
        json={
            "model": "gpt-3.5-turbo",
            "messages": [{"role": "user", "content": "Say hello"}],
            "max_tokens": 5,
            "temperature": 0,
        },
        timeout=20,
    )
    duration = (time.time() - start) * 1000  # ms

    # Basic assertions ---------------------------------------------------
    assert response.status_code == 200, response.text
    data = response.json()
    assert "choices" in data, data

    # Spy assertions -----------------------------------------------------
    assert spy_transport.last_request is not None, "Upstream request was not captured"
    auth_header = spy_transport.last_request.headers.get("authorization")
    assert auth_header == f"Bearer {api_key}"

    # Optional: log duration so developers see latency.
    print(f"\nLive completion round-trip took {duration:.1f} ms\n")
