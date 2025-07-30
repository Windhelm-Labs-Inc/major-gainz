"""Test DeFi position endpoints (user-specific portfolio data)."""

import pytest
from typing import Dict, Any
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


# Test account with known DeFi positions
TEST_ACCOUNT = "0.0.9405888"


def test_all_defi_positions_success(client):
    """Test GET /defi/profile/{account_id} - All positions across protocols."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate top-level structure
    required_keys = {"account_id", "timestamp", "bonzo_finance", "saucer_swap", "summary"}
    assert required_keys.issubset(data.keys())
    assert data["account_id"] == TEST_ACCOUNT
    
    # Validate Bonzo Finance structure
    bonzo = data["bonzo_finance"]
    bonzo_required = {"account_id", "supplied", "borrowed"}
    assert bonzo_required.issubset(bonzo.keys())
    assert isinstance(bonzo["supplied"], list)
    assert isinstance(bonzo["borrowed"], list)
    
    # If there are supplied assets, validate structure
    for asset in bonzo["supplied"]:
        asset_required = {"symbol", "amount", "amount_str", "usd_value", "usd_value_str", "collateral"}
        assert asset_required.issubset(asset.keys())
        assert isinstance(asset["amount"], (int, float))
        assert isinstance(asset["usd_value"], (int, float))
        assert isinstance(asset["collateral"], bool)
    
    # If there are borrowed assets, validate structure
    for asset in bonzo["borrowed"]:
        asset_required = {"symbol", "amount", "amount_str", "usd_value", "usd_value_str"}
        assert asset_required.issubset(asset.keys())
        assert isinstance(asset["amount"], (int, float))
        assert isinstance(asset["usd_value"], (int, float))
    
    # Validate SaucerSwap structure
    saucer = data["saucer_swap"]
    saucer_required = {"address", "pools_v1", "pools_v2", "farms", "vaults"}
    assert saucer_required.issubset(saucer.keys())
    assert saucer["address"] == TEST_ACCOUNT
    
    for pool_type in ["pools_v1", "pools_v2", "farms", "vaults"]:
        assert isinstance(saucer[pool_type], list)
    
    # Validate V1 pool positions if present
    for position in saucer["pools_v1"]:
        v1_required = {"poolId", "tokenA", "tokenB", "lpTokenId", "lpTokenBalance", "sharePercentage"}
        assert v1_required.issubset(position.keys())
        assert isinstance(position["poolId"], int)
        assert isinstance(position["lpTokenBalance"], int)
        assert isinstance(position["sharePercentage"], (int, float))
    
    # Validate V2 pool positions if present
    for position in saucer["pools_v2"]:
        v2_required = {"token0", "token1", "liquidity"}
        assert v2_required.issubset(position.keys())
    
    # Validate farm positions if present
    for position in saucer["farms"]:
        farm_required = {"farmId", "poolId", "stakedLP"}
        assert farm_required.issubset(position.keys())
        assert isinstance(position["stakedLP"], int)
    
    # Validate vault positions if present
    for position in saucer["vaults"]:
        vault_required = {"vault", "tokenId", "balance"}
        assert vault_required.issubset(position.keys())
        assert isinstance(position["balance"], int)
    
    # Validate summary
    summary = data["summary"]
    summary_required = {"protocols_active", "total_positions", "position_breakdown", "activity_level"}
    assert summary_required.issubset(summary.keys())
    assert isinstance(summary["protocols_active"], list)
    assert isinstance(summary["total_positions"], int)
    assert isinstance(summary["position_breakdown"], dict)
    assert summary["activity_level"] in ["inactive", "light", "moderate", "heavy"]


def test_all_defi_positions_with_risk_analysis(client):
    """Test GET /defi/profile/{account_id} with risk analysis enabled."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}?include_risk_analysis=true")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Should include risk analysis
    assert "risk_analysis" in data
    risk_analysis = data["risk_analysis"]
    
    risk_required = {"saucerswap_risks", "bonzo_risks", "cross_protocol_analysis"}
    assert risk_required.issubset(risk_analysis.keys())
    
    # Validate cross-protocol analysis
    cross_analysis = risk_analysis["cross_protocol_analysis"]
    cross_required = {"overall_risk_level", "risk_factors", "recommendations"}
    assert cross_required.issubset(cross_analysis.keys())
    assert cross_analysis["overall_risk_level"] in ["low", "medium", "high"]
    assert isinstance(cross_analysis["risk_factors"], list)
    assert isinstance(cross_analysis["recommendations"], list)


def test_all_defi_positions_without_risk_analysis(client):
    """Test GET /defi/profile/{account_id} with risk analysis disabled."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}?include_risk_analysis=false")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Should not include risk analysis
    assert "risk_analysis" not in data or data.get("risk_analysis") is None


def test_saucer_positions_only(client):
    """Test GET /defi/profile/{account_id}/saucerswap - SaucerSwap positions only."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}/saucerswap")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate SaucerSwap-specific structure
    required_keys = {"address", "pools_v1", "pools_v2", "farms", "vaults", "metadata"}
    assert required_keys.issubset(data.keys())
    assert data["address"] == TEST_ACCOUNT
    
    # Validate metadata
    metadata = data["metadata"]
    assert metadata["protocol"] == "saucerswap"
    assert isinstance(metadata["api_requests"], int)
    
    # Validate each position type is a list
    for pool_type in ["pools_v1", "pools_v2", "farms", "vaults"]:
        assert isinstance(data[pool_type], list)
    
    # Check specific position structures if positions exist
    for v1_pos in data["pools_v1"]:
        v1_required = {"poolId", "tokenA", "tokenB", "lpTokenId", "lpTokenBalance"}
        assert v1_required.issubset(v1_pos.keys())
    
    for v2_pos in data["pools_v2"]:
        v2_required = {"token0", "token1", "liquidity"}
        assert v2_required.issubset(v2_pos.keys())
    
    for farm_pos in data["farms"]:
        farm_required = {"farmId", "poolId", "stakedLP"}
        assert farm_required.issubset(farm_pos.keys())
    
    for vault_pos in data["vaults"]:
        vault_required = {"vault", "tokenId", "balance"}
        assert vault_required.issubset(vault_pos.keys())


def test_saucer_positions_testnet(client):
    """Test GET /defi/profile/{account_id}/saucerswap with testnet flag."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}/saucerswap?testnet=true")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    assert data["address"] == TEST_ACCOUNT
    
    # Should still have the same structure even on testnet
    required_keys = {"address", "pools_v1", "pools_v2", "farms", "vaults"}
    assert required_keys.issubset(data.keys())


def test_bonzo_positions_only(client):
    """Test GET /defi/profile/{account_id}/bonzo - Bonzo Finance positions only."""
    response = client.get(f"/defi/profile/{TEST_ACCOUNT}/bonzo")
    check_network_error(response)
    assert response.status_code == 200
    
    data = response.json()
    
    # Validate Bonzo-specific structure
    required_keys = {"account_id", "supplied", "borrowed", "metadata"}
    assert required_keys.issubset(data.keys())
    assert data["account_id"] == TEST_ACCOUNT
    
    # Validate metadata
    metadata = data["metadata"]
    assert metadata["protocol"] == "bonzo"
    assert isinstance(metadata["api_requests"], int)
    
    # Validate position lists
    assert isinstance(data["supplied"], list)
    assert isinstance(data["borrowed"], list)
    
    # Validate supplied assets structure
    for asset in data["supplied"]:
        supplied_required = {"symbol", "amount", "amount_str", "usd_value", "usd_value_str", "collateral"}
        assert supplied_required.issubset(asset.keys())
        assert isinstance(asset["amount"], (int, float))
        assert asset["amount"] >= 0
        assert isinstance(asset["usd_value"], (int, float))
        assert asset["usd_value"] >= 0
        assert isinstance(asset["collateral"], bool)
        assert asset["symbol"]  # Non-empty string
        assert "$" in asset["usd_value_str"]
    
    # Validate borrowed assets structure
    for asset in data["borrowed"]:
        borrowed_required = {"symbol", "amount", "amount_str", "usd_value", "usd_value_str"}
        assert borrowed_required.issubset(asset.keys())
        assert isinstance(asset["amount"], (int, float))
        assert asset["amount"] >= 0
        assert isinstance(asset["usd_value"], (int, float))
        assert asset["usd_value"] >= 0
        assert asset["symbol"]  # Non-empty string
        assert "$" in asset["usd_value_str"]
        
        # Check interest rate fields if present
        if "stable_rate" in asset and asset["stable_rate"]:
            assert "%" in asset["stable_rate"]
        if "variable_rate" in asset and asset["variable_rate"]:
            assert "%" in asset["variable_rate"]
    
    # Validate health metrics if user has positions
    if data["supplied"] or data["borrowed"]:
        # Check for health factor
        if "health_factor" in data and data["health_factor"] is not None:
            assert isinstance(data["health_factor"], (int, float))
            assert data["health_factor"] > 0
        
        # Check for LTV if present (LTV can be returned as percentage value)
        if "current_ltv" in data and data["current_ltv"] is not None:
            assert isinstance(data["current_ltv"], (int, float))
            assert data["current_ltv"] >= 0  # LTV should be non-negative


def test_invalid_account_id_format(client):
    """Test position endpoints with invalid account ID format."""
    invalid_accounts = ["invalid", "123", "0.0", "0.0.abc", "1.2.3.4.5"]
    
    endpoints = [
        "/defi/profile",
        "/defi/profile/{}/saucerswap", 
        "/defi/profile/{}/bonzo"
    ]
    
    for account in invalid_accounts:
        for endpoint_template in endpoints:
            endpoint = endpoint_template.format(account) if "{}" in endpoint_template else f"{endpoint_template}/{account}"
            response = client.get(endpoint)
            assert response.status_code == 400
            data = response.json()
            assert "Invalid account ID format" in data["detail"]


def test_positions_with_nonexistent_account(client):
    """Test position endpoints with a valid but non-existent account."""
    nonexistent_account = "0.0.999999999"
    
    endpoints = [
        f"/defi/profile/{nonexistent_account}",
        f"/defi/profile/{nonexistent_account}/saucerswap",
        f"/defi/profile/{nonexistent_account}/bonzo"
    ]
    
    for endpoint in endpoints:
        response = client.get(endpoint)
        # Should still return 200 with empty positions
        assert response.status_code == 200
        data = response.json()
        
        if "bonzo_finance" in data:
            # Complete profile
            assert data["account_id"] == nonexistent_account
            assert isinstance(data["bonzo_finance"]["supplied"], list)
            assert isinstance(data["saucer_swap"]["pools_v1"], list)
        elif "supplied" in data:
            # Bonzo only
            assert data["account_id"] == nonexistent_account
            assert isinstance(data["supplied"], list)
        else:
            # SaucerSwap only
            assert data["address"] == nonexistent_account
            assert isinstance(data["pools_v1"], list)


def test_positions_response_times(client):
    """Test that position endpoints respond within reasonable time."""
    import time
    
    endpoints = [
        f"/defi/profile/{TEST_ACCOUNT}",
        f"/defi/profile/{TEST_ACCOUNT}/saucerswap",
        f"/defi/profile/{TEST_ACCOUNT}/bonzo"
    ]
    
    for endpoint in endpoints:
        start_time = time.time()
        response = client.get(endpoint)
        end_time = time.time()
        
        assert response.status_code == 200
        
        # Should respond within 30 seconds (generous for live API calls)
        response_time = end_time - start_time
        assert response_time < 30, f"Endpoint {endpoint} took {response_time:.2f}s"


def test_positions_data_consistency(client):
    """Test that position data is consistent across different endpoints."""
    # Get complete profile
    complete_response = client.get(f"/defi/profile/{TEST_ACCOUNT}")
    check_network_error(complete_response)
    assert complete_response.status_code == 200
    complete_data = complete_response.json()
    
    # Get individual protocol data
    saucer_response = client.get(f"/defi/profile/{TEST_ACCOUNT}/saucerswap")
    bonzo_response = client.get(f"/defi/profile/{TEST_ACCOUNT}/bonzo")
    
    check_network_error(saucer_response)
    check_network_error(bonzo_response)
    assert saucer_response.status_code == 200
    assert bonzo_response.status_code == 200
    
    saucer_data = saucer_response.json()
    bonzo_data = bonzo_response.json()
    
    # Verify consistency between complete profile and individual calls
    # (allowing for slight timing differences in API calls)
    
    # SaucerSwap consistency
    complete_saucer = complete_data["saucer_swap"]
    assert len(complete_saucer["pools_v1"]) == len(saucer_data["pools_v1"])
    assert len(complete_saucer["pools_v2"]) == len(saucer_data["pools_v2"])
    assert len(complete_saucer["farms"]) == len(saucer_data["farms"])
    assert len(complete_saucer["vaults"]) == len(saucer_data["vaults"])
    
    # Bonzo consistency
    complete_bonzo = complete_data["bonzo_finance"]
    assert len(complete_bonzo["supplied"]) == len(bonzo_data["supplied"])
    assert len(complete_bonzo["borrowed"]) == len(bonzo_data["borrowed"])
    
    # Account IDs should match
    assert complete_bonzo["account_id"] == bonzo_data["account_id"] == TEST_ACCOUNT
    assert complete_saucer["address"] == saucer_data["address"] == TEST_ACCOUNT