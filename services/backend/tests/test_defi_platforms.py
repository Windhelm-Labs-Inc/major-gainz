"""Test DeFi platform endpoints (non-position data like pools and markets)."""

import pytest
from typing import Dict, Any, List
import os

# Set environment variables for faster testing
os.environ['DEFI_TEST_MODE'] = 'true'


def check_network_error(response):
    """Check if response indicates a network error and skip test if so."""
    if response.status_code == 500:
        try:
            data = response.json()
            detail = data.get("detail", "")
            if any(phrase in detail for phrase in [
                "Network error", "Failed to establish", "Connection refused", 
                "Network is unreachable", "Connection timed out", "Name or service not known"
            ]):
                pytest.skip(f"Network unreachable - not a code issue: {detail}")
        except:
            # If we can't parse the response, just continue
            pass


def test_bonzo_pools_data(client):
    """Test GET /defi/pools/bonzo - All non-position data from Bonzo."""
    response = client.get("/defi/pools/bonzo")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate top-level structure
    required_keys = {"pools", "timestamp", "api_requests"}
    assert required_keys.issubset(data.keys())
    assert isinstance(data["pools"], list)
    assert isinstance(data["api_requests"], int)
    assert data["api_requests"] > 0
    
    # Should have multiple pools
    assert len(data["pools"]) > 0
    
    # Validate each pool structure
    for pool in data["pools"]:
        pool_required = {"symbol", "name", "supply_apy", "variable_borrow_apy", "utilization_rate"}
        assert pool_required.issubset(pool.keys())
        
        # Validate data types
        assert isinstance(pool["symbol"], str)
        assert isinstance(pool["name"], str)
        assert pool["symbol"]  # Non-empty
        assert pool["name"]    # Non-empty
        
        # APY fields should be numeric or None
        if pool["supply_apy"] is not None:
            assert isinstance(pool["supply_apy"], (int, float))
            assert pool["supply_apy"] >= 0
        
        if pool["variable_borrow_apy"] is not None:
            assert isinstance(pool["variable_borrow_apy"], (int, float))
            assert pool["variable_borrow_apy"] >= 0
        
        # Utilization rate should be 0-100 or None
        if pool["utilization_rate"] is not None:
            assert isinstance(pool["utilization_rate"], (int, float))
            assert 0 <= pool["utilization_rate"] <= 100
        
        # Liquidity amounts should be numeric
        if "available_liquidity_usd" in pool:
            assert isinstance(pool["available_liquidity_usd"], (int, float))
            assert pool["available_liquidity_usd"] >= 0
        
        if "total_supply_usd" in pool:
            assert isinstance(pool["total_supply_usd"], (int, float))
            assert pool["total_supply_usd"] >= 0
        
        if "total_borrow_usd" in pool:
            assert isinstance(pool["total_borrow_usd"], (int, float))
            assert pool["total_borrow_usd"] >= 0
    
    # Check that we have expected major tokens
    symbols = {pool["symbol"] for pool in data["pools"]}
    expected_major_tokens = {"USDC", "HBAR", "SAUCE"}  # Common tokens that should be in Bonzo
    # At least some of these should be present
    assert len(expected_major_tokens.intersection(symbols)) > 0


def test_bonzo_pools_market_health(client):
    """Test that Bonzo pool data represents healthy market conditions."""
    response = client.get("/defi/pools/bonzo")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    pools = data["pools"]
    
    # Market health checks
    total_pools = len(pools)
    pools_with_liquidity = 0
    pools_with_utilization = 0
    
    for pool in pools:
        # Count pools with meaningful liquidity
        if (pool.get("available_liquidity_usd", 0) > 1000 or 
            pool.get("total_supply_usd", 0) > 1000):
            pools_with_liquidity += 1
        
        # Count pools with utilization data
        if pool.get("utilization_rate") is not None:
            pools_with_utilization += 1
    
    # At least half the pools should have liquidity data
    assert pools_with_liquidity >= total_pools * 0.5
    
    # Most pools should have utilization data
    assert pools_with_utilization >= total_pools * 0.7


