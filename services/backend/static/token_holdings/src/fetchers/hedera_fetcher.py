"""Hedera token data fetcher with rate limiting, error handling, and USD filtering."""

import time
import requests
import uuid
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from tqdm import tqdm
import logging

from ..config import (
    HEDERA_ACCOUNTS_ENDPOINT, HEDERA_TOKENS_ENDPOINT,
    RATE_LIMIT_SLEEP, MAX_PAGE_SIZE, REQUEST_TIMEOUT,
    MAX_RETRIES, BACKOFF_FACTOR, DEFAULT_HEADERS,
    MIN_BALANCE_THRESHOLDS, PROGRESS_REPORT_INTERVAL,
    get_saucerswap_api_key
)
from ..database import get_session, TokenMetadata, TokenHolding, RefreshLog, TokenPriceHistory
from ..services import SaucerSwapPricingService, TokenFilterService

logger = logging.getLogger(__name__)


class HederaTokenFetcher:
    """Fetches token holder data from Hedera mirror node API with USD filtering capabilities."""
    
    def __init__(self, enable_usd_features: bool = True):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.request_count = 0
        
        # Initialize pricing services if API key is available
        self.pricing_service = None
        self.filter_service = None
        
        if enable_usd_features:
            api_key = get_saucerswap_api_key()
            if api_key:
                self.pricing_service = SaucerSwapPricingService(api_key)
                self.filter_service = TokenFilterService(self.pricing_service)
                logger.info("USD pricing features enabled with SaucerSwap API")
            else:
                logger.warning("USD features disabled - SaucerSwap API key not available")
        
    def _log_operation(self, db_session, token_symbol: str, operation: str, 
                      message: str = None, refresh_batch_id: str = None,
                      request_count: int = None, accounts_processed: int = None,
                      processing_time: float = None, min_usd_filter: Decimal = None,
                      price_usd_used: Decimal = None):
        """Log operation to database with USD filtering info."""
        log_entry = RefreshLog(
            token_symbol=token_symbol,
            operation=operation,
            message=message,
            refresh_batch_id=refresh_batch_id,
            request_count=request_count,
            accounts_processed=accounts_processed,
            processing_time_seconds=processing_time,
            min_usd_filter=min_usd_filter,
            price_usd_used=price_usd_used
        )
        db_session.add(log_entry)
        db_session.commit()
        
    def _make_request_with_retry(self, url: str, params: Dict = None) -> Optional[Dict]:
        """Make HTTP request with retry logic and rate limiting."""
        self.request_count += 1
        
        for attempt in range(MAX_RETRIES):
            try:
                if params:
                    response = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
                else:
                    response = self.session.get(url, timeout=REQUEST_TIMEOUT)
                
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", BACKOFF_FACTOR ** attempt))
                    print(f"  ⚠️  Rate limited (429). Waiting {retry_after}s...")
                    time.sleep(retry_after)
                    continue
                    
                response.raise_for_status()
                time.sleep(RATE_LIMIT_SLEEP)  # Respect rate limits
                return response.json()
                
            except requests.RequestException as e:
                wait_time = BACKOFF_FACTOR ** attempt
                print(f"  ⚠️  Request failed (attempt {attempt + 1}/{MAX_RETRIES}): {e}")
                if attempt < MAX_RETRIES - 1:
                    print(f"     Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    print(f"     Max retries exceeded")
                    return None
                    
        return None
    
    def _update_token_price_info(self, db_session, token_symbol: str, token_id: str) -> Tuple[Optional[Decimal], Optional[Decimal]]:
        """Update token price information in database and return current prices."""
        if not self.pricing_service:
            return None, None
        
        try:
            # Get current price from SaucerSwap
            price_usd = self.pricing_service.get_token_price_usd(token_id)
            if not price_usd:
                return None, None
            
            tokens_per_usd = Decimal("1") / price_usd if price_usd > 0 else None
            
            # Update token metadata
            metadata = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
            if metadata:
                metadata.price_usd = price_usd
                metadata.price_updated_at = datetime.utcnow()
                metadata.tokens_per_usd = tokens_per_usd
            
            # Store price history
            price_history = TokenPriceHistory(
                token_symbol=token_symbol,
                token_id=token_id,
                price_usd=price_usd,
                tokens_per_usd=tokens_per_usd or Decimal("0"),
                source='saucerswap'
            )
            db_session.add(price_history)
            db_session.commit()
            
            logger.info(f"Updated price info for {token_symbol}: ${price_usd} USD, {tokens_per_usd} tokens per USD")
            return price_usd, tokens_per_usd
            
        except Exception as e:
            logger.error(f"Error updating price info for {token_symbol}: {e}")
            return None, None
    
    def fetch_hbar_holders(self, max_accounts: Optional[int] = None, min_usd_value: Optional[Decimal] = None) -> List[Dict]:
        """Fetch HBAR holders from Hedera mirror node with optional USD filtering."""
        if max_accounts:
            print(f"🔍 Fetching HBAR holders (max: {max_accounts:,})")
        else:
            print(f"🔍 Fetching HBAR holders (unlimited)")
        if min_usd_value:
            print(f"💰 USD filter: min=${min_usd_value}")
        
        holders = []
        url = HEDERA_ACCOUNTS_ENDPOINT
        params = {
            "account.balance": f"gt:{MIN_BALANCE_THRESHOLDS['HBAR']}",
            "limit": MAX_PAGE_SIZE
        }
        
        with tqdm(desc="HBAR holders", unit="accounts") as pbar:
            while url and (max_accounts is None or len(holders) < max_accounts):
                if self.request_count % PROGRESS_REPORT_INTERVAL == 0 and holders:
                    last = holders[-1]
                    usd_info = f" (${last.get('usd_value', 'N/A')} USD)" if 'usd_value' in last else ""
                    print(f"  📊 Request #{self.request_count}: {len(holders):,} accounts | "
                          f"Last: {last['account_id']} ({last['balance_hbar']:.4f} HBAR{usd_info})")
                
                # Make request
                if "?" in url:
                    data = self._make_request_with_retry(url)
                else:
                    data = self._make_request_with_retry(url, params)
                    
                if not data:
                    print(f"  ❌ Failed to fetch data, stopping")
                    break
                
                # Process accounts
                for account in data.get("accounts", []):
                    raw_balance = account.get("balance", 0)
                    if isinstance(raw_balance, dict):
                        raw_balance = raw_balance.get("balance", raw_balance.get("tinybars", 0))
                    
                    try:
                        tinybars = int(Decimal(raw_balance).to_integral_value(rounding="ROUND_DOWN"))
                    except (InvalidOperation, TypeError):
                        print(f"  ⚠️  Invalid balance {raw_balance} for {account.get('account')}")
                        continue
                    
                    hbar_balance = float(Decimal(tinybars) / Decimal("1e8"))
                    
                    holder = {
                        "account_id": account.get("account"),
                        "balance_hbar": hbar_balance,
                        "balance_tinybars": tinybars
                    }
                    
                    holders.append(holder)
                    pbar.update(1)
                    
                    if max_accounts and len(holders) >= max_accounts:
                        print(f"  ✅ Reached {max_accounts:,} accounts limit")
                        break
                
                # Get next page
                next_link = data.get("links", {}).get("next")
                if next_link:
                    url = f"https://mainnet-public.mirrornode.hedera.com{next_link}"
                    params = None
                else:
                    print(f"  ✅ No more pages. Total: {len(holders):,} accounts")
                    break
        
        # Apply USD filtering if requested and pricing service is available
        if min_usd_value and self.filter_service:
            print(f"💰 Applying USD filters...")
            holders = self.filter_service.filter_holders_by_usd_value(
                holders, "0.0.0", min_usd_value, "balance_hbar"
            )
        elif self.filter_service:
            # Add USD values even if not filtering
            holders = self.filter_service.calculate_usd_values(holders, "0.0.0", "balance_hbar")
        
        return holders
    
    def fetch_token_holders(self, token_id: str, token_symbol: str, max_accounts: Optional[int] = None,
                           min_usd_value: Optional[Decimal] = None) -> List[Dict]:
        """Fetch holders for a specific token with optional USD filtering."""
        if max_accounts:
            print(f"🔍 Fetching {token_symbol} holders (ID: {token_id}, max: {max_accounts:,})")
        else:
            print(f"🔍 Fetching {token_symbol} holders (ID: {token_id}, unlimited)")
        if min_usd_value:
            print(f"💰 USD filter: min=${min_usd_value}")
        
        holders = []
        url = f"{HEDERA_TOKENS_ENDPOINT}/{token_id}/balances"
        params = {
            "account.balance": f"gt:{MIN_BALANCE_THRESHOLDS.get(token_symbol, 1)}",
            "limit": MAX_PAGE_SIZE
        }
        
        with tqdm(desc=f"{token_symbol} holders", unit="accounts") as pbar:
            while url and (max_accounts is None or len(holders) < max_accounts):
                if self.request_count % PROGRESS_REPORT_INTERVAL == 0 and holders:
                    last = holders[-1]
                    usd_info = f" (${last.get('usd_value', 'N/A')} USD)" if 'usd_value' in last else ""
                    print(f"  📊 Request #{self.request_count}: {len(holders):,} accounts | "
                          f"Last: {last['account_id']} ({last['balance']:.4f} {token_symbol}{usd_info})")
                
                # Make request  
                if "?" in url:
                    data = self._make_request_with_retry(url)
                else:
                    data = self._make_request_with_retry(url, params)
                    
                if not data:
                    print(f"  ❌ Failed to fetch data, stopping")
                    break
                
                # Process balances
                for balance_entry in data.get("balances", []):
                    account_id = balance_entry.get("account")
                    raw_balance = balance_entry.get("balance", 0)
                    
                    try:
                        balance = float(Decimal(raw_balance))
                    except (InvalidOperation, TypeError):
                        print(f"  ⚠️  Invalid balance {raw_balance} for {account_id}")
                        continue
                    
                    holder = {
                        "account_id": account_id,
                        "balance": balance,
                        f"balance_{token_symbol.lower()}": balance
                    }
                    
                    holders.append(holder)
                    pbar.update(1)
                    
                    if max_accounts and len(holders) >= max_accounts:
                        print(f"  ✅ Reached {max_accounts:,} accounts limit")
                        break
                
                # Get next page
                next_link = data.get("links", {}).get("next")
                if next_link:
                    url = f"https://mainnet-public.mirrornode.hedera.com{next_link}"
                    params = None
                else:
                    print(f"  ✅ No more pages. Total: {len(holders):,} accounts")
                    break
        
        # Apply USD filtering if requested and pricing service is available
        if min_usd_value and self.filter_service:
            print(f"💰 Applying USD filters...")
            holders = self.filter_service.filter_holders_by_usd_value(
                holders, token_id, min_usd_value, "balance"
            )
        elif self.filter_service:
            # Add USD values even if not filtering
            holders = self.filter_service.calculate_usd_values(holders, token_id, "balance")
        
        return holders
    
    def calculate_top_holders_and_percentiles(self, holders: List[Dict], token_symbol: str) -> Tuple[List[Dict], List[Dict]]:
        """Calculate top holders and percentile markers with USD values."""
        if not holders:
            return [], []
        
        # Sort by balance descending
        balance_key = "balance_hbar" if token_symbol == "HBAR" else "balance"
        sorted_holders = sorted(holders, key=lambda x: x[balance_key], reverse=True)
        
        total_accounts = len(sorted_holders)
        print(f"  📈 Calculating statistics for {total_accounts:,} {token_symbol} holders...")
        
        # Top 10 holders
        top_holders = []
        for rank, holder in enumerate(sorted_holders[:10], 1):
            top_holders.append({
                **holder,
                "rank": rank,
                "percentile": None,
                "is_top_holder": True,
                "is_percentile_marker": False
            })
        
        # Percentile markers (99-1)
        percentile_holders = []
        for percentile in range(99, 0, -1):
            # Calculate position for this percentile
            position = max(0, int((percentile / 100.0) * total_accounts) - 1)
            position = min(position, total_accounts - 1)
            
            holder = sorted_holders[position].copy()
            holder.update({
                "rank": position + 1,
                "percentile": percentile,
                "is_top_holder": False,
                "is_percentile_marker": True
            })
            percentile_holders.append(holder)
        
        print(f"  ✅ Generated {len(top_holders)} top holders and {len(percentile_holders)} percentile markers")
        return top_holders, percentile_holders
    
    def refresh_token_data(self, token_symbol: str, token_id: str, max_accounts: Optional[int] = None,
                          min_usd_value: Optional[Decimal] = None) -> bool:
        """Complete refresh process for a token with optional USD filtering."""
        db_session = get_session()
        refresh_batch_id = str(uuid.uuid4())
        start_time = datetime.utcnow()
        
        try:
            print(f"\n🚀 Starting refresh for {token_symbol} (ID: {token_id})")
            
            # Update metadata - refresh started
            metadata = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
            if not metadata:
                metadata = TokenMetadata(
                    token_symbol=token_symbol,
                    token_id=token_id
                )
                db_session.add(metadata)
            
            metadata.last_refresh_started = start_time
            metadata.refresh_in_progress = True
            metadata.error_message = None
            db_session.commit()
            
            # Update price information
            price_usd, tokens_per_usd = self._update_token_price_info(db_session, token_symbol, token_id)
            
            self._log_operation(db_session, token_symbol, "fetch_started", 
                              f"Starting data refresh with USD filtering", refresh_batch_id,
                              min_usd_filter=min_usd_value, price_usd_used=price_usd)
            
            # Fetch holders
            if token_symbol == "HBAR":
                holders = self.fetch_hbar_holders(max_accounts, min_usd_value)
            else:
                holders = self.fetch_token_holders(token_id, token_symbol, max_accounts, min_usd_value)
            
            if not holders:
                raise Exception("No holders data fetched")
            
            # Calculate statistics
            top_holders, percentile_holders = self.calculate_top_holders_and_percentiles(holders, token_symbol)
            
            # Clear old data for this token
            db_session.query(TokenHolding).filter_by(token_symbol=token_symbol).delete()
            
            # Store new data
            balance_key = "balance_hbar" if token_symbol == "HBAR" else "balance"
            
            # Store top holders
            for holder_data in top_holders:
                holding = TokenHolding(
                    token_symbol=token_symbol,
                    account_id=holder_data["account_id"],
                    balance=holder_data[balance_key],
                    balance_rank=holder_data["rank"],
                    percentile_rank=None,
                    is_top_holder=True,
                    is_percentile_marker=False,
                    usd_value=Decimal(str(holder_data.get("usd_value", 0))) if holder_data.get("usd_value") else None,
                    price_usd_at_refresh=price_usd,
                    refresh_batch_id=refresh_batch_id
                )
                db_session.add(holding)
            
            # Store percentile markers
            for holder_data in percentile_holders:
                holding = TokenHolding(
                    token_symbol=token_symbol,
                    account_id=holder_data["account_id"],
                    balance=holder_data[balance_key],
                    balance_rank=holder_data["rank"],
                    percentile_rank=float(holder_data["percentile"]),
                    is_top_holder=False,
                    is_percentile_marker=True,
                    usd_value=Decimal(str(holder_data.get("usd_value", 0))) if holder_data.get("usd_value") else None,
                    price_usd_at_refresh=price_usd,
                    refresh_batch_id=refresh_batch_id
                )
                db_session.add(holding)
            
            # Update metadata - success
            end_time = datetime.utcnow()
            processing_time = (end_time - start_time).total_seconds()
            
            metadata.last_refresh_completed = end_time
            metadata.refresh_in_progress = False
            metadata.last_refresh_success = True
            metadata.total_accounts_fetched = len(holders)
            
            db_session.commit()
            
            self._log_operation(db_session, token_symbol, "fetch_completed",
                              f"Successfully refreshed {len(holders):,} accounts",
                              refresh_batch_id, self.request_count, len(holders), processing_time,
                              min_usd_value, price_usd)
            
            # Enhanced summary with USD info
            print(f"✅ {token_symbol} refresh completed in {processing_time:.1f}s")
            print(f"   📊 {len(holders):,} total accounts | {len(top_holders)} top holders | {len(percentile_holders)} percentiles")
            if price_usd:
                print(f"   💰 Current price: ${price_usd} USD | {tokens_per_usd:.2f} tokens per USD")
            if min_usd_value:
                print(f"   🔍 USD filter applied: min=${min_usd_value}")
            
            return True
            
        except Exception as e:
            # Update metadata - error
            metadata.refresh_in_progress = False
            metadata.last_refresh_success = False
            metadata.error_message = str(e)
            db_session.commit()
            
            self._log_operation(db_session, token_symbol, "error", str(e), refresh_batch_id)
            
            print(f"❌ {token_symbol} refresh failed: {e}")
            return False
            
        finally:
            db_session.close()
            self.request_count = 0  # Reset for next token 