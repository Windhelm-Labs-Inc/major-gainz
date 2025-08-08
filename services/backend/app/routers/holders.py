from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional

from ..settings import logger

# We reuse the sqlite that the legacy token_holdings service uses
from ..services.token_holdings import get_token_holdings_data

router = APIRouter(prefix="/holders", tags=["holders"])


@router.get("/{symbol}/top")
async def top_holders(symbol: str, limit: int = Query(10, ge=1, le=100)) -> List[Dict[str, Any]]:
    """Return top holders for a token from the static DB via legacy aggregator.

    This calls the legacy aggregator with zero balance to calculate percentiles,
    then returns the top N holders portion.
    """
    try:
        data = get_token_holdings_data(token=symbol, address="0.0.0", token_balance="0")
        if data.get("error"):
            raise HTTPException(status_code=404, detail=data["error"])
        top = data.get("top_10_holders") or []
        return top[:limit]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get top holders for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load top holders")


@router.get("/{symbol}/percentiles")
async def percentiles(symbol: str, list: Optional[str] = Query(None)) -> List[Dict[str, Any]]:
    """Return requested percentile markers from the legacy aggregator output.

    Query param 'list' is a comma-separated string like '99,95,90,75,50,25,10,5,1'.
    """
    try:
        data = get_token_holdings_data(token=symbol, address="0.0.0", token_balance="0")
        if data.get("error"):
            raise HTTPException(status_code=404, detail=data["error"])
        pct_map: Dict[str, Any] = data.get("percentile_balances") or {}
        if not pct_map:
            return []
        if list:
            requested = [p.strip() for p in list.split(",") if p.strip()]
            keys = [f"p{int(p)}" for p in requested if p.isdigit()]
        else:
            # default selection
            keys = [f"p{p}" for p in (99, 95, 90, 75, 50, 25, 10, 5, 1)]
        result: List[Dict[str, Any]] = []
        for k in keys:
            if k in pct_map:
                try:
                    pct = int(k[1:])
                except Exception:
                    continue
                result.append({"percentile": pct, "balance": pct_map[k]})
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get percentiles for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load percentiles")


@router.get("/{symbol}/summary")
async def summary(symbol: str) -> Dict[str, Any]:
    """Return token metadata summary using legacy aggregator output."""
    try:
        data = get_token_holdings_data(token=symbol, address="0.0.0", token_balance="0")
        if data.get("error"):
            raise HTTPException(status_code=404, detail=data["error"])
        return {
            "token": data.get("token_name"),
            "token_id": data.get("token_id"),
            "last_updated_at": data.get("last_updated_at"),
            "has_percentiles": bool(data.get("percentile_balances")),
            "top_count": len(data.get("top_10_holders") or []),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get summary for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to load summary")


