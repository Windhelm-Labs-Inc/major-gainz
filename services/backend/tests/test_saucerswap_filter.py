import pytest

from app.settings import TOKENS_ENABLED


def check_network_error(response):
    if response.status_code == 500:
        try:
            detail = response.json().get("detail", "")
            if any(msg in detail for msg in [
                "Network error", "Failed to establish", "Connection refused",
                "Network is unreachable", "Connection timed out", "Name or service not known",
            ]):
                pytest.skip(f"Network unreachable – not a code issue: {detail}")
        except Exception:
            pass


def test_saucerswap_pools_only_enabled_tokens(client):
    """Ensure SaucerSwap pools only contain tokens in the allow-list."""
    resp = client.get("/defi/pools/saucerswap")
    check_network_error(resp)
    assert resp.status_code == 200

    data = resp.json()
    allowed = {s.upper() for s in TOKENS_ENABLED.keys()}

    # V1 pools: both tokens must be enabled
    v1_pools = data["pools"].get("v1", [])
    for pool in v1_pools:
        ta = (pool.get("tokenA", {}) or {}).get("symbol", "").upper()
        tb = (pool.get("tokenB", {}) or {}).get("symbol", "").upper()
        assert ta in allowed and tb in allowed, f"V1 pool {pool.get('id')} contains unsupported tokens: {ta}/{tb}"

    # V2 pools: at least one token must be enabled (legacy rule)
    v2_pools = data["pools"].get("v2", [])
    for pool in v2_pools:
        ta = (pool.get("tokenA", {}) or {}).get("symbol", "").upper()
        tb = (pool.get("tokenB", {}) or {}).get("symbol", "").upper()
        assert ta in allowed or tb in allowed, f"V2 pool {pool.get('id')} contains unsupported tokens: {ta}/{tb}"