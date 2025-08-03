# services/backend/app/services/portfolio.py
"""Helper that builds a Portfolio JSON object for a Hedera address.

NOTE: This is simplified for POC – it resolves balances using Hedera
Mirror-Node REST endpoints and values the holdings in USD via
CoinGecko `/simple/price`.  Unsupported tokens are given usd=0.
"""
from __future__ import annotations

import asyncio
from typing import Dict, List, Literal

import httpx
from datetime import datetime

from ..settings import (
    TOKEN_ID_TO_SYMBOL as HEDERA_TOKEN_ADDRESS_TO_SYMBOL,
    logger,
)

from ..database import SessionLocal
from .. import crud_saucerswap as crud

Network = Literal["mainnet", "testnet"]

MIRROR_NODE_BASE: Dict[Network, str] = {
    "mainnet": "https://mainnet.mirrornode.hedera.com/api/v1",
    "testnet": "https://testnet.mirrornode.hedera.com/api/v1",
}

TINYBAR_COEF = 1e8  # 1 HBAR = 100,000,000 tinybars


async def _fetch_balance(client: httpx.AsyncClient, base: str, address: str):
    url = f"{base}/accounts/{address}/balances"
    r = await client.get(url, timeout=20)
    if r.status_code == 404:
        # Fallback to generic balances endpoint which sometimes works for newer accounts
        # e.g. /balances?account.id=0.0.9405888
        bal_url = f"{base}/balances"
        r2 = await client.get(bal_url, params={"account.id": address}, timeout=20)
        r2.raise_for_status()
        data = r2.json()
        # Mirror-node returns list[{account, balance, tokens}] – take first
        if data.get("balances"):
            return data["balances"][0]
        # If still empty, propagate 404
        r.raise_for_status()
    r.raise_for_status()
    return r.json()


async def _fetch_token_info(client: httpx.AsyncClient, base: str, token_id: str):
    url = f"{base}/tokens/{token_id}"
    r = await client.get(url, timeout=20)
    if r.status_code == 200:
        return r.json()
    return None


def _price_map_from_db(symbols: List[str]) -> Dict[str, float]:
    """Return mapping symbol -> latest close price from local OHLCV DB."""
    price_map: Dict[str, float] = {sym: 0.0 for sym in symbols}
    db = SessionLocal()
    try:
        for sym in symbols:
            row = crud.get_latest_ohlcv(db, sym)
            if row:
                                price_map[sym] = float(row.close_usd)
    finally:
        db.close()
    return price_map


async def build_portfolio(address: str, network: Network = "mainnet"):
    logger.info(f"Building portfolio for {address} on {network}")
    if network not in MIRROR_NODE_BASE:
        raise ValueError("network must be 'mainnet' or 'testnet'")

    base = MIRROR_NODE_BASE[network]

    async with httpx.AsyncClient() as client:
        try:
            bal_json = await _fetch_balance(client, base, address)
        except httpx.HTTPError as exc:
            logger.error(f"Upstream mirror node error for address {address}: {exc}")
            # Return empty portfolio rather than failing hard
            return {
                "address": address,
                "network": network,
                "totalUsd": 0.0,
                "holdings": [],
                "fetchedAt": datetime.utcnow().isoformat() + "Z",
            }

        # Start building holdings list
        holdings = []
        symbols_needed: List[str] = []

        # Native HBAR
        hbar_raw = bal_json.get("balance", 0)
        hbar_amount = hbar_raw / TINYBAR_COEF
        holdings.append({
            "tokenId": "HBAR",
            "symbol": "HBAR",
            "raw": hbar_raw,
            "decimals": 8,
            "amount": hbar_amount,
            "usd": 0.0,  # fill later
        })
        symbols_needed.append("HBAR")

        # Fungible tokens
        tokens = bal_json.get("tokens", [])
        logger.debug(f"Token count returned: {len(tokens)}")
        # Concurrently resolve unknown symbols via /tokens/{id}
        tasks: List[asyncio.Task] = []
        token_ids_for_tasks: List[str] = []
        for t in tokens:
            token_id = t["token_id"]
            balance = t["balance"]
            symbol = HEDERA_TOKEN_ADDRESS_TO_SYMBOL.get(token_id)
            # Always fetch token info to get decimals (may hit cache upstream)
            tasks.append(_fetch_token_info(client, base, token_id))
            token_ids_for_tasks.append(token_id)

            holdings.append({
                "tokenId": token_id,
                "symbol": symbol,  # may be None, updated later from info
                "raw": balance,  # integer units
                "decimals": None,  # fill later
                "amount": None,
                "usd": 0.0,
            })
        # Gather token info
        info_results = await asyncio.gather(*tasks, return_exceptions=True) if tasks else []
        info_map: Dict[str, dict] = {}
        for tid, res in zip(token_ids_for_tasks, info_results):
            if isinstance(res, dict):
                info_map[tid] = res
        logger.debug(f"Got info for {len(info_map)} tokens")

        for h in holdings:
            if h["tokenId"] == "HBAR":
                continue
            info = info_map.get(h["tokenId"])
            if info:
                if not h.get("symbol"):
                    h["symbol"] = info.get("symbol") or f"T{h['tokenId'].split('.')[-1]}"
                h["decimals"] = int(info.get("decimals", 0) or 0)
            else:
                # Fallback defaults
                if not h.get("symbol"):
                    h["symbol"] = f"T{h['tokenId'].split('.')[-1]}"
                if h.get("decimals") is None:
                    h["decimals"] = 0
            symbols_needed.append(h["symbol"])

        # Compute amount field for all holdings
        for h in holdings:
            if h["amount"] is None:
                h["raw"] = int(h["raw"])
                dec_raw = h.get("decimals", 0) or 0
                try:
                    dec = int(dec_raw)
                except (TypeError, ValueError) as e:
                    logger.warning(f"Invalid decimals value '{dec_raw}' for token {h['tokenId']}: {e}")
                    dec = 0
                h["decimals"] = dec
                h["amount"] = h["raw"] / (10 ** dec) if dec else h["raw"]

    # Fetch prices
    try:
        price_map = _price_map_from_db(list(set(symbols_needed)))
    except Exception as e:
        logger.error(f"Failed fetching prices from database: {e}")
        raise

    total_usd = 0.0
    for h in holdings:
        sym = h["symbol"]
        # normalise symbol aliases
        if sym == "XPACK":
            sym_lookup = "PACK"
        else:
            sym_lookup = sym
        price = price_map.get(sym_lookup, 0.0)
        h["usd"] = float(h["amount"]) * price
        total_usd += h["usd"]

    # Compute percentages
    if total_usd > 0:
        for h in holdings:
            h["percent"] = round(100 * h["usd"] / total_usd, 2)
    else:
        for h in holdings:
            h["percent"] = 0.0

    return {
        "address": address,
        "network": network,
        "totalUsd": total_usd,
        "holdings": holdings,
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
    } 