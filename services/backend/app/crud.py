from datetime import date
from typing import List, Optional

import numpy as np

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import OHLCV
import httpx

from .settings import DEFAULT_DAYS, logger



async def update_token_data(db: Session, token: str, api_id: str):
    """Legacy CoinGecko path no longer supported."""
    return  # Disabled

    existing_dates = {
        r.date for r in db.query(OHLCV.date).filter(OHLCV.token == token).all()
    }

    from datetime import date, timedelta
    today = date.today()
    latest = max(existing_dates) if existing_dates else date.min

    # Need refresh if we have fewer than DEFAULT_DAYS or latest candle is older than yesterday
    if len(existing_dates) >= DEFAULT_DAYS and latest >= today - timedelta(days=1):
        return  # Data up-to-date

    try:
        data = await fetch_ohlc(api_id, days=DEFAULT_DAYS)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (404, 429):
            logger.warning(f"HTTP {exc.response.status_code} error fetching OHLC data for {token} (api_id: {api_id}): {exc}")
            return
        logger.error(f"HTTP {exc.response.status_code} error fetching OHLC data for {token} (api_id: {api_id}): {exc}")
        raise
    

    if isinstance(data, list):
        rows = process_ohlc_list(data)
        logger.debug(f"Processed {len(rows)} rows for {token}")
    else:
        logger.error(f"Unexpected data type for {token}: {type(data)}. Expected list from fetch_ohlc.")
        return  # Skip processing invalid data
    added = False
    for r in rows:
        if r["date"] in existing_dates:
            continue
        db.add(OHLCV(token=token, **r))
        added = True
    if added:
        db.commit()


# Legacy refresh_all_tokens disabled
async def refresh_all_tokens():
    return
    """Background routine that fetches & stores data for every token."""
    from .database import SessionLocal  # local import to avoid circular

    for token, api_id in HEDERA_TOKEN_IDS.items():
        db = SessionLocal()
        try:
            await update_token_data(db, token, api_id)
        finally:
            db.close()


def get_ohlcv(
    db: Session,
    token: str,
    start: Optional[date] = None,
    end: Optional[date] = None,
    limit: int = 100,
):
    q = db.query(OHLCV).filter(OHLCV.token == token).order_by(OHLCV.date.desc())
    if start:
        q = q.filter(OHLCV.date >= start)
    if end:
        q = q.filter(OHLCV.date <= end)
    return list(reversed(q.limit(limit).all()))  # chronological


def get_latest_ohlcv(db: Session, token: str):
    return (
        db.query(OHLCV).filter(OHLCV.token == token).order_by(OHLCV.date.desc()).first()
    )


def get_stats(db: Session, token: str, start: Optional[date] = None, end: Optional[date] = None):
    q = db.query(
        func.avg(OHLCV.close).label("average"),
        func.max(OHLCV.high).label("high"),
        func.min(OHLCV.low).label("low"),
    ).filter(OHLCV.token == token)
    if start:
        q = q.filter(OHLCV.date >= start)
    if end:
        q = q.filter(OHLCV.date <= end)
    res = q.one()
    if res.average is None:
        return None
    return {
        "average": res.average,
        "high": res.high,
        "low": res.low,
    }





def _get_closes(db: Session, token: str, days: int) -> List[float]:
    rows = (
        db.query(OHLCV.close)
        .filter(OHLCV.token == token)
        .order_by(OHLCV.date.desc())
        .limit(days)
        .all()
    )
    closes = [r[0] for r in rows]
    closes.reverse()  # TODO We should probably get the dates in here.
    return closes


def mean_daily_return(db: Session, token: str, days: int = 30) -> float:
    closes = _get_closes(db, token, days + 1)  # This might have introduced a bug, return to later. #TODO
    if len(closes) < 2:
        raise ValueError("Not enough data to compute returns")
    returns = np.diff(closes) / closes[:-1]
    return float(np.mean(returns))


def std_daily_return(db: Session, token: str, days: int = 30) -> float:
    closes = _get_closes(db, token, days + 1)
    if len(closes) < 2:
        raise ValueError("Not enough data to compute returns")
    returns = np.diff(closes) / closes[:-1]
    return float(np.std(returns, ddof=1))


def log_returns(db: Session, token: str, days: int = 30) -> List[float]:
    closes = _get_closes(db, token, days + 1)
    if len(closes) < 2:
        raise ValueError("Not enough data to compute returns")
    returns = np.diff(np.log(closes))
    return returns.tolist() 