from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from .. import schemas, crud, settings
from ..settings import logger
import numpy as np

router = APIRouter(prefix="/ohlcv", tags=["ohlcv"])


# helper to validate token
def _validate_token(token: str):
    token = token.upper()
    if token not in settings.HEDERA_TOKEN_IDS:
        raise HTTPException(status_code=404, detail="Token not supported")
    return token


@router.get("/{token}", response_model=List[schemas.OHLCVSchema])
async def read_ohlcv(
    token: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    token = _validate_token(token)
    return crud.get_ohlcv(db, token, start, end, limit)


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