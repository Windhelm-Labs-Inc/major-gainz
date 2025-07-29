"""Token filtering service for USD-based holder filtering."""

from typing import List, Dict, Optional
from decimal import Decimal
import logging

from .pricing_service import PricingServiceInterface

logger = logging.getLogger(__name__)


class TokenFilterService:
    """Service for filtering token holders based on various criteria."""
    
    def __init__(self, pricing_service: PricingServiceInterface):
        self.pricing_service = pricing_service
    
    def filter_holders_by_usd_value(
        self, 
        holders: List[Dict], 
        token_id: str, 
        min_usd_value: Optional[Decimal] = None,
        balance_key: str = "balance"
    ) -> List[Dict]:
        """Filter holders based on USD value of their holdings."""
        if not min_usd_value:
            return holders
        
        price_usd = self.pricing_service.get_token_price_usd(token_id)
        if not price_usd:
            logger.warning(f"Cannot filter by USD value - no price data for token {token_id}")
            return holders
        
        filtered_holders = []
        
        for holder in holders:
            try:
                balance_value = holder.get(balance_key, 0)
                
                # Skip invalid balance values
                if balance_value is None or balance_value == "":
                    logger.warning(f"Skipping holder {holder.get('account_id')} - invalid balance value: {balance_value}")
                    continue
                
                # Convert to Decimal safely
                if isinstance(balance_value, str) and not balance_value.replace(".", "").replace("-", "").isdigit():
                    logger.warning(f"Skipping holder {holder.get('account_id')} - non-numeric balance: {balance_value}")
                    continue
                    
                balance = Decimal(str(balance_value))
                usd_value = balance * price_usd
                
                # Apply filters
                if min_usd_value and usd_value < min_usd_value:
                    continue
                
                # Add USD value to holder data
                holder_with_usd = holder.copy()
                holder_with_usd["usd_value"] = float(usd_value)
                holder_with_usd["price_usd"] = float(price_usd)
                
                filtered_holders.append(holder_with_usd)
                
            except (ValueError, TypeError, Exception) as e:
                logger.warning(f"Error calculating USD value for holder {holder.get('account_id')}: {e}")
                continue
        
        logger.info(f"Filtered {len(holders)} holders to {len(filtered_holders)} based on USD value")
        return filtered_holders
    
    def calculate_usd_values(self, holders: List[Dict], token_id: str, balance_key: str = "balance") -> List[Dict]:
        """Add USD values to holder data without filtering."""
        price_usd = self.pricing_service.get_token_price_usd(token_id)
        if not price_usd:
            logger.warning(f"Cannot calculate USD values - no price data for token {token_id}")
            return holders
        
        enriched_holders = []
        
        for holder in holders:
            try:
                balance_value = holder.get(balance_key, 0)
                
                # Skip invalid balance values
                if balance_value is None or balance_value == "":
                    enriched_holders.append(holder)
                    continue
                
                # Convert to Decimal safely
                if isinstance(balance_value, str) and not balance_value.replace(".", "").replace("-", "").isdigit():
                    enriched_holders.append(holder)
                    continue
                    
                balance = Decimal(str(balance_value))
                usd_value = balance * price_usd
                
                holder_with_usd = holder.copy()
                holder_with_usd["usd_value"] = float(usd_value)
                holder_with_usd["price_usd"] = float(price_usd)
                
                enriched_holders.append(holder_with_usd)
                
            except (ValueError, TypeError, Exception) as e:
                logger.warning(f"Error calculating USD value for holder {holder.get('account_id')}: {e}")
                enriched_holders.append(holder)
        
        return enriched_holders
    
    def get_minimum_token_balance_for_usd(self, token_id: str, usd_amount: Decimal) -> Optional[Decimal]:
        """Get minimum token balance equivalent to USD amount."""
        return self.pricing_service.get_tokens_for_usd_amount(token_id, usd_amount)