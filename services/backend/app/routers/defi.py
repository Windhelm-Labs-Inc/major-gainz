"""DeFi profile API endpoints."""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any
from functools import lru_cache
import time
from datetime import datetime
import re

from ..settings import logger
from ..services.defi import DeFiProfileService

router = APIRouter(prefix="/defi", tags=["defi"])

# Global service instance (could be dependency injected in production)
defi_service = DeFiProfileService()


def validate_account_id(account_id: str) -> str:
    """Validate Hedera account ID format (shard.realm.num)."""
    pattern = r'^\d+\.\d+\.\d+$'
    if not re.match(pattern, account_id):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid account ID format. Expected format: shard.realm.num (e.g., 0.0.9405888)"
        )
    return account_id


@router.get("/positions/{account_id}")
async def get_defi_positions(
    account_id: str,
    network: str = Query("mainnet", pattern="^(mainnet|testnet)$"),
) -> Dict[str, Any]:
    """Return condensed DeFi positions for `useMGPortfolio` expectations.

    Shape:
    {
      totalValueLocked: number,
      positionCount: number,
      saucerSwap?: any,
      bonzoFinance?: any
    }
    """
    account_id = validate_account_id(account_id)
    testnet = network == "testnet"

    service = DeFiProfileService(testnet=testnet) if testnet else defi_service
    try:
        profile = await service.get_defi_profile(
            account_id=account_id, include_risk_analysis=False
        )
    finally:
        if testnet:
            service.cleanup()

    saucer = profile.get("saucer_swap") or {}
    bonzo = profile.get("bonzo_finance") or {}

    def _count_positions() -> int:
        count = 0
        for key in ("pools_v1", "pools_v2", "farms", "vaults"):
            seq = saucer.get(key)
            if isinstance(seq, list):
                count += len(seq)
        for key in ("supplied", "borrowed"):
            seq = bonzo.get(key)
            if isinstance(seq, list):
                count += len(seq)
        return count

    def _total_value_locked() -> float:
        total = 0.0
        for lst in (saucer.get("pools_v1", []), saucer.get("pools_v2", []), saucer.get("farms", []), saucer.get("vaults", [])):
            for pos in (lst or []):
                val = pos.get("underlyingValueUSD")
                if isinstance(val, (int, float)):
                    total += float(val)
        for pos in (bonzo.get("supplied") or []):
            val = pos.get("usd_value") or pos.get("usdValue")
            if isinstance(val, (int, float)):
                total += float(val)
        return total

    return {
        "totalValueLocked": _total_value_locked(),
        "positionCount": _count_positions(),
        "saucerSwap": saucer,
        "bonzoFinance": bonzo,
    }

@router.get("/profile/{account_id}")
async def get_defi_profile(
    account_id: str,
    include_risk_analysis: bool = Query(True, description="Include risk analysis in response"),
    testnet: bool = Query(False, description="Use testnet APIs")
) -> Dict[str, Any]:
    """
    Get comprehensive DeFi profile for a Hedera account across all supported protocols.
    
    Returns portfolio data from:
    - SaucerSwap (V1/V2 pools, farms, vaults)
    - Bonzo Finance (lending/borrowing positions)
    
    **Parameters:**
    - **account_id**: Hedera account ID in format shard.realm.num (e.g., 0.0.9405888)
    - **include_risk_analysis**: Include cross-protocol risk analysis
    - **testnet**: Use testnet APIs (currently only affects SaucerSwap)
    
    **Response Format:**
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
        "risk_analysis": {...},
        "summary": {...}
    }
    ```
    """
    # Validate account ID format
    account_id = validate_account_id(account_id)
    
    logger.info(f"DeFi profile requested for account {account_id} (testnet={testnet})")
    
    try:
        # Use testnet service if requested
        service = DeFiProfileService(testnet=testnet) if testnet else defi_service
        
        profile = await service.get_defi_profile(
            account_id=account_id,
            include_risk_analysis=include_risk_analysis
        )
        
        # Clean up testnet service if created
        if testnet:
            service.cleanup()
        
        return profile
        
    except Exception as e:
        logger.error(f"Error generating DeFi profile for {account_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate DeFi profile: {str(e)}"
        )


@router.get("/profile/{account_id}/saucerswap")
async def get_saucerswap_profile(
    account_id: str,
    testnet: bool = Query(False, description="Use testnet API")
) -> Dict[str, Any]:
    """
    Get SaucerSwap-only profile for a Hedera account.
    
    **Parameters:**
    - **account_id**: Hedera account ID in format shard.realm.num
    - **testnet**: Use testnet API
    
    **Returns:**
    Portfolio data including V1/V2 pools, farms, and vaults.
    """
    account_id = validate_account_id(account_id)
    
    logger.info(f"SaucerSwap profile requested for account {account_id}")
    
    try:
        service = DeFiProfileService(testnet=testnet)
        portfolio = service._fetch_saucerswap_data(account_id)
        
        if testnet:
            service.cleanup()
        
        if portfolio.get("error"):
            raise HTTPException(
                status_code=500,
                detail=f"SaucerSwap API error: {portfolio['error']}"
            )
        
        return portfolio
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching SaucerSwap profile for {account_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch SaucerSwap profile: {str(e)}"
        )


@router.get("/profile/{account_id}/bonzo")
async def get_bonzo_profile(account_id: str) -> Dict[str, Any]:
    """
    Get Bonzo Finance-only profile for a Hedera account.
    
    **Parameters:**
    - **account_id**: Hedera account ID in format shard.realm.num
    
    **Returns:**
    Lending portfolio data including supplied assets, borrowed assets, and health metrics.
    """
    account_id = validate_account_id(account_id)
    
    logger.info(f"Bonzo profile requested for account {account_id}")
    
    try:
        portfolio = defi_service._fetch_bonzo_data(account_id)
        
        if portfolio.get("error"):
            raise HTTPException(
                status_code=500,
                detail=f"Bonzo API error: {portfolio['error']}"
            )
        
        return portfolio
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching Bonzo profile for {account_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Bonzo profile: {str(e)}"
        )


@router.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    Check health status of all DeFi protocol APIs.
    
    **Returns:**
    Status of SaucerSwap, Bonzo Finance, and overall service health.
    """
    logger.info("DeFi service health check requested")
    
    try:
        health_status = await defi_service.health_check()
        
        return {
            "status": "healthy" if health_status["overall"] else "degraded",
            "protocols": health_status,
            "timestamp": defi_service._get_timestamp()
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "protocols": {
                "saucerswap": False,
                "bonzo": False,
                "overall": False
            },
            "timestamp": defi_service._get_timestamp()
        }


@router.get("/pools/saucerswap")
async def get_saucerswap_pools(
    version: Optional[str] = Query(None, pattern="^(v1|v2|all)$", description="Pool version (v1, v2, or all)"),
    testnet: bool = Query(False, description="Use testnet API")
) -> Dict[str, Any]:
    """
    Get SaucerSwap pool information.
    
    **Parameters:**
    - **version**: Pool version to fetch (v1, v2, or all)
    - **testnet**: Use testnet API
    
    **Returns:**
    Pool data including liquidity, APYs, and token information.
    """
    logger.info(f"SaucerSwap pools requested (version={version}, testnet={testnet})")
    
    try:
        service = DeFiProfileService(testnet=testnet)
        
        pools_data = {}
        
        if version in (None, "all", "v1"):
            pools_data["v1"] = service.saucerswap.get_all_pools_v1()
        
        if version in (None, "all", "v2"):
            pools_data["v2"] = service.saucerswap.get_all_pools_v2()
        
        if version in (None, "all"):
            pools_data["farms"] = service.saucerswap.get_all_farms()
        
        if testnet:
            service.cleanup()
        
        return {
            "pools": pools_data,
            "timestamp": service._get_timestamp(),
            "api_requests": service.saucerswap.get_request_count()
        }
        
    except Exception as e:
        logger.error(f"Error fetching SaucerSwap pools: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch SaucerSwap pools: {str(e)}"
        )


@router.get("/pools/summary")
async def get_pools_summary(
    account_id: Optional[str] = Query(None, description="Hedera account to attach user positions"),
    testnet: bool = Query(False, description="Use testnet API")
) -> Dict[str, Any]:
    """Return a consolidated snapshot of all SaucerSwap pools (v1, v2, farms, vaults)
    and Bonzo markets in a single call. Aims to minimise external API hits by
    caching results for 10 minutes per network.
    Optionally merges user-specific positions when *account_id* is provided."""
    logger.info(f"Pools summary requested (addr={account_id}, testnet={testnet})")

    try:
        # --- global cache bucket (10-minute windows) --------------------------------
        bucket = int(time.time() // 600)

        @lru_cache(maxsize=8)
        def _cached_global(bucket: int, testnet: bool):  # noqa: E501
            svc = DeFiProfileService(testnet=testnet)
            data = {
                "saucerswap": {
                    "v1": svc.saucerswap.get_all_pools_v1(),
                    "v2": svc.saucerswap.get_all_pools_v2(),
                    "farms": svc.saucerswap.get_all_farms(),
                    "vaults": []  # placeholder – implement if available
                },
                "bonzo": svc.bonzo.fetch_all_pools()
            }
            return data

        summary_data = _cached_global(bucket, testnet)

        # Attach user positions if requested ---------------------------------------
        if account_id:
            service = DeFiProfileService(testnet=testnet)
            try:
                positions = await service.get_defi_profile(account_id, include_risk_analysis=False)
            finally:
                if testnet:
                    service.cleanup()
            summary_data = {**summary_data, "user_positions": positions}

        return {
            "pools": summary_data,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error building pools summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pools/bonzo")
async def get_bonzo_pools() -> Dict[str, Any]:
    """
    Get Bonzo Finance pool (market) information.
    
    **Returns:**
    Market data including APYs, utilization rates, and liquidity information.
    """
    logger.info("Bonzo pools requested")
    
    try:
        pools = defi_service.bonzo.fetch_all_pools()
        
        return {
            "pools": pools,
            "timestamp": defi_service._get_timestamp(),
            "api_requests": defi_service.bonzo.get_request_count()
        }
        
    except Exception as e:
        logger.error(f"Error fetching Bonzo pools: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch Bonzo pools: {str(e)}"
        )


# Add utility method to service class
def _get_timestamp(self) -> str:
    """Get current timestamp in ISO format."""
    from datetime import datetime
    return datetime.utcnow().isoformat()

# Monkey patch the method onto the service class
DeFiProfileService._get_timestamp = _get_timestamp
