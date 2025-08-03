import os
import pytest
import httpx

from app.services.saucerswap_ohlcv import SaucerSwapOHLCVService


@pytest.mark.asyncio
async def test_hbar_alias(monkeypatch):
    """Requesting 0.0.0 must call SaucerSwap with 0.0.1456986."""
    os.environ.setdefault("SAUCER_SWAP_API_KEY", "dummy")
    svc = SaucerSwapOHLCVService()

    captured = {}

    async def fake_get(self, url, headers=None, params=None):
        captured["url"] = url
        class _Resp:
            status_code = 200
            def json(self):
                return []
            def raise_for_status(self):
                pass
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get, raising=True)

    await svc.fetch_ohlcv_data("0.0.0", days=1)

    assert "0.0.1456986" in captured["url"], captured["url"]


@pytest.mark.asyncio
async def test_no_alias(monkeypatch):
    """IDs without alias should be forwarded unchanged."""
    os.environ.setdefault("SAUCER_SWAP_API_KEY", "dummy")
    svc = SaucerSwapOHLCVService()

    captured = {}

    async def fake_get(self, url, headers=None, params=None):
        captured["url"] = url
        class _Resp:
            status_code = 200
            def json(self):
                return []
            def raise_for_status(self):
                pass
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "get", fake_get, raising=True)

    await svc.fetch_ohlcv_data("0.0.456858", days=1)

    assert "0.0.456858" in captured["url"], captured["url"]