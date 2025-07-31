from fastapi import APIRouter, HTTPException, Query
from httpx import HTTPStatusError
from datetime import datetime

from ..services.portfolio import build_portfolio
from ..settings import logger

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/{address}")
async def get_portfolio(address: str, network: str = Query("mainnet", pattern="^(mainnet|testnet)$")):
    """Return holdings and USD valuations for the given account address."""
    try:
        data = await build_portfolio(address, network)  # type: ignore[arg-type]
        return data
    except ValueError as e:
        logger.warning(f"Invalid input for portfolio {address} on {network}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPStatusError as exc:
        if exc.response.status_code == 404:
            logger.warning(f"Account not found: {address} on {network}")
            raise HTTPException(status_code=404, detail="Account not found")
        # fallthrough to generic below
        logger.error(f"HTTP error building portfolio for {address} on {network}: {exc}")
        err_msg = f"Upstream error: {exc}"
    except Exception as exc:
        logger.error(f"Unexpected error building portfolio for {address} on {network}: {exc}")
        err_msg = str(exc)

    # If we reach here, return placeholder portfolio with error field
    return {
        "address": address,
        "network": network,
        "totalUsd": 0.0,
        "holdings": [],
        "error": err_msg,
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
    } 