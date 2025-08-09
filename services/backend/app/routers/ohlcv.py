from datetime import date
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import schemas, settings
from .. import crud_saucerswap as crud
from ..settings import get_token_id_for_symbol
from ..services.saucerswap_ohlcv import SaucerSwapOHLCVService
from ..settings import get_token_id_for_symbol
from ..settings import logger
import numpy as np

router = APIRouter(prefix="/ohlcv", tags=["ohlcv"])


# helper to validate token
def _validate_token(token: str):
    try:
        get_token_id_for_symbol(token)
        return token  # Return original case since we now handle case-insensitive lookup
    except KeyError:
        raise HTTPException(status_code=404, detail="Token not supported")


@router.get("/{token}")
async def read_ohlcv(
    token: str,
    days: int = 90,
    interval: str = "DAY",
):
    """Return OHLCV candles from SaucerSwap for the given token symbol.

    Response fields follow SaucerSwap format with numeric values: timestamp, open, high, low, close, volume.
    """
    token = _validate_token(token)
    token_id = get_token_id_for_symbol(token)
    svc = SaucerSwapOHLCVService()
    data = await svc.fetch_ohlcv_data(token_id, days=days, interval=interval)
    return data


# -----------------------------------------------------------------------------
# Backward-compatible analytics endpoints used by legacy frontend
# -----------------------------------------------------------------------------

def _daily_closes(raw: List[Dict[str, Any]]) -> List[float]:
    return [float(r.get("close")) for r in raw if r.get("close") is not None]

def _simple_daily_returns(closes: List[float]) -> List[float]:
    rets: List[float] = []
    for i in range(1, len(closes)):
        prev, cur = closes[i-1], closes[i]
        if prev and prev > 0:
            rets.append((cur - prev) / prev)
    return rets

def _log_daily_returns(closes: List[float]) -> List[float]:
    import math
    rets: List[float] = []
    for i in range(1, len(closes)):
        prev, cur = closes[i-1], closes[i]
        if prev and prev > 0 and cur > 0:
            rets.append(math.log(cur / prev))
    return rets


@router.get("/{token}/mean_return")
async def mean_return(token: str, days: int = 30) -> Dict[str, float]:
    token = _validate_token(token)
    token_id = get_token_id_for_symbol(token)
    svc = SaucerSwapOHLCVService()
    raw = await svc.fetch_ohlcv_data(token_id, days=days, interval="DAY")
    closes = _daily_closes(raw)
    rets = _simple_daily_returns(closes)
    mean = sum(rets) / len(rets) if rets else 0.0
    return {"mean_return": float(mean)}


@router.get("/{token}/return_std")
async def return_std(token: str, days: int = 30) -> Dict[str, float]:
    from math import sqrt
    token = _validate_token(token)
    token_id = get_token_id_for_symbol(token)
    svc = SaucerSwapOHLCVService()
    raw = await svc.fetch_ohlcv_data(token_id, days=days, interval="DAY")
    closes = _daily_closes(raw)
    rets = _simple_daily_returns(closes)
    if len(rets) < 2:
        return {"std_return": 0.0}
    mean = sum(rets) / len(rets)
    var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)
    std = sqrt(var)
    return {"std_return": float(std)}


@router.get("/{token}/log_returns")
async def log_returns(token: str, days: int = 14) -> Dict[str, List[float]]:
    token = _validate_token(token)
    token_id = get_token_id_for_symbol(token)
    svc = SaucerSwapOHLCVService()
    raw = await svc.fetch_ohlcv_data(token_id, days=days + 1, interval="DAY")
    closes = _daily_closes(raw)
    logs = _log_daily_returns(closes)
    # Return the most recent N entries (already ordered by service)
    if len(logs) > days:
        logs = logs[-days:]
    return {"log_returns": [float(x) for x in logs]}


@router.get("/{token}/latest", response_model=schemas.OHLCVSchema)
async def read_latest(token: str, db: Session = Depends(get_db)):
    token = _validate_token(token)
    row = crud.get_latest_ohlcv(db, token)
    if not row:
        raise HTTPException(status_code=404, detail="No data")
    return row


@router.get("/{token}/stats", response_model=schemas.StatsSchema)
async def read_stats(
    token: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    db: Session = Depends(get_db),
):
    token = _validate_token(token)
    stats = crud.get_stats(db, token, start, end)
    if not stats:
        raise HTTPException(status_code=404, detail="No data")
    
    # Provide default dates if not specified to match schema requirements
    from datetime import date, timedelta
    today = date.today()
    effective_start = start or (today - timedelta(days=settings.DEFAULT_DAYS))
    effective_end = end or today
    
    return {"token": token, "start": effective_start, "end": effective_end, **stats}


# --------- New return analytics endpoints --------


@router.get("/{token}/mean_return")
async def mean_return(token: str, days: int = 30, db: Session = Depends(get_db)):
    token = _validate_token(token)
    try:
        val = crud.mean_daily_return(db, token, days)
    except ValueError as e:
        logger.warning(f"Failed to calculate mean return for {token} ({days} days): {e}")
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": token, "days": days, "mean_return": val}


@router.get("/{token}/return_std")
async def return_std(token: str, days: int = 30, db: Session = Depends(get_db)):
    token = _validate_token(token)
    try:
        val = crud.std_daily_return(db, token, days)
    except ValueError as e:
        logger.warning(f"Failed to calculate return std for {token} ({days} days): {e}")
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": token, "days": days, "std_return": val}


@router.get("/{token}/log_returns")
async def log_returns_endpoint(token: str, days: int = 30, db: Session = Depends(get_db)):
    token = _validate_token(token)
    try:
        vals = crud.log_returns(db, token, days)
    except ValueError as e:
        logger.warning(f"Failed to calculate log returns for {token} ({days} days): {e}")
        raise HTTPException(status_code=400, detail=str(e))
    return {"token": token, "days": days, "log_returns": vals} 