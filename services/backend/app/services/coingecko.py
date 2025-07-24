import httpx
from typing import List
from datetime import datetime, timezone

from ..settings import DEFAULT_DAYS as TARGET_DAYS, HEDERA_TOKEN_IDS, logger


async def fetch_ohlc(api_id: str, days: int = TARGET_DAYS) -> List[List[float]]:
    """Fetch N-day OHLC list from CoinGecko; error if not available."""


    url = f"https://api.coingecko.com/api/v3/coins/{api_id}/ohlc"
    params = {"vs_currency": "usd", "days": str(days)}
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        if not isinstance(data, list) or len(data) < TARGET_DAYS:
            logger.warning(f"Only {len(data)} OHLC rows returned for {api_id} (expected {TARGET_DAYS})")
        return data

# @pytest.mark.asyncio
# async def test_fetch_ohlcv():
#     url = f"https://api.coingecko.com/api/v3/coins/{HEDERA_TOKEN_IDS["XPACK"]}/ohlc"
#     params = {"vs_currency": "usd", "days": str(TARGET_DAYS)}
#     async with httpx.AsyncClient(timeout=30) as client:
#         r = await client.get(url, params=params)
#         r.raise_for_status()
#         data = r.json()
#         if not isinstance(data, list) or len(data) < TARGET_DAYS:
#             logger.error(f"Only {len(data)} OHLC rows returned for XPACK (expected {TARGET_DAYS})")
#         return data

#
# def process_market_chart(data: dict) -> List[dict]:
#     """Aggregate CoinGecko response into *one* OHLCV record per date.
#
#     CoinGecko may return multiple price points per day (even when using
#     `interval=daily`).  We collapse those into daily OHLCV to satisfy the
#     UNIQUE(token, date) constraint in the database.
#     """
#     prices = data.get("prices", [])  # list[[ts_ms, price]]
#     volumes = data.get("total_volumes", [])  # list[[ts_ms, vol]]
#
#     # Map timestamp-ms -> volume so we can add it later
#     vol_map = {int(ts): vol for ts, vol in volumes}
#
#     bucket = {}
#     order = []  # preserve insertion order for open/close
#
#     for ts_ms, price in prices:
#         dt = datetime.utcfromtimestamp(ts_ms / 1000).date()
#         if dt not in bucket:
#             # initialise record
#             bucket[dt] = {
#                 "date": dt,
#                 "open": price,
#                 "high": price,
#                 "low": price,
#                 "close": price,
#                 "volume": 0.0,
#             }
#             order.append(dt)
#         rec = bucket[dt]
#         rec["high"] = max(rec["high"], price)
#         rec["low"] = min(rec["low"], price)
#         rec["close"] = price  # most recent within the day becomes close
#         rec["volume"] += vol_map.get(int(ts_ms), 0.0)
#
#     # Return rows sorted by date (ascending)
#     return [bucket[d] for d in sorted(order)]


def process_ohlc_list(lst: List[List[float]]) -> List[dict]:
    """Convert /ohlc list response to daily OHLCV rows (volume=0)."""
    bucket = {}
    order = []
    for ts_ms, open_, high, low, close in lst:
        dt = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc).date()
        if dt not in bucket:
            bucket[dt] = {
                "date": dt,
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": 0.0,
            }
            order.append(dt)
        else:
            rec = bucket[dt]
            rec["high"] = max(rec["high"], high)
            rec["low"] = min(rec["low"], low)
            rec["close"] = close
    return [bucket[d] for d in sorted(order)] 