def test_saucerswap_pools_all_versions(client):
    """Test GET /defi/pools/saucerswap - All non-position data from SaucerSwap."""
    response = client.get("/defi/pools/saucerswap")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate top-level structure
    required_keys = {"pools", "timestamp", "api_requests"}
    assert required_keys.issubset(data.keys())
    assert isinstance(data["api_requests"], int)
    assert data["api_requests"] > 0
    
    # Validate pools structure
    pools = data["pools"]
    pool_types = {"v1", "v2", "farms"}
    assert pool_types.issubset(pools.keys())
    
    # Each pool type should be a list
    for pool_type in pool_types:
        assert isinstance(pools[pool_type], list)
    
    # Should have some pools in at least one category
    total_pools = len(pools["v1"]) + len(pools["v2"]) + len(pools["farms"])
    assert total_pools > 0


def test_saucerswap_pools_v1_data(client):
    """Test SaucerSwap V1 pool data structure."""
    response = client.get("/defi/pools/saucerswap?version=v1")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    pools = data["pools"]
    
    # Should only have V1 pools
    assert "v1" in pools
    assert isinstance(pools["v1"], list)
    
    # V1 pools might be empty (deprecated), so only validate structure if they exist
    if len(pools["v1"]) == 0:
        # V1 pools are deprecated, so empty list is acceptable
        return
    
    # Validate V1 pool structure if pools exist
    for pool in pools["v1"]:
        v1_required = {"id", "tokenA", "tokenB", "lpToken"}
        assert v1_required.issubset(pool.keys())
        
        # Validate pool ID
        assert isinstance(pool["id"], int)
        assert pool["id"] >= 0  # Allow pool ID 0 as it might be a valid starting ID
        
        # Validate token structures
        for token_key in ["tokenA", "tokenB"]:
            token = pool[token_key]
            assert isinstance(token, dict)
            token_required = {"symbol", "decimals"}
            assert token_required.issubset(token.keys())
            assert isinstance(token["symbol"], str)
            assert isinstance(token["decimals"], int)
            assert token["decimals"] >= 0
        
        # Validate LP token structure
        lp_token = pool["lpToken"]
        assert isinstance(lp_token, dict)
        lp_required = {"id", "symbol"}
        assert lp_required.issubset(lp_token.keys())
        
        # Validate reserves if present
        if "tokenReserveA" in pool:
            assert isinstance(pool["tokenReserveA"], (int, str))
        if "tokenReserveB" in pool:
            assert isinstance(pool["tokenReserveB"], (int, str))


def test_saucerswap_pools_v2_data(client):
    """Test SaucerSwap V2 pool data structure."""
    response = client.get("/defi/pools/saucerswap?version=v2")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    pools = data["pools"]
    
    # Should only have V2 pools
    assert "v2" in pools
    assert isinstance(pools["v2"], list)
    
    # Validate V2 pool structure if pools exist
    for pool in pools["v2"]:
        v2_required = {"tokenA", "tokenB", "fee"}
        assert v2_required.issubset(pool.keys())
        
        # Validate token structures
        for token_key in ["tokenA", "tokenB"]:
            token = pool[token_key]
            assert isinstance(token, dict)
            token_required = {"symbol", "decimals"}
            assert token_required.issubset(token.keys())
            assert isinstance(token["symbol"], str)
            assert isinstance(token["decimals"], int)
        
        # Validate fee tier
        assert isinstance(pool["fee"], int)
        assert pool["fee"] > 0
        
        # V2 specific fields
        if "liquidity" in pool:
            assert isinstance(pool["liquidity"], (int, str))
        if "sqrtRatioX96" in pool:
            assert isinstance(pool["sqrtRatioX96"], (int, str))


def test_saucerswap_farms_data(client):
    """Test SaucerSwap farms data structure."""
    response = client.get("/defi/pools/saucerswap")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    farms = data["pools"]["farms"]
    assert isinstance(farms, list)
    
    # Farms might be empty if no active farms, only validate structure if they exist
    if len(farms) == 0:
        # No active farms is acceptable
        return
    
    # Validate farm structure if farms exist
    for farm in farms:
        farm_required = {"id", "poolId"}
        assert farm_required.issubset(farm.keys())
        
        # Validate farm ID and pool ID
        assert isinstance(farm["id"], int)
        assert isinstance(farm["poolId"], int)
        assert farm["id"] >= 0  # Allow farm ID 0 as it might be a valid starting ID
        assert farm["poolId"] >= 0  # Allow pool ID 0 as it might be a valid starting ID
        
        # Validate emission fields if present
        if "sauceEmissions" in farm:
            assert isinstance(farm["sauceEmissions"], (int, float))
            assert farm["sauceEmissions"] >= 0
        
        if "hbarEmissions" in farm:
            assert isinstance(farm["hbarEmissions"], (int, float))
            assert farm["hbarEmissions"] >= 0
        
        # Validate total staked if present
        if "totalStaked" in farm:
            assert isinstance(farm["totalStaked"], (int, str))


def test_saucerswap_pools_testnet(client):
    """Test SaucerSwap pools with testnet flag."""
    response = client.get("/defi/pools/saucerswap?testnet=true")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Should still have the same structure on testnet
    required_keys = {"pools", "timestamp", "api_requests"}
    assert required_keys.issubset(data.keys())
    
    pools = data["pools"]
    pool_types = {"v1", "v2", "farms"}
    assert pool_types.issubset(pools.keys())


def test_saucerswap_pools_version_filtering(client):
    """Test that version parameter properly filters SaucerSwap pools."""
    # Test V1 only
    v1_response = client.get("/defi/pools/saucerswap?version=v1")
    check_network_error(v1_response)
    assert v1_response.status_code == 200
    v1_data = v1_response.json()
    v1_pools = v1_data["pools"]
    
    # Should have V1 but not V2 when version=v1
    assert "v1" in v1_pools
    assert "v2" not in v1_pools or len(v1_pools["v2"]) == 0
    
    # Test V2 only
    v2_response = client.get("/defi/pools/saucerswap?version=v2")
    check_network_error(v2_response)
    assert v2_response.status_code == 200
    v2_data = v2_response.json()
    v2_pools = v2_data["pools"]
    
    # Should have V2 but not V1 when version=v2
    assert "v2" in v2_pools
    assert "v1" not in v2_pools or len(v2_pools["v1"]) == 0
    
    # Test all versions
    all_response = client.get("/defi/pools/saucerswap?version=all")
    check_network_error(all_response)
    assert all_response.status_code == 200
    all_data = all_response.json()
    all_pools = all_data["pools"]
    
    # Should have all pool types when version=all
    pool_types = {"v1", "v2", "farms"}
    assert pool_types.issubset(all_pools.keys())


def test_platform_data_freshness(client):
    """Test that platform data includes timestamps and appears fresh."""
    import datetime
    
    endpoints = ["/defi/pools/bonzo", "/defi/pools/saucerswap"]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        check_network_error(response)
        assert response.status_code == 200
        
        data = response.json()
        assert "timestamp" in data
        
        # Parse timestamp and check it's reasonably recent (within last hour)
        timestamp_str = data["timestamp"]
        # Handle both timezone-aware and timezone-naive timestamps
        if timestamp_str.endswith('Z'):
            timestamp = datetime.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            timestamp = datetime.datetime.fromisoformat(timestamp_str)
            # If timezone-naive, assume UTC
            if timestamp.tzinfo is None:
                timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
        
        now = datetime.datetime.now(datetime.timezone.utc)
        time_diff = now - timestamp
        
        # Should be within the last hour (generous for testing)
        assert time_diff.total_seconds() < 3600


def test_platform_data_response_times(client):
    """Test that platform endpoints respond within reasonable time."""
    import time
    
    endpoints = ["/defi/pools/bonzo", "/defi/pools/saucerswap"]
    
    for endpoint in endpoints:
        start_time = time.time()
        response = client.get(endpoint)
        end_time = time.time()
        
        check_network_error(response)
        assert response.status_code == 200
        
        # Should respond within 30 seconds (generous for live API calls)
        response_time = end_time - start_time
        assert response_time < 30, f"Endpoint {endpoint} took {response_time:.2f}s"


def test_platform_data_non_empty(client):
    """Test that platform endpoints return meaningful data."""
    # Bonzo pools
    bonzo_response = client.get("/defi/pools/bonzo")
    check_network_error(bonzo_response)
    assert bonzo_response.status_code == 200
    bonzo_data = bonzo_response.json()
    
    # Should have at least a few pools
    assert len(bonzo_data["pools"]) >= 3
    
    # SaucerSwap pools
    saucer_response = client.get("/defi/pools/saucerswap")
    check_network_error(saucer_response)
    assert saucer_response.status_code == 200
    saucer_data = saucer_response.json()
    
    # Should have pools in at least one category
    pools = saucer_data["pools"]
    total_saucer_items = len(pools["v1"]) + len(pools["v2"]) + len(pools["farms"])
    assert total_saucer_items > 0


def test_platform_data_api_tracking(client):
    """Test that platform endpoints properly track API usage."""
    endpoints = ["/defi/pools/bonzo", "/defi/pools/saucerswap"]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code == 200
        
        data = response.json()
        assert "api_requests" in data
        assert isinstance(data["api_requests"], int)
        assert data["api_requests"] > 0


def test_platform_invalid_parameters(client):
    """Test platform endpoints with invalid parameters."""
    # Test invalid version parameter for SaucerSwap
    response = client.get("/defi/pools/saucerswap?version=invalid")
    assert response.status_code == 422  # Validation error
    
    # Test invalid testnet parameter
    response = client.get("/defi/pools/saucerswap?testnet=invalid")
    assert response.status_code == 422  # Validation error


def test_cross_platform_data_consistency(client):
    """Test that platform data is consistent with what we know about DeFi ecosystem."""
    # Get both platform data
    bonzo_response = client.get("/defi/pools/bonzo")
    saucer_response = client.get("/defi/pools/saucerswap")
    
    assert bonzo_response.status_code == 200
    assert saucer_response.status_code == 200
    
    bonzo_data = bonzo_response.json()
    saucer_data = saucer_response.json()
    
    # Extract token symbols from both platforms
    bonzo_symbols = {pool["symbol"] for pool in bonzo_data["pools"]}
    
    # Get tokens from SaucerSwap (more complex due to V1/V2 structure)
    saucer_symbols = set()
    for pool in saucer_data["pools"]["v1"]:
        saucer_symbols.add(pool["tokenA"]["symbol"])
        saucer_symbols.add(pool["tokenB"]["symbol"])
    
    for pool in saucer_data["pools"]["v2"]:
        saucer_symbols.add(pool["tokenA"]["symbol"])
        saucer_symbols.add(pool["tokenB"]["symbol"])
    
    # There should be some overlap in tokens between platforms
    common_tokens = bonzo_symbols.intersection(saucer_symbols)
    assert len(common_tokens) > 0, f"No common tokens found. Bonzo: {bonzo_symbols}, SaucerSwap: {saucer_symbols}"
    
    # Common tokens should include major ones like HBAR, USDC, SAUCE
    major_tokens = {"HBAR", "WHBAR", "USDC", "SAUCE"}
    platform_tokens = bonzo_symbols.union(saucer_symbols)
    overlap = major_tokens.intersection(platform_tokens)
    assert len(overlap) >= 2, f"Expected major tokens in platforms. Found: {overlap}"


def test_health_endpoint(client):
    """Test GET /defi/health - API health check endpoint."""
    response = client.get("/defi/health")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate health response structure
    required_keys = {"status", "protocols", "timestamp"}
    assert required_keys.issubset(data.keys())
    
    # Status should be one of expected values
    assert data["status"] in ["healthy", "degraded", "unhealthy"]
    
    # Protocols should have specific structure
    protocols = data["protocols"]
    protocol_required = {"saucerswap", "bonzo", "overall"}
    assert protocol_required.issubset(protocols.keys())
    
    # Each protocol status should be boolean
    for protocol, status in protocols.items():
        assert isinstance(status, bool)
    
    # Overall should be logical AND of individual protocols
    expected_overall = protocols["saucerswap"] and protocols["bonzo"]
    assert protocols["overall"] == expected_overall
    
    # If overall is healthy, status should be healthy
    if protocols["overall"]:
        assert data["status"] == "healthy"


def test_platform_endpoints_error_handling(client):
    """Test that platform endpoints handle errors gracefully."""
    # These should not crash even if external APIs have issues
    endpoints = [
        "/defi/pools/bonzo",
        "/defi/pools/saucerswap",
        "/defi/health"
    ]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        # Should either succeed or return a proper error response
        assert response.status_code in [200, 500, 503]
        
        # Response should always be valid JSON
        data = response.json()
        assert isinstance(data, dict)
        
        # If there's an error, it should be properly formatted
        if response.status_code != 200:
            assert "detail" in data or "error" in data