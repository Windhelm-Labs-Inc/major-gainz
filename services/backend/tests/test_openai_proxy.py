import json
import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app

STREAM_CONTENT = b"data: hello\n\n" + b"data: world\n\n"


@pytest.fixture(autouse=True)
def _set_env(monkeypatch):
    # Provide a test key so the proxy passes its config check.
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-123")


@pytest.fixture()
def client(monkeypatch):
    """Return a TestClient with httpx.AsyncClient patched to a MockTransport."""
    def handler(request: httpx.Request):
        """Mock handler that asserts key injection and returns canned responses."""
        # Assert that the proxy injected our secret key.
        assert request.headers.get("authorization") == "Bearer sk-test-123"

        # If either ?stream=true query or JSON {"stream": true} is present, return SSE payload.
        want_stream = "stream=true" in str(request.url)
        if not want_stream and request.headers.get("content-type", "").startswith("application/json"):
            try:
                body_json = json.loads(request.content.decode() or "{}")
                want_stream = bool(body_json.get("stream"))
            except ValueError:
                pass
        if want_stream:
            return httpx.Response(
                200,
                headers={"content-type": "text/event-stream"},
                content=STREAM_CONTENT,
            )

        # Regular non-streaming JSON echo.
        return httpx.Response(200, json={"echo": "ok"})

    transport = httpx.MockTransport(handler)

    # Capture original so we don't recurse.
    _OriginalAsyncClient = httpx.AsyncClient  # noqa: N806

    # Patch httpx.AsyncClient to always use our MockTransport
    def _patched_async_client(*args, **kwargs):  # noqa: ANN001
        kwargs["transport"] = transport
        return _OriginalAsyncClient(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _patched_async_client)

    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_header_injection_and_passthrough(client):  # noqa: ANN001
    payload = {"messages": [{"role": "user", "content": "Hi"}]}
    resp = client.post("/v1/chat/completions", json=payload)
    assert resp.status_code == 200
    assert resp.json() == {"echo": "ok"}



def test_streaming_response(client):  # noqa: ANN001
    payload = {"messages": [{"role": "user", "content": "stream"}]}

    with client.stream("POST", "/v1/chat/completions", json={**payload, "stream": True}) as resp:
        gathered = b"".join(resp.iter_bytes())
        assert resp.status_code == 200
        assert gathered == STREAM_CONTENT
