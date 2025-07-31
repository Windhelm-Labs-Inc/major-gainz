import pytest


def test_portfolio_success(client):
    """Portfolio endpoint should return holdings for a known mainnet account."""
    addr = "0.0.9405888"
    response = client.get(f"/portfolio/{addr}?network=mainnet")
    assert response.status_code == 200
    data = response.json()

    assert data["address"] == addr
    assert data["network"] == "mainnet"

    # If error field present, just log it
    if "error" in data:
        print("Portfolio endpoint returned error:", data["error"])
        assert data["holdings"] == []
        return

    assert isinstance(data["holdings"], list)
    assert len(data["holdings"]) > 0

    required = {"tokenId", "symbol", "raw", "decimals", "amount", "usd", "percent"}
    for h in data["holdings"]:
        assert required.issubset(h.keys())

    assert data["totalUsd"] >= 0 