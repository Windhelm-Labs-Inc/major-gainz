"""SaucerSwap API client for retrieving portfolio and pool data."""

import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal

from ...settings import logger
from .base_client import BaseAPIClient, DeFiAPIError
from .config import API_KEYS, SAUCERSWAP_BASE_URL, HEDERA_MIRROR_URL


class SaucerSwapClient(BaseAPIClient):
    """SaucerSwap API client for portfolio and pool data retrieval."""
    
    def __init__(self, testnet: bool = False):
        """Initialize SaucerSwap client.
        
        Args:
            testnet: Use testnet API if True
        """
        base_url = SAUCERSWAP_BASE_URL
        if testnet:
            # Update config to include testnet URL if needed
            pass
            
        api_key = API_KEYS.get('saucerswap')
        if not api_key:
            logger.warning("SaucerSwap API key not found in configuration")
            
        super().__init__(base_url, api_key)
        self.mirror_url = HEDERA_MIRROR_URL
        
    def health_check(self) -> bool:
        """Check if SaucerSwap API is accessible."""
        try:
            response = self._make_request_with_retry("stats")
            return response is not None
        except Exception as e:
            logger.error(f"SaucerSwap health check failed: {e}")
            return False
    
    def get_all_pools_v1(self) -> List[Dict]:
        """Retrieve detailed data for all SaucerSwap V1 pools."""
        try:
            response = self._make_request_with_retry("pools/full")
            if not response:
                return []
            return response if isinstance(response, list) else []
        except Exception as e:
            logger.error(f"Failed to fetch V1 pools: {e}")
            return []
    
    def get_all_pools_v2(self) -> List[Dict]:
        """Retrieve detailed data for all SaucerSwap V2 pools."""
        try:
            response = self._make_request_with_retry("v2/pools/full")
            if not response:
                return []
            return response if isinstance(response, list) else []
        except Exception as e:
            logger.error(f"Failed to fetch V2 pools: {e}")
            return []
    
    def get_all_farms(self) -> List[Dict]:
        """Retrieve list of all active farms (yield farming pools)."""
        try:
            response = self._make_request_with_retry("farms")
            if not response:
                return []
            return response if isinstance(response, list) else []
        except Exception as e:
            logger.error(f"Failed to fetch farms: {e}")
            return []
    
    def get_farm_positions(self, account_id: str) -> List[Dict]:
        """Retrieve all farm positions for the account (LP tokens staked)."""
        try:
            response = self._make_request_with_retry(f"farms/totals/{account_id}")
            if not response:
                return []
            
            positions = response if isinstance(response, list) else []
            
            # Convert epoch timestamps to ISO 8601
            for pos in positions:
                if 'timestamp' in pos and pos['timestamp']:
                    try:
                        ts = float(pos['timestamp'])
                        pos['timestamp'] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid timestamp in farm position: {pos.get('timestamp')}")
            
            return positions
        except Exception as e:
            logger.error(f"Failed to fetch farm positions for {account_id}: {e}")
            return []
    
    def get_v2_positions(self, account_id: str) -> List[Dict]:
        """Retrieve all V2 concentrated liquidity positions (NFTs) for the account."""
        try:
            response = self._make_request_with_retry(f"v2/nfts/{account_id}/positions")
            if not response:
                return []
                
            positions = response if isinstance(response, list) else []
            
            # Convert timestamps to ISO 8601
            for pos in positions:
                for col in ['createdAt', 'updatedAt']:
                    if col in pos and pos[col]:
                        try:
                            ts = float(pos[col])
                            pos[col] = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
                        except (ValueError, TypeError):
                            logger.warning(f"Invalid {col} timestamp in V2 position: {pos.get(col)}")
            
            return positions
        except Exception as e:
            logger.error(f"Failed to fetch V2 positions for {account_id}: {e}")
            return []
    
    def get_account_token_balances(self, account_id: str) -> List[Dict]:
        """Retrieve all HTS token balances for the account via Hedera Mirror Node API."""
        try:
            # Use mirror node directly (no API key needed)
            import requests
            url = f"{self.mirror_url}/accounts/{account_id}/tokens"
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            tokens = data.get("tokens", [])
            
            # Convert balance to numeric
            for token in tokens:
                if 'balance' in token:
                    try:
                        token['balance'] = int(token['balance'])
                    except (ValueError, TypeError):
                        token['balance'] = 0
            
            return tokens
        except Exception as e:
            logger.error(f"Failed to fetch token balances for {account_id}: {e}")
            return []
    
    def get_portfolio(self, account_id: str) -> Dict[str, Any]:
        """Fetch the full SaucerSwap portfolio for the account."""
        logger.info(f"Fetching SaucerSwap portfolio for account {account_id}")
        
        portfolio = {"address": account_id, "timestamp": datetime.utcnow().isoformat()}
        
        try:
            # Fetch global data and user-specific data
            pools_v1 = self.get_all_pools_v1()
            pools_v2 = self.get_all_pools_v2()
            farms = self.get_all_farms()
            account_tokens = self.get_account_token_balances(account_id)
            farm_positions = self.get_farm_positions(account_id)
            v2_positions = self.get_v2_positions(account_id)
            
            logger.debug(f"Retrieved {len(pools_v1)} V1 pools, {len(pools_v2)} V2 pools, "
                        f"{len(farms)} farms, {len(account_tokens)} account tokens")
            
            # Identify V1 pool positions by matching LP token holdings
            v1_positions = self._build_v1_positions(pools_v1, account_tokens)
            portfolio["pools_v1"] = v1_positions
            
            # Build V2 positions
            v2_portfolio_positions = self._build_v2_positions(v2_positions)
            portfolio["pools_v2"] = v2_portfolio_positions
            
            # Build farm positions
            farm_portfolio_positions = self._build_farm_positions(farm_positions, farms, pools_v1)
            portfolio["farms"] = farm_portfolio_positions
            
            # Build vault positions
            vault_positions = self._build_vault_positions(account_tokens)
            portfolio["vaults"] = vault_positions
            
            logger.info(f"Portfolio summary - V1: {len(v1_positions)}, V2: {len(v2_portfolio_positions)}, "
                       f"Farms: {len(farm_portfolio_positions)}, Vaults: {len(vault_positions)}")
            
        except Exception as e:
            logger.error(f"Error building portfolio for {account_id}: {e}")
            # Return partial data with error info
            portfolio["error"] = str(e)
        
        return portfolio
    
    def _build_v1_positions(self, pools_v1: List[Dict], account_tokens: List[Dict]) -> List[Dict]:
        """Build V1 liquidity positions from pool data and account tokens."""
        positions = []
        
        if not pools_v1 or not account_tokens:
            return positions
        
        # Create lookup for LP token IDs
        lp_token_ids = {pool.get('lpToken', {}).get('id') for pool in pools_v1 if pool.get('lpToken', {}).get('id')}
        
        for token in account_tokens:
            token_id = token.get('token_id')
            balance = token.get('balance', 0)
            
            if balance > 0 and token_id in lp_token_ids:
                # Find the corresponding pool
                pool = next((p for p in pools_v1 if p.get('lpToken', {}).get('id') == token_id), None)
                if not pool:
                    continue
                
                try:
                    position = self._calculate_v1_position(pool, balance)
                    if position:
                        positions.append(position)
                except Exception as e:
                    logger.warning(f"Error calculating V1 position for token {token_id}: {e}")
        
        return positions
    
    def _calculate_v1_position(self, pool: Dict, lp_balance: int) -> Optional[Dict]:
        """Calculate V1 position details from pool info and LP balance."""
        try:
            lp_token = pool.get('lpToken', {})
            token_a = pool.get('tokenA', {})
            token_b = pool.get('tokenB', {})
            
            total_lp = int(pool.get('lpTokenReserve', 0))
            if total_lp == 0:
                return None
            
            share = lp_balance / total_lp
            
            # Calculate underlying token amounts
            reserve_a = int(pool.get('tokenReserveA', 0))
            reserve_b = int(pool.get('tokenReserveB', 0))
            
            decimals_a = token_a.get('decimals', 0)
            decimals_b = token_b.get('decimals', 0)
            
            amount_a_tiny = reserve_a * share
            amount_b_tiny = reserve_b * share
            
            amount_a = amount_a_tiny / (10 ** decimals_a) if decimals_a else 0
            amount_b = amount_b_tiny / (10 ** decimals_b) if decimals_b else 0
            
            # Calculate USD values
            price_a = float(token_a.get('priceUsd', 0))
            price_b = float(token_b.get('priceUsd', 0))
            
            value_a = amount_a * price_a
            value_b = amount_b * price_b
            total_usd = value_a + value_b if price_a and price_b else None
            
            return {
                "poolId": int(pool.get('id', 0)),
                "tokenA": token_a.get('symbol', ''),
                "tokenB": token_b.get('symbol', ''),
                "lpTokenId": lp_token.get('id', ''),
                "lpTokenBalance": lp_balance,
                "sharePercentage": round(share * 100, 4),
                "underlyingA": round(amount_a, 6),
                "underlyingA_unit": token_a.get('symbol', ''),
                "underlyingB": round(amount_b, 6),
                "underlyingB_unit": token_b.get('symbol', ''),
                "underlyingValueUSD": round(total_usd, 2) if total_usd else None
            }
        except Exception as e:
            logger.error(f"Error calculating V1 position: {e}")
            return None
    
    def _build_v2_positions(self, v2_positions: List[Dict]) -> List[Dict]:
        """Build V2 concentrated liquidity positions."""
        positions = []
        
        for pos in v2_positions:
            try:
                token0 = pos.get('token0', {})
                token1 = pos.get('token1', {})
                
                position = {
                    "token0": token0.get('symbol') if token0 else None,
                    "token1": token1.get('symbol') if token1 else None,
                    "liquidity": pos.get("liquidity"),
                    "tokensOwed0": pos.get("tokensOwed0"),
                    "tokensOwed1": pos.get("tokensOwed1"),
                    "createdAt": pos.get("createdAt"),
                    "updatedAt": pos.get("updatedAt"),
                    "tickLower": pos.get("tickLower"),
                    "tickUpper": pos.get("tickUpper"),
                    "feeTier": pos.get("fee")
                }
                positions.append(position)
            except Exception as e:
                logger.warning(f"Error processing V2 position: {e}")
        
        return positions
    
    def _build_farm_positions(self, farm_positions: List[Dict], farms: List[Dict], pools_v1: List[Dict]) -> List[Dict]:
        """Build farm positions with pool information."""
        positions = []
        
        # Create farm lookup
        farm_lookup = {farm.get('id'): farm for farm in farms if farm.get('id')}
        pool_lookup = {pool.get('id'): pool for pool in pools_v1 if pool.get('id')}
        
        for fpos in farm_positions:
            try:
                farm_id = fpos.get('farmId')
                farm = farm_lookup.get(farm_id)
                
                position = {
                    "farmId": int(farm_id) if farm_id else None,
                    "poolId": int(fpos.get('poolId')) if fpos.get('poolId') else None,
                    "stakedLP": int(fpos.get('staked', 0)),
                    "timestamp": fpos.get("timestamp")
                }
                
                # Add pool token pair for clarity
                pool_id = position["poolId"]
                if pool_id and pool_id in pool_lookup:
                    pool = pool_lookup[pool_id]
                    token_a = pool.get('tokenA', {}).get('symbol', '')
                    token_b = pool.get('tokenB', {}).get('symbol', '')
                    position["pair"] = f"{token_a}/{token_b}"
                
                positions.append(position)
            except Exception as e:
                logger.warning(f"Error processing farm position: {e}")
        
        return positions
    
    def _build_vault_positions(self, account_tokens: List[Dict]) -> List[Dict]:
        """Build vault positions (e.g., xSAUCE)."""
        positions = []
        
        # Known vault token IDs
        vault_tokens = {
            "0.0.1460200": "SAUCE Staking (xSAUCE)"
        }
        
        for token in account_tokens:
            token_id = token.get('token_id')
            balance = token.get('balance', 0)
            
            if balance > 0 and token_id in vault_tokens:
                positions.append({
                    "vault": vault_tokens[token_id],
                    "tokenId": token_id,
                    "balance": balance
                })
        
        return positions
    
    def analyze_liquidity_risks(self, portfolio: Dict) -> Dict:
        """Analyze liquidity risks for positions in the portfolio."""
        risks = {"positions": [], "overall_risk": "Low"}
        
        stable_tokens = {"USDC", "USDT", "USD", "USDS", "DAI"}
        
        try:
            # Analyze V1 pool positions
            for pos in portfolio.get("pools_v1", []):
                risk_data = self._analyze_v1_position_risk(pos, stable_tokens)
                if risk_data:
                    risks["positions"].append(risk_data)
            
            # Analyze V2 positions
            for pos in portfolio.get("pools_v2", []):
                risk_data = self._analyze_v2_position_risk(pos, stable_tokens)
                if risk_data:
                    risks["positions"].append(risk_data)
            
            # Determine overall risk
            risk_levels = [p["risk_level"] for p in risks["positions"]]
            if "High" in risk_levels:
                risks["overall_risk"] = "High"
            elif "Medium" in risk_levels:
                risks["overall_risk"] = "Medium"
            else:
                risks["overall_risk"] = "Low"
                
        except Exception as e:
            logger.error(f"Error analyzing liquidity risks: {e}")
            risks["error"] = str(e)
        
        return risks
    
    def _analyze_v1_position_risk(self, position: Dict, stable_tokens: set) -> Optional[Dict]:
        """Analyze risk for a V1 position."""
        try:
            token_a = position.get("tokenA", "")
            token_b = position.get("tokenB", "")
            tvl_usd = position.get("underlyingValueUSD", 0) or 0
            share_pct = position.get("sharePercentage", 0) or 0
            
            risk_level = "Low"
            reasons = []
            
            # TVL-based risk
            if tvl_usd < 10000:
                risk_level = "High"
                reasons.append("Low pool liquidity")
            elif tvl_usd < 100000:
                risk_level = "Medium"
                reasons.append("Moderate pool liquidity")
            
            # Impermanent loss risk
            if token_a and token_b:
                if token_a.upper() in stable_tokens and token_b.upper() in stable_tokens:
                    reasons.append("Stable-stable pair (low IL risk)")
                elif token_a.upper() in stable_tokens or token_b.upper() in stable_tokens:
                    reasons.append("Stable-volatile pair (moderate IL risk)")
                    risk_level = max(risk_level, "Medium")
                else:
                    reasons.append("Volatile-volatile pair (high IL risk)")
                    risk_level = "High"
            
            # Concentration risk
            if share_pct > 20:
                reasons.append(f"High pool ownership ({share_pct:.2f}%)")
                risk_level = "High"
            
            return {
                "position": f"{token_a}/{token_b}",
                "risk_level": risk_level,
                "reasons": reasons
            }
        except Exception as e:
            logger.warning(f"Error analyzing V1 position risk: {e}")
            return None
    
    def _analyze_v2_position_risk(self, position: Dict, stable_tokens: set) -> Optional[Dict]:
        """Analyze risk for a V2 position."""
        try:
            token0 = position.get("token0", "")
            token1 = position.get("token1", "")
            
            risk_level = "Low"
            reasons = []
            
            if token0 and token1:
                if token0.upper() in stable_tokens and token1.upper() in stable_tokens:
                    reasons.append("Stable-stable pair (low IL risk)")
                elif token0.upper() in stable_tokens or token1.upper() in stable_tokens:
                    reasons.append("Stable-volatile pair (moderate IL risk)")
                    risk_level = "Medium"
                else:
                    reasons.append("Volatile-volatile pair (high IL risk)")
                    risk_level = "High"
            
            return {
                "position": f"{token0}/{token1}" if token0 and token1 else "V2 Position",
                "risk_level": risk_level,
                "reasons": reasons
            }
        except Exception as e:
            logger.warning(f"Error analyzing V2 position risk: {e}")
            return None