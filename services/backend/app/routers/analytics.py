from __future__ import annotations

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from math import sqrt
import asyncio

from ..settings import logger, get_token_id_for_symbol, is_supported_symbol
from ..routers.portfolio import get_portfolio
from ..services.saucerswap_ohlcv import SaucerSwapOHLCVService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/returns/{address}")
async def get_returns_stats(
    address: str,
    network: str = Query("mainnet", pattern="^(mainnet|testnet)$"),
    days: int = Query(90, ge=7, le=365),
) -> List[Dict[str, Any]]:
    """
    Compute per-token expected return and volatility (daily-based, annualized) for a wallet's holdings.

    Returns a list of objects: { symbol, returns, volatility, sharpe }
    where values are in percentages. Sharpe uses risk-free rate 0.
    """
    try:
        # Fetch portfolio to learn which symbols the user holds
        portfolio = await get_portfolio(address=address, network=network)  # type: ignore[arg-type]
        holdings = portfolio.get("holdings") or []
        if not holdings:
            return []

        # Map symbols to Hedera token IDs
        symbols: List[str] = [h.get("symbol") for h in holdings if h.get("symbol")]
        unique_symbols = list({s for s in symbols if isinstance(s, str)})

        service = SaucerSwapOHLCVService()

        async def fetch_series(symbol: str) -> Dict[str, Any] | None:
            try:
                # Skip LP or unsupported symbols early
                if not is_supported_symbol(symbol):
                    logger.debug(f"Skipping unsupported symbol for returns analytics: {symbol}")
                    return None
                token_id = get_token_id_for_symbol(symbol)
                raw = await service.fetch_ohlcv_data(token_id=token_id, days=days, interval="DAY")
                # Expect list of dicts with numeric 'close'
                closes = [float(r.get("close")) for r in raw if r.get("close") is not None]
                if len(closes) < 10:
                    return None
                # Compute daily percent returns
                rets = []
                for i in range(1, len(closes)):
                    prev = closes[i-1]
                    cur = closes[i]
                    if prev and prev > 0:
                        rets.append((cur - prev) / prev)
                if len(rets) < 5:
                    return None
                mean_daily = sum(rets) / len(rets)
                # Sample std deviation
                mean = mean_daily
                var = sum((r - mean) ** 2 for r in rets) / (len(rets) - 1)
                std_daily = var ** 0.5
                # Annualize (approximate 365 trading days for crypto)
                annual_return_pct = mean_daily * 365 * 100.0
                annual_vol_pct = std_daily * sqrt(365.0) * 100.0
                sharpe = (annual_return_pct / annual_vol_pct) if annual_vol_pct > 1e-9 else None
                return {
                    "symbol": symbol,
                    "returns": annual_return_pct,
                    "volatility": annual_vol_pct,
                    "sharpe": sharpe,
                    # Include raw daily returns for downstream correlation computation
                    "_daily_returns": rets,
                }
            except Exception as e:
                logger.warning(f"Analytics returns failed for {symbol}: {e}")
                return None

        results = await asyncio.gather(*(fetch_series(sym) for sym in unique_symbols))
        clean = [r for r in results if r]

        # Build correlation maps per symbol using overlapping daily return windows
        def pearson_corr(a: list[float], b: list[float]) -> float | None:
            n = min(len(a), len(b))
            if n < 5:
                return None
            # align to most recent overlapping window
            a_slice = a[-n:]
            b_slice = b[-n:]
            mean_a = sum(a_slice) / n
            mean_b = sum(b_slice) / n
            cov = sum((ai - mean_a) * (bi - mean_b) for ai, bi in zip(a_slice, b_slice)) / (n - 1)
            var_a = sum((ai - mean_a) ** 2 for ai in a_slice) / (n - 1)
            var_b = sum((bi - mean_b) ** 2 for bi in b_slice) / (n - 1)
            if var_a <= 1e-18 or var_b <= 1e-18:
                return None
            std_a = var_a ** 0.5
            std_b = var_b ** 0.5
            return cov / (std_a * std_b)

        # Prepare lookup maps
        symbol_to_entry: dict[str, Dict[str, Any]] = {r["symbol"]: r for r in clean}
        symbol_to_rets: dict[str, list[float]] = {r["symbol"]: r.get("_daily_returns", []) for r in clean}

        for sym_i, entry_i in symbol_to_entry.items():
            corr_map: dict[str, float] = {}
            rets_i = symbol_to_rets.get(sym_i, [])
            for sym_j, rets_j in symbol_to_rets.items():
                if sym_i == sym_j:
                    continue
                corr = pearson_corr(rets_i, rets_j)
                if corr is not None:
                    corr_map[sym_j] = float(corr)
            if corr_map:
                entry_i["correlation"] = corr_map

        # Strip helper keys before returning
        for r in clean:
            if "_daily_returns" in r:
                del r["_daily_returns"]

        return clean  # type: ignore[return-value]
    except Exception as e:
        logger.error(f"Returns analytics error for {address}: {e}")
        raise HTTPException(status_code=500, detail="Failed to compute returns statistics")


