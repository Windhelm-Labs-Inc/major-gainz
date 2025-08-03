from __future__ import annotations

"""SaucerSwap OHLCV service.

Fetches candle data from SaucerSwap and converts it into a structure that can be
persisted in the database.  The class performs three core tasks:

1. Fetch – Perform the HTTP request with an API key from the environment.
2. Normalise – Convert raw integer/string values to Decimal, taking token
   decimals into account, and calculate USD equivalents when not provided.
3. Transform – Return each candle as a dict matching the OHLCVSaucerSwap SQL
   model.
"""

from datetime import datetime, timedelta, timezone
import json
import os
from decimal import Decimal
from pathlib import Path
from typing import Dict, List

import httpx

from ..settings import (
    SYMBOL_TO_TOKEN_ID,
    TOKEN_DECIMALS,
    get_decimals,
    logger,
)

# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------


class SaucerSwapOHLCVService:
    """Light-weight client for SaucerSwap OHLCV endpoints."""

    BASE_URL = "https://api.saucerswap.finance"

    def __init__(self) -> None:
        self.api_key: str | None = os.getenv("SAUCER_SWAP_API_KEY")
        if not self.api_key:
            raise ValueError("SAUCER_SWAP_API_KEY environment variable not set")

        # Pre-resolve headers so we avoid building the dict for each request
        self._headers = {"x-api-key": self.api_key}

    # ------------------------------------------------------------------
    # Network helpers
    # ------------------------------------------------------------------

    async def fetch_ohlcv_data(
        self,
        token_id: str,
        days: int = 90,
        interval: str = "DAY",
    ) -> List[Dict]:
        """Fetch raw OHLCV candles for *token_id*.

        Parameters
        ----------
        token_id : str
            Hedera HTS token id (e.g. "0.0.456858").  "0.0.0" is HBAR.
        days : int, default 90
            Number of days of history to request.  SaucerSwap endpoint uses
            epoch *seconds* for `from` / `to` parameters.
        interval : {"DAY", "HOUR"}, default "DAY"
            Candle granularity.  Only daily is required at the moment.
        """

        end_ts = int(datetime.now(timezone.utc).timestamp())
        start_ts = end_ts - days * 24 * 3600

        url = f"{self.BASE_URL}/tokens/prices/{token_id}"
        params = {
            "interval": interval,
            "from": str(start_ts),
            "to": str(end_ts),
        }

        logger.debug("Fetching SaucerSwap candles", extra={"url": url, "params": params})

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, headers=self._headers, params=params)
            resp.raise_for_status()
            return resp.json()

    # ------------------------------------------------------------------
    # Processing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _to_dt(ts_seconds: str | int) -> datetime:
        """Convert epoch seconds to UTC aware datetime."""
        return datetime.fromtimestamp(int(ts_seconds), tz=timezone.utc)

    def _normalise(self, raw_value: str | int, decimals: int) -> Decimal:
        if raw_value in (None, "", "0", 0):
            return Decimal("0")
        return Decimal(str(raw_value)) / (Decimal(10) ** decimals)

    def process_saucerswap_data(
        self,
        raw_data: List[Dict],
        token_id: str,
        token_symbol: str,
    ) -> List[Dict]:
        """Convert raw SaucerSwap JSON into DB-ready rows."""

        decimals = get_decimals(token_symbol)
        processed: List[Dict] = []

        for entry in raw_data:
            ts = self._to_dt(entry["timestampSeconds"])
            open_raw = entry.get("open", "0")
            high_raw = entry.get("high", "0")
            low_raw = entry.get("low", "0")
            close_raw = entry.get("close", "0")
            volume_raw = entry.get("volume", "0")
            liquidity_raw = entry.get("liquidity", "0")

            # SaucerSwap sometimes provides closeUsd / liquidityUsd.  If not,
            # we approximate using the token price at *close*.
            close_usd_raw = entry.get("closeUsd")
            liquidity_usd_raw = entry.get("liquidityUsd")

            open_usd = self._normalise(open_raw, decimals)
            high_usd = self._normalise(high_raw, decimals)
            low_usd = self._normalise(low_raw, decimals)
            close_usd = self._normalise(close_raw, decimals)
            volume_units = self._normalise(volume_raw, decimals)

            if close_usd_raw is not None:
                close_usd = Decimal(str(close_usd_raw))
            if liquidity_usd_raw is not None:
                liquidity_usd = Decimal(str(liquidity_usd_raw))
            else:
                liquidity_usd = close_usd * volume_units if close_usd else Decimal("0")

            processed.append(
                {
                    "token_id": token_id,
                    "token_symbol": token_symbol,
                    "timestamp_iso": ts,
                    "open_raw": str(open_raw),
                    "high_raw": str(high_raw),
                    "low_raw": str(low_raw),
                    "close_raw": str(close_raw),
                    "volume_raw": str(volume_raw),
                    "liquidity_raw": str(liquidity_raw),
                    "open_usd": open_usd,
                    "high_usd": high_usd,
                    "low_usd": low_usd,
                    "close_usd": close_usd,
                    "volume_usd": close_usd * volume_units if close_usd else Decimal("0"),
                    "liquidity_usd": liquidity_usd,
                    "decimals": decimals,
                }
            )

        return processed
