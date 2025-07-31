"""Bonzo Finance API client for retrieving lending portfolio and pool data."""

from typing import Dict, List, Optional, Any
from decimal import Decimal

from ...settings import logger
from .base_client import BaseAPIClient, DeFiAPIError
from .config import BONZO_BASE_URL, LOW_LIQUIDITY_THRESHOLD_USD, HIGH_UTILIZATION_THRESHOLD, UNHEALTHY_HF_THRESHOLD


class BonzoClient(BaseAPIClient):
    """Bonzo Finance API client for lending portfolio and pool data retrieval."""
    
    def __init__(self):
        """Initialize Bonzo client (no API key required)."""
        super().__init__(BONZO_BASE_URL, api_key=None)
        
    def health_check(self) -> bool:
        """Check if Bonzo API is accessible."""
        try:
            response = self._make_request_with_retry("market")
            return response is not None
        except Exception as e:
            logger.error(f"Bonzo health check failed: {e}")
            return False
    
    def fetch_account_portfolio(self, account_id: str) -> Dict[str, Any]:
        """Fetch the complete lending portfolio for a given Hedera account.
        
        Args:
            account_id: Hedera account ID (format: shard.realm.num)
            
        Returns:
            Dictionary containing supplied assets, borrowed assets, and health metrics
            
        Raises:
            DeFiAPIError: If account not found or API error occurs
        """
        logger.info(f"Fetching Bonzo portfolio for account {account_id}")
        
        try:
            response = self._make_request_with_retry(f"dashboard/{account_id}")
            
            if not response:
                logger.warning(f"No data returned for account {account_id}")
                return self._empty_portfolio(account_id)
            
            return self._parse_account_portfolio(response, account_id)
            
        except Exception as e:
            logger.error(f"Error fetching Bonzo portfolio for {account_id}: {e}")
            portfolio = self._empty_portfolio(account_id)
            portfolio["error"] = str(e)
            return portfolio
    
    def fetch_all_pools(self) -> List[Dict[str, Any]]:
        """Fetch statistics for all supported pools in the Bonzo protocol.
        
        Returns:
            List of pool dictionaries with APYs, liquidity, and utilization data
        """
        logger.info("Fetching Bonzo pool statistics")
        
        try:
            response = self._make_request_with_retry("market")
            
            if not response:
                logger.warning("No market data returned from Bonzo")
                return []
            
            return self._parse_pools_data(response)
            
        except Exception as e:
            logger.error(f"Error fetching Bonzo pools: {e}")
            return []
    
    def analyze_risk(self, account_portfolio: Dict, pools: List[Dict], 
                     low_liq_threshold_usd: Optional[float] = None,
                     high_util_threshold: Optional[float] = None,
                     unhealthy_hf_threshold: Optional[float] = None) -> Dict[str, Any]:
        """Analyze liquidity and credit risk for pools and user portfolio.
        
        Args:
            account_portfolio: User's portfolio data
            pools: List of pool data
            low_liq_threshold_usd: Threshold for low liquidity (default: 1000 USD)
            high_util_threshold: Threshold for high utilization (default: 90%)
            unhealthy_hf_threshold: Threshold for unhealthy health factor (default: 1.2)
            
        Returns:
            Risk analysis report
        """
        # Use defaults if not provided
        low_liq_threshold_usd = low_liq_threshold_usd or LOW_LIQUIDITY_THRESHOLD_USD
        high_util_threshold = high_util_threshold or HIGH_UTILIZATION_THRESHOLD
        unhealthy_hf_threshold = unhealthy_hf_threshold or UNHEALTHY_HF_THRESHOLD
        
        logger.debug(f"Analyzing risk with thresholds: liquidity=${low_liq_threshold_usd}, "
                    f"utilization={high_util_threshold}%, HF={unhealthy_hf_threshold}")
        
        risk_report = {
            "low_liquidity_pools": [],
            "high_utilization_pools": [],
            "user_health": "healthy",
            "user_health_factor": account_portfolio.get("health_factor"),
            "risk_summary": {}
        }
        
        try:
            # Analyze pool risks
            self._analyze_pool_risks(pools, risk_report, low_liq_threshold_usd, high_util_threshold)
            
            # Analyze user health
            self._analyze_user_health(account_portfolio, risk_report, unhealthy_hf_threshold)
            
            # Generate risk summary
            risk_report["risk_summary"] = self._generate_risk_summary(risk_report)
            
        except Exception as e:
            logger.error(f"Error during risk analysis: {e}")
            risk_report["error"] = str(e)
        
        return risk_report
    
    def _empty_portfolio(self, account_id: str) -> Dict[str, Any]:
        """Return empty portfolio structure."""
        return {
            "account_id": account_id,
            "supplied": [],
            "borrowed": [],
            "health_factor": None,
            "current_ltv": None,
            "liquidation_ltv": None,
            "total_collateral_hbar": 0.0,
            "total_debt_hbar": 0.0,
            "net_apy": None
        }
    
    def _parse_account_portfolio(self, data: Dict, account_id: str) -> Dict[str, Any]:
        """Parse account portfolio data from API response."""
        portfolio = {"account_id": account_id, "supplied": [], "borrowed": []}
        
        try:
            # Parse reserves data
            for reserve in data.get("reserves", []):
                symbol = reserve.get("symbol", "")
                
                # Parse supplied assets (aToken balance)
                atoken_info = reserve.get("atoken_balance")
                if atoken_info and self._get_display_value(atoken_info, "token_display", float) > 0:
                    supplied_asset = self._parse_supplied_asset(reserve, atoken_info)
                    portfolio["supplied"].append(supplied_asset)
                
                # Parse borrowed assets (stable + variable debt)
                borrowed_asset = self._parse_borrowed_asset(reserve)
                if borrowed_asset["amount"] > 0:
                    portfolio["borrowed"].append(borrowed_asset)
            
            # Parse credit metrics
            credit = data.get("user_credit", {})
            self._parse_credit_metrics(credit, portfolio)
            
            # Parse net APY
            avg_net_apy = data.get("average_net_apy")
            if avg_net_apy is not None:
                portfolio["net_apy"] = avg_net_apy
                portfolio["net_apy_str"] = f"{avg_net_apy:.2f}%"
            
        except Exception as e:
            logger.error(f"Error parsing portfolio data: {e}")
            portfolio["parse_error"] = str(e)
        
        return portfolio
    
    def _parse_supplied_asset(self, reserve: Dict, atoken_info: Dict) -> Dict[str, Any]:
        """Parse a supplied asset from reserve data."""
        symbol = reserve.get("symbol", "")
        amount = self._get_display_value(atoken_info, "token_display", float)
        usd_value = self._get_display_value(atoken_info, "usd_display", float)
        collateral_enabled = reserve.get("use_as_collateral_enabled", False)
        
        return {
            "symbol": symbol,
            "amount": amount,
            "amount_str": f"{amount} {symbol}",
            "usd_value": usd_value,
            "usd_value_str": f"${usd_value:,.2f}",
            "collateral": collateral_enabled
        }
    
    def _parse_borrowed_asset(self, reserve: Dict) -> Dict[str, Any]:
        """Parse a borrowed asset from reserve data."""
        symbol = reserve.get("symbol", "")
        
        # Get stable and variable debt amounts
        stable_debt_info = reserve.get("stable_debt_balance")
        variable_debt_info = reserve.get("variable_debt_balance")
        
        stable_amt = self._get_display_value(stable_debt_info, "token_display", float) if stable_debt_info else 0.0
        variable_amt = self._get_display_value(variable_debt_info, "token_display", float) if variable_debt_info else 0.0
        total_borrowed = stable_amt + variable_amt
        
        # Calculate USD value
        usd_value = 0.0
        if stable_debt_info:
            usd_value += self._get_display_value(stable_debt_info, "usd_display", float)
        if variable_debt_info:
            usd_value += self._get_display_value(variable_debt_info, "usd_display", float)
        
        # Get interest rates
        stable_rate = reserve.get("stable_borrow_apy")
        variable_rate = reserve.get("variable_borrow_apy")
        
        return {
            "symbol": symbol,
            "amount": total_borrowed,
            "amount_str": f"{total_borrowed} {symbol}",
            "usd_value": usd_value,
            "usd_value_str": f"${usd_value:,.2f}",
            "stable_rate": f"{stable_rate:.2f}%" if stable_rate is not None else None,
            "variable_rate": f"{variable_rate:.2f}%" if variable_rate is not None else None
        }
    
    def _parse_credit_metrics(self, credit: Dict, portfolio: Dict) -> None:
        """Parse credit metrics into portfolio."""
        # Total collateral and debt
        if "total_collateral" in credit:
            hbar_str = self._get_display_value(credit["total_collateral"], "hbar_display", str)
            portfolio["total_collateral_hbar"] = float(hbar_str or "0")
            portfolio["total_collateral_hbar_str"] = f"{hbar_str} HBAR"
        
        if "total_debt" in credit:
            hbar_str = self._get_display_value(credit["total_debt"], "hbar_display", str)
            portfolio["total_debt_hbar"] = float(hbar_str or "0")
            portfolio["total_debt_hbar_str"] = f"{hbar_str} HBAR"
        
        # LTV ratios
        current_ltv = credit.get("current_ltv")
        liquidation_ltv = credit.get("liquidation_ltv")
        
        if current_ltv is not None:
            portfolio["current_ltv"] = current_ltv
            portfolio["current_ltv_str"] = f"{current_ltv*100:.2f}%"
        
        if liquidation_ltv is not None:
            portfolio["liquidation_ltv"] = liquidation_ltv
            portfolio["liquidation_ltv_str"] = f"{liquidation_ltv*100:.2f}%"
        
        # Health factor
        health_factor = credit.get("health_factor")
        if health_factor is not None:
            portfolio["health_factor"] = health_factor
            portfolio["health_factor_str"] = f"{health_factor:.2f}"
    
    def _parse_pools_data(self, data: Dict) -> List[Dict[str, Any]]:
        """Parse pools data from market API response."""
        pools = []
        
        for reserve in data.get("reserves", []):
            try:
                symbol = reserve.get("symbol", "")
                name = reserve.get("name", "")
                
                # Get APYs and utilization
                supply_apy = reserve.get("supply_apy")
                variable_borrow_apy = reserve.get("variable_borrow_apy")
                utilization_rate = reserve.get("utilization_rate")
                
                # Get liquidity amounts
                available_liquidity_usd = self._get_display_value(
                    reserve.get("available_liquidity", {}), "usd_display", float
                )
                total_supply_usd = self._get_display_value(
                    reserve.get("total_supply", {}), "usd_display", float
                )
                
                # Calculate total borrowed (stable + variable debt)
                total_borrowed_usd = 0.0
                total_borrowed_usd += self._get_display_value(
                    reserve.get("total_variable_debt", {}), "usd_display", float
                )
                total_borrowed_usd += self._get_display_value(
                    reserve.get("total_stable_debt", {}), "usd_display", float
                )
                
                pool_data = {
                    "symbol": symbol,
                    "name": name,
                    "supply_apy": supply_apy,
                    "variable_borrow_apy": variable_borrow_apy,
                    "utilization_rate": utilization_rate,
                    "available_liquidity_usd": available_liquidity_usd,
                    "total_supply_usd": total_supply_usd,
                    "total_borrow_usd": total_borrowed_usd
                }
                
                pools.append(pool_data)
                
            except Exception as e:
                logger.warning(f"Error parsing pool data for reserve: {e}")
        
        return pools
    
    def _analyze_pool_risks(self, pools: List[Dict], risk_report: Dict, 
                           low_liq_threshold: float, high_util_threshold: float) -> None:
        """Analyze pool-level risks."""
        for pool in pools:
            symbol = pool.get("symbol", "")
            
            # Check liquidity risk
            available_liquidity = pool.get("available_liquidity_usd", 0)
            if available_liquidity < low_liq_threshold:
                risk_report["low_liquidity_pools"].append(symbol)
            
            # Check utilization risk
            utilization = pool.get("utilization_rate", 0)
            if utilization is not None and utilization > high_util_threshold:
                risk_report["high_utilization_pools"].append(symbol)
    
    def _analyze_user_health(self, portfolio: Dict, risk_report: Dict, unhealthy_threshold: float) -> None:
        """Analyze user health factor."""
        health_factor = portfolio.get("health_factor")
        
        if health_factor is not None:
            if health_factor <= 1.0:
                risk_report["user_health"] = "critical"
            elif health_factor < unhealthy_threshold:
                risk_report["user_health"] = "at_risk"
            else:
                risk_report["user_health"] = "healthy"
        else:
            # No health factor usually means no borrows
            risk_report["user_health"] = "healthy"
    
    def _generate_risk_summary(self, risk_report: Dict) -> Dict[str, Any]:
        """Generate a summary of identified risks."""
        summary = {
            "total_low_liquidity_pools": len(risk_report["low_liquidity_pools"]),
            "total_high_utilization_pools": len(risk_report["high_utilization_pools"]),
            "user_health_status": risk_report["user_health"],
            "overall_risk_level": "low"
        }
        
        # Determine overall risk level
        if (risk_report["user_health"] == "critical" or 
            len(risk_report["low_liquidity_pools"]) > 2 or
            len(risk_report["high_utilization_pools"]) > 3):
            summary["overall_risk_level"] = "high"
        elif (risk_report["user_health"] == "at_risk" or 
              len(risk_report["low_liquidity_pools"]) > 0 or
              len(risk_report["high_utilization_pools"]) > 1):
            summary["overall_risk_level"] = "medium"
        
        return summary
    
    def _get_display_value(self, data: Optional[Dict], key: str, value_type: type) -> Any:
        """Safely extract display value from API response."""
        if not data or key not in data:
            return value_type() if value_type in (int, float) else ""
        
        try:
            value = data[key]
            if value is None:
                return value_type() if value_type in (int, float) else ""
            
            # Handle comma-separated numbers for USD display values
            if value_type == float and isinstance(value, str) and ',' in value:
                value = value.replace(',', '')
            
            return value_type(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert {key} value '{data.get(key)}' to {value_type}")
            return value_type() if value_type in (int, float) else ""