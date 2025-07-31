"""Unified DeFi profile service combining SaucerSwap and Bonzo Finance data."""

from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor

from ...settings import logger
from .saucerswap_client import SaucerSwapClient
from .bonzo_client import BonzoClient
from .base_client import DeFiAPIError


class DeFiProfileService:
    """Service for retrieving comprehensive DeFi profiles across protocols."""
    
    def __init__(self, testnet: bool = False):
        """Initialize the DeFi profile service.
        
        Args:
            testnet: Use testnet APIs if True
        """
        self.saucerswap = SaucerSwapClient(testnet=testnet)
        self.bonzo = BonzoClient()
        self.executor = ThreadPoolExecutor(max_workers=4)
        
    async def get_defi_profile(self, account_id: str, include_risk_analysis: bool = True) -> Dict[str, Any]:
        """Get comprehensive DeFi profile for an account across all supported protocols.
        
        Args:
            account_id: Hedera account ID (format: shard.realm.num)
            include_risk_analysis: Whether to include risk analysis
            
        Returns:
            Dictionary with structure:
            {
                "account_id": str,
                "timestamp": str,
                "bonzo_finance": {...},
                "saucer_swap": {...},
                "risk_analysis": {...} (if include_risk_analysis=True),
                "summary": {...}
            }
        """
        logger.info(f"Fetching DeFi profile for account {account_id}")
        start_time = datetime.utcnow()
        
        profile = {
            "account_id": account_id,
            "timestamp": start_time.isoformat(),
            "bonzo_finance": {},
            "saucer_swap": {},
            "metadata": {
                "processing_time_seconds": 0,
                "protocols_queried": [],
                "errors": []
            }
        }
        
        try:
            # Fetch data from both protocols concurrently
            saucerswap_data, bonzo_data = await self._fetch_protocol_data_concurrent(account_id)
            
            profile["saucer_swap"] = saucerswap_data
            profile["bonzo_finance"] = bonzo_data
            
            # Track which protocols were successfully queried
            if saucerswap_data and not saucerswap_data.get("error"):
                profile["metadata"]["protocols_queried"].append("saucerswap")
            if bonzo_data and not bonzo_data.get("error"):
                profile["metadata"]["protocols_queried"].append("bonzo")
            
            # Add risk analysis if requested
            if include_risk_analysis:
                profile["risk_analysis"] = await self._perform_risk_analysis(saucerswap_data, bonzo_data)
            
            # Generate summary
            profile["summary"] = self._generate_profile_summary(saucerswap_data, bonzo_data)
            
            # Calculate processing time
            end_time = datetime.utcnow()
            profile["metadata"]["processing_time_seconds"] = (end_time - start_time).total_seconds()
            
            logger.info(f"DeFi profile completed for {account_id} in "
                       f"{profile['metadata']['processing_time_seconds']:.2f}s")
            
        except Exception as e:
            logger.error(f"Error generating DeFi profile for {account_id}: {e}")
            profile["metadata"]["errors"].append(str(e))
            profile["error"] = str(e)
        
        return profile
    
    async def _fetch_protocol_data_concurrent(self, account_id: str) -> Tuple[Dict, Dict]:
        """Fetch data from both protocols concurrently."""
        loop = asyncio.get_event_loop()
        
        # Run both protocol fetches in parallel
        saucerswap_task = loop.run_in_executor(
            self.executor, self._fetch_saucerswap_data, account_id
        )
        bonzo_task = loop.run_in_executor(
            self.executor, self._fetch_bonzo_data, account_id
        )
        
        saucerswap_data, bonzo_data = await asyncio.gather(
            saucerswap_task, bonzo_task, return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(saucerswap_data, Exception):
            logger.error(f"SaucerSwap data fetch failed: {saucerswap_data}")
            saucerswap_data = {"error": str(saucerswap_data)}
        
        if isinstance(bonzo_data, Exception):
            logger.error(f"Bonzo data fetch failed: {bonzo_data}")
            bonzo_data = {"error": str(bonzo_data)}
        
        return saucerswap_data, bonzo_data
    
    def _fetch_saucerswap_data(self, account_id: str) -> Dict[str, Any]:
        """Fetch SaucerSwap portfolio data."""
        try:
            portfolio = self.saucerswap.get_portfolio(account_id)
            
            # Add request count metadata
            portfolio["metadata"] = {
                "api_requests": self.saucerswap.get_request_count(),
                "protocol": "saucerswap"
            }
            
            return portfolio
        except Exception as e:
            logger.error(f"Error fetching SaucerSwap data: {e}")
            return {"error": str(e)}
    
    def _fetch_bonzo_data(self, account_id: str) -> Dict[str, Any]:
        """Fetch Bonzo Finance portfolio data."""
        try:
            portfolio = self.bonzo.fetch_account_portfolio(account_id)
            
            # Add metadata
            portfolio["metadata"] = {
                "api_requests": self.bonzo.get_request_count(),
                "protocol": "bonzo"
            }
            
            return portfolio
        except Exception as e:
            logger.error(f"Error fetching Bonzo data: {e}")
            return {"error": str(e)}
    
    async def _perform_risk_analysis(self, saucerswap_data: Dict, bonzo_data: Dict) -> Dict[str, Any]:
        """Perform comprehensive risk analysis across protocols."""
        logger.debug("Performing cross-protocol risk analysis")
        
        risk_analysis = {
            "saucerswap_risks": {},
            "bonzo_risks": {},
            "cross_protocol_analysis": {}
        }
        
        try:
            # SaucerSwap risk analysis
            if saucerswap_data and not saucerswap_data.get("error"):
                risk_analysis["saucerswap_risks"] = self.saucerswap.analyze_liquidity_risks(saucerswap_data)
            
            # Bonzo risk analysis
            if bonzo_data and not bonzo_data.get("error"):
                # Fetch pool data for analysis
                loop = asyncio.get_event_loop()
                pools = await loop.run_in_executor(self.executor, self.bonzo.fetch_all_pools)
                risk_analysis["bonzo_risks"] = self.bonzo.analyze_risk(bonzo_data, pools)
            
            # Cross-protocol analysis
            risk_analysis["cross_protocol_analysis"] = self._analyze_cross_protocol_risks(
                saucerswap_data, bonzo_data, risk_analysis
            )
            
        except Exception as e:
            logger.error(f"Error in risk analysis: {e}")
            risk_analysis["error"] = str(e)
        
        return risk_analysis
    
    def _analyze_cross_protocol_risks(self, saucerswap_data: Dict, bonzo_data: Dict, 
                                    risk_analysis: Dict) -> Dict[str, Any]:
        """Analyze risks across protocols."""
        cross_analysis = {
            "overall_risk_level": "low",
            "risk_factors": [],
            "recommendations": []
        }
        
        try:
            # Check for liquidation risk from Bonzo
            bonzo_health = bonzo_data.get("health_factor")
            if bonzo_health is not None and bonzo_health < 1.5:
                cross_analysis["risk_factors"].append(
                    f"Low health factor on Bonzo Finance: {bonzo_health:.2f}"
                )
                if bonzo_health < 1.2:
                    cross_analysis["overall_risk_level"] = "high"
                    cross_analysis["recommendations"].append(
                        "Consider reducing leverage or adding more collateral on Bonzo Finance"
                    )
                else:
                    cross_analysis["overall_risk_level"] = "medium"
            
            # Check for concentration risk across protocols
            total_defi_exposure = 0
            
            # SaucerSwap exposure
            ss_positions = saucerswap_data.get("pools_v1", []) + saucerswap_data.get("pools_v2", [])
            for pos in ss_positions:
                usd_value = pos.get("underlyingValueUSD")
                if usd_value:
                    total_defi_exposure += usd_value
            
            # Bonzo exposure
            bonzo_collateral_hbar = bonzo_data.get("total_collateral_hbar", 0)
            if bonzo_collateral_hbar > 0:
                # Rough conversion (would need HBAR price for accuracy)
                estimated_usd = bonzo_collateral_hbar * 0.1  # Placeholder conversion
                total_defi_exposure += estimated_usd
            
            if total_defi_exposure > 100000:  # $100k threshold
                cross_analysis["risk_factors"].append(
                    f"High DeFi exposure: ~${total_defi_exposure:,.2f}"
                )
                cross_analysis["recommendations"].append(
                    "Consider diversifying across different protocols and asset classes"
                )
            
            # Check for high-risk positions
            ss_risks = risk_analysis.get("saucerswap_risks", {})
            if ss_risks.get("overall_risk") == "High":
                cross_analysis["risk_factors"].append("High-risk positions detected on SaucerSwap")
                cross_analysis["overall_risk_level"] = "high"
            
            bonzo_risks = risk_analysis.get("bonzo_risks", {})
            if bonzo_risks.get("risk_summary", {}).get("overall_risk_level") == "high":
                cross_analysis["risk_factors"].append("High-risk conditions detected on Bonzo Finance")
                cross_analysis["overall_risk_level"] = "high"
            
            # Overall risk determination
            if not cross_analysis["risk_factors"]:
                cross_analysis["recommendations"].append("Portfolio appears to be in good health")
            
        except Exception as e:
            logger.error(f"Error in cross-protocol analysis: {e}")
            cross_analysis["error"] = str(e)
        
        return cross_analysis
    
    def _generate_profile_summary(self, saucerswap_data: Dict, bonzo_data: Dict) -> Dict[str, Any]:
        """Generate a summary of the DeFi profile."""
        summary = {
            "protocols_active": [],
            "total_positions": 0,
            "position_breakdown": {
                "saucerswap_v1_pools": 0,
                "saucerswap_v2_pools": 0,
                "saucerswap_farms": 0,
                "saucerswap_vaults": 0,
                "bonzo_supplied": 0,
                "bonzo_borrowed": 0
            },
            "health_indicators": {}
        }
        
        try:
            # SaucerSwap summary
            if saucerswap_data and not saucerswap_data.get("error"):
                summary["protocols_active"].append("saucerswap")
                
                v1_pools = len(saucerswap_data.get("pools_v1", []))
                v2_pools = len(saucerswap_data.get("pools_v2", []))
                farms = len(saucerswap_data.get("farms", []))
                vaults = len(saucerswap_data.get("vaults", []))
                
                summary["position_breakdown"]["saucerswap_v1_pools"] = v1_pools
                summary["position_breakdown"]["saucerswap_v2_pools"] = v2_pools
                summary["position_breakdown"]["saucerswap_farms"] = farms
                summary["position_breakdown"]["saucerswap_vaults"] = vaults
                
                summary["total_positions"] += v1_pools + v2_pools + farms + vaults
            
            # Bonzo summary
            if bonzo_data and not bonzo_data.get("error"):
                summary["protocols_active"].append("bonzo")
                
                supplied = len(bonzo_data.get("supplied", []))
                borrowed = len(bonzo_data.get("borrowed", []))
                
                summary["position_breakdown"]["bonzo_supplied"] = supplied
                summary["position_breakdown"]["bonzo_borrowed"] = borrowed
                
                summary["total_positions"] += supplied + borrowed
                
                # Health indicators
                health_factor = bonzo_data.get("health_factor")
                if health_factor is not None:
                    summary["health_indicators"]["bonzo_health_factor"] = health_factor
                    summary["health_indicators"]["bonzo_health_status"] = (
                        "healthy" if health_factor > 1.5 else 
                        "at_risk" if health_factor > 1.2 else 
                        "critical"
                    )
                
                current_ltv = bonzo_data.get("current_ltv")
                if current_ltv is not None:
                    summary["health_indicators"]["bonzo_ltv"] = current_ltv * 100  # Convert to percentage
            
            # Overall activity level
            if summary["total_positions"] == 0:
                summary["activity_level"] = "inactive"
            elif summary["total_positions"] < 3:
                summary["activity_level"] = "light"
            elif summary["total_positions"] < 8:
                summary["activity_level"] = "moderate"
            else:
                summary["activity_level"] = "heavy"
            
        except Exception as e:
            logger.error(f"Error generating profile summary: {e}")
            summary["error"] = str(e)
        
        return summary
    
    async def health_check(self) -> Dict[str, bool]:
        """Check health of all protocol APIs."""
        logger.info("Performing DeFi service health check")
        
        loop = asyncio.get_event_loop()
        
        saucerswap_health = await loop.run_in_executor(
            self.executor, self.saucerswap.health_check
        )
        bonzo_health = await loop.run_in_executor(
            self.executor, self.bonzo.health_check
        )
        
        return {
            "saucerswap": saucerswap_health,
            "bonzo": bonzo_health,
            "overall": saucerswap_health and bonzo_health
        }
    
    def cleanup(self):
        """Clean up resources."""
        self.executor.shutdown(wait=True)