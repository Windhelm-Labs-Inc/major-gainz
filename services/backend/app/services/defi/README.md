# DeFi Integration Module

This module provides comprehensive DeFi portfolio aggregation for Hedera accounts across multiple protocols including SaucerSwap and Bonzo Finance.

## Overview

The DeFi integration module consists of:

- **Protocol-specific clients** for data retrieval with rate limiting and error handling
- **Unified profile service** that aggregates data across protocols  
- **Risk analysis capabilities** for liquidity and credit risk assessment
- **FastAPI endpoints** for easy API access

## Architecture

```
app/services/defi/
├── __init__.py              # Module exports
├── base_client.py           # Base API client with rate limiting
├── saucerswap_client.py     # SaucerSwap API integration
├── bonzo_client.py          # Bonzo Finance API integration
├── defi_profile_service.py  # Unified profile service
├── config.py                # Configuration and API keys
└── README.md               # This file
```

## Features

### SaucerSwap Integration
- **V1 Liquidity Pools**: Retrieves LP token holdings and calculates underlying assets
- **V2 Concentrated Liquidity**: NFT-based positions with tick ranges
- **Yield Farming**: Staked LP positions in farms with rewards tracking
- **Vaults**: Single-sided staking (e.g., xSAUCE) and Auto Pool vaults
- **Risk Analysis**: Impermanent loss risk, concentration risk, liquidity risk

### Bonzo Finance Integration  
- **Lending Positions**: Supplied assets used as collateral
- **Borrowing Positions**: Debt positions with interest rates
- **Health Metrics**: Health factor, LTV ratios, liquidation thresholds
- **Risk Analysis**: Liquidation risk, pool utilization, liquidity constraints

### Cross-Protocol Analysis
- **Portfolio Aggregation**: Combined view across all protocols
- **Risk Assessment**: Cross-protocol risk factors and recommendations
- **Health Monitoring**: Overall portfolio health indicators

## Configuration

API keys are loaded from `frontend/appSettings.json`:

```json
{
  "SAUCER_SWAP_API_KEY": "your_saucerswap_api_key",
  "OPENAI_API_KEY": "your_openai_key",
  "WALLETCONNECT_PROJECT_ID": "your_walletconnect_id"
}
```

Rate limiting and retry configuration in `config.py`:
- **Max Retries**: 5 attempts with exponential backoff
- **Request Timeout**: 30 seconds
- **Rate Limiting**: 100ms between requests
- **Backoff Factor**: 2x increase per retry

## Usage

### Basic Profile Retrieval

```python
from app.services.defi import DeFiProfileService

service = DeFiProfileService()
profile = await service.get_defi_profile("0.0.9405888")

print(f"Protocols active: {profile['summary']['protocols_active']}")
print(f"Total positions: {profile['summary']['total_positions']}")
```

### Protocol-Specific Data

```python
from app.services.defi import SaucerSwapClient, BonzoClient

# SaucerSwap only
ss_client = SaucerSwapClient()
ss_portfolio = ss_client.get_portfolio("0.0.9405888")

# Bonzo only  
bonzo_client = BonzoClient()
bonzo_portfolio = bonzo_client.fetch_account_portfolio("0.0.9405888")
```

## API Endpoints

### Get Complete DeFi Profile
```
GET /defi/profile/{account_id}
```

**Parameters:**
- `account_id`: Hedera account ID (format: `shard.realm.num`)
- `include_risk_analysis`: Include risk analysis (default: `true`)
- `testnet`: Use testnet APIs (default: `false`)

**Response:**
```json
{
  "account_id": "0.0.9405888",
  "timestamp": "2024-01-01T12:00:00Z",
  "bonzo_finance": {
    "supplied": [...],
    "borrowed": [...], 
    "health_factor": 2.5
  },
  "saucer_swap": {
    "pools_v1": [...],
    "pools_v2": [...],
    "farms": [...],
    "vaults": [...]
  },
  "risk_analysis": {
    "saucerswap_risks": {...},
    "bonzo_risks": {...},
    "cross_protocol_analysis": {...}
  },
  "summary": {
    "protocols_active": ["saucerswap", "bonzo"],
    "total_positions": 5,
    "activity_level": "moderate"
  }
}
```

### Protocol-Specific Endpoints

- `GET /defi/profile/{account_id}/saucerswap` - SaucerSwap only
- `GET /defi/profile/{account_id}/bonzo` - Bonzo Finance only
- `GET /defi/pools/saucerswap` - SaucerSwap pool data
- `GET /defi/pools/bonzo` - Bonzo market data
- `GET /defi/health` - API health check

## Error Handling

The module implements comprehensive error handling:

- **Rate Limiting**: Automatic retry with exponential backoff
- **Service Unavailable**: Graceful degradation when APIs are down
- **Invalid Accounts**: Clear error messages for malformed account IDs
- **Partial Failures**: Continue processing when one protocol fails

## Risk Analysis

### SaucerSwap Risks
- **Low Liquidity**: Pools with <$10K TVL flagged as high risk
- **Impermanent Loss**: Risk categorization based on token volatility
- **Concentration Risk**: High pool ownership percentage

### Bonzo Risks  
- **Liquidation Risk**: Health factor <1.2 flagged as at-risk
- **Pool Utilization**: >90% utilization flagged as high risk
- **Liquidity Constraints**: <$1K available liquidity flagged

### Cross-Protocol Risks
- **Overall Exposure**: High DeFi exposure across protocols
- **Correlation Risk**: Correlated positions across platforms
- **Health Monitoring**: Combined health factor assessment

## Testing

Run the integration test suite:

```bash
cd services/backend
python test_defi_integration.py
```

This tests:
- API connectivity and health checks
- Data retrieval for test account `0.0.9405888`  
- Risk analysis functionality
- Profile aggregation across protocols

## Logging

All operations are logged using the established logging framework:

- **INFO**: Profile requests and major operations
- **DEBUG**: API request details and processing steps  
- **WARNING**: Recoverable errors and retries
- **ERROR**: Unrecoverable errors and failures

## Rate Limits

### SaucerSwap
- Monthly quota system with `x-ratelimit-*` headers
- Burst buffer available on request
- Current demo key globally rate limited

### Bonzo Finance
- No authentication required
- Public API with reasonable use expectations
- Built-in rate limiting for protection

## Dependencies

- `requests`: HTTP client with retry logic
- `pandas`: Data manipulation (SaucerSwap client)
- `numpy`: Numerical operations (SaucerSwap client)
- `asyncio`: Concurrent execution
- `fastapi`: API framework
- `logging`: Centralized logging

## Future Enhancements

- Additional protocol integrations (HeliSwap, Pangolin, etc.)
- Real-time portfolio monitoring with WebSocket support  
- Portfolio performance analytics and historical tracking
- Advanced risk modeling with correlation analysis
- Automated rebalancing recommendations
- DeFi yield optimization suggestions