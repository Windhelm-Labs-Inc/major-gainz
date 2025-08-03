from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import OHLCVSaucerSwap
from .services.saucerswap_ohlcv import SaucerSwapOHLCVService
from .settings import SYMBOL_TO_TOKEN_ID, DEFAULT_DAYS, logger, get_token_id_for_symbol

# ---------------------------------------------------------------------------
# Fetch + store helpers
# ---------------------------------------------------------------------------


async def update_token_data(db: Session, token_symbol: str) -> None:
    """Ensure we have the last `DEFAULT_DAYS` days of data for *token_symbol*."""

    token_id = get_token_id_for_symbol(token_symbol)

    # Get most recent candle
    latest: OHLCVSaucerSwap | None = (
        db.query(OHLCVSaucerSwap)
        .filter(OHLCVSaucerSwap.token_id == token_id)
        .order_by(OHLCVSaucerSwap.timestamp_iso.desc())
        .first()
    )

    service = SaucerSwapOHLCVService()
    raw_data = await service.fetch_ohlcv_data(token_id, days=DEFAULT_DAYS)
    processed = service.process_saucerswap_data(raw_data, token_id, token_symbol)

    added = 0
    for rec in processed:
        exists = (
            db.query(OHLCVSaucerSwap)
            .filter(
                OHLCVSaucerSwap.token_id == token_id,
                OHLCVSaucerSwap.timestamp_iso == rec["timestamp_iso"],
            )
            .first()
        )
        if exists:
            continue
        db.add(OHLCVSaucerSwap(**rec))
        added += 1

    if added:
        db.commit()
        logger.info("Inserted %s new OHLCV rows for %s", added, token_symbol)


async def refresh_all_tokens() -> None:
    """Refresh all tokens listed in ``SYMBOL_TO_TOKEN_ID``."""
    from .database import SessionLocal  # local import to avoid circular deps

    for symbol in SYMBOL_TO_TOKEN_ID.keys():
        db = SessionLocal()
        try:
            await update_token_data(db, symbol)
        except Exception as e:
            logger.warning(f"Failed to update token data for {symbol}: {e}")
            # Continue with next token instead of failing entire startup
        finally:
            db.close()


# ---------------------------------------------------------------------------
# Query helpers (used by API routes)
# ---------------------------------------------------------------------------

def get_ohlcv(
    db: Session,
    token_symbol: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = 100,
) -> List[OHLCVSaucerSwap]:
    token_id = get_token_id_for_symbol(token_symbol)

    q = (
        db.query(OHLCVSaucerSwap)
        .filter(OHLCVSaucerSwap.token_id == token_id)
        .order_by(OHLCVSaucerSwap.timestamp_iso.desc())
    )
    if start:
        q = q.filter(OHLCVSaucerSwap.timestamp_iso >= start)
    if end:
        q = q.filter(OHLCVSaucerSwap.timestamp_iso <= end)

    return list(reversed(q.limit(limit).all()))


def get_latest_ohlcv(db: Session, token_symbol: str) -> Optional[OHLCVSaucerSwap]:
    token_id = get_token_id_for_symbol(token_symbol)
    return (
        db.query(OHLCVSaucerSwap)
        .filter(OHLCVSaucerSwap.token_id == token_id)
        .order_by(OHLCVSaucerSwap.timestamp_iso.desc())
        .first()
    )


# Analytical endpoints – replicate behaviour of original API ------------------


def _get_closes(db: Session, token_symbol: str, days: int) -> List[float]:
    token_id = get_token_id_for_symbol(token_symbol)
    rows = (
        db.query(OHLCVSaucerSwap.close_usd)
        .filter(OHLCVSaucerSwap.token_id == token_id)
        .order_by(OHLCVSaucerSwap.timestamp_iso.desc())
        .limit(days)
        .all()
    )
    return [float(r[0]) for r in rows if r[0] is not None]


def mean_daily_return(db: Session, token_symbol: str, days: int = 30) -> float:
    closes = _get_closes(db, token_symbol, days + 1)
    if len(closes) < days + 1:
        raise ValueError("Not enough data to compute returns")
    returns = [((closes[i] - closes[i + 1]) / closes[i + 1]) for i in range(days)]
    return float(sum(returns) / len(returns))


def std_daily_return(db: Session, token_symbol: str, days: int = 30) -> float:
    import numpy as np

    closes = _get_closes(db, token_symbol, days + 1)
    if len(closes) < days + 1:
        raise ValueError("Not enough data to compute returns")
    returns = np.diff(closes) / np.array(closes[1:])
    return float(np.std(returns))


def log_returns(db: Session, token_symbol: str, days: int = 30):
    import numpy as np
    import math

    closes = _get_closes(db, token_symbol, days + 1)
    if len(closes) < days + 1:
        raise ValueError("Not enough data to compute log returns")
    returns = [math.log(closes[i] / closes[i + 1]) for i in range(days)]
    return returns


def get_stats(
    db: Session,
    token_symbol: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    """Aggregate average / high / low close_usd for a token."""
    token_id = get_token_id_for_symbol(token_symbol)
    q = (
        db.query(
            func.avg(OHLCVSaucerSwap.close_usd).label("average"),
            func.max(OHLCVSaucerSwap.high_usd).label("high"),
            func.min(OHLCVSaucerSwap.low_usd).label("low"),
        )
        .filter(OHLCVSaucerSwap.token_id == token_id)
    )
    if start:
        q = q.filter(OHLCVSaucerSwap.timestamp_iso >= start)
    if end:
        q = q.filter(OHLCVSaucerSwap.timestamp_iso <= end)

    res = q.one()
    if res.average is None:
        return None
    return {"average": float(res.average), "high": float(res.high), "low": float(res.low)}
