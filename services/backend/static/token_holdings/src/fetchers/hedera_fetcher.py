"""Hedera token data fetcher with rate limiting and error handling."""

import time
import requests
import uuid
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from tqdm import tqdm

from ..config import (
    HEDERA_ACCOUNTS_ENDPOINT, HEDERA_TOKENS_ENDPOINT,
    RATE_LIMIT_SLEEP, MAX_PAGE_SIZE, REQUEST_TIMEOUT,
    MAX_RETRIES, BACKOFF_FACTOR, DEFAULT_HEADERS,
    MIN_BALANCE_THRESHOLDS, PROGRESS_REPORT_INTERVAL
)
from ..database import get_session, TokenMetadata, TokenHolding, RefreshLog


class HederaTokenFetcher:
    """Fetches token holder data from Hedera mirror node API."""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        self.request_count = 0
        
    def _log_operation(self, db_session, token_symbol: str, operation: str, 
                      message: str = None, refresh_batch_id: str = None,
                      request_count: int = None, accounts_processed: int = None,
                      processing_time: float = None):
        """Log operation to database."""
        log_entry = RefreshLog(
            token_symbol=token_symbol,
            operation=operation,
            message=message,
            refresh_batch_id=refresh_batch_id,
            request_count=request_count,
            accounts_processed=accounts_processed,
            processing_time_seconds=processing_time
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
    
    def fetch_hbar_holders(self, max_accounts: int = 1000000) -> List[Dict]:
        """Fetch HBAR holders from Hedera mirror node."""
        print(f"🔍 Fetching HBAR holders (max: {max_accounts:,})...")
        
        holders = []
        url = HEDERA_ACCOUNTS_ENDPOINT
        params = {
            "account.balance": f"gt:{MIN_BALANCE_THRESHOLDS['HBAR']}",
            "limit": MAX_PAGE_SIZE
        }
        
        with tqdm(desc="HBAR holders", unit="accounts") as pbar:
            while url and len(holders) < max_accounts:
                if self.request_count % PROGRESS_REPORT_INTERVAL == 0 and holders:
                    last = holders[-1]
                    print(f"  📊 Request #{self.request_count}: {len(holders):,} accounts | "
                          f"Last: {last['account_id']} ({last['balance_hbar']:.4f} HBAR)")
                
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
                    
                    holders.append({
                        "account_id": account.get("account"),
                        "balance_hbar": hbar_balance,
                        "balance_tinybars": tinybars
                    })
                    
                    pbar.update(1)
                    
                    if len(holders) >= max_accounts:
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
        
        return holders
    
    def fetch_token_holders(self, token_id: str, token_symbol: str, max_accounts: int = 1000000) -> List[Dict]:
        """Fetch holders for a specific token."""
        print(f"🔍 Fetching {token_symbol} holders (ID: {token_id}, max: {max_accounts:,})...")
        
        holders = []
        url = f"{HEDERA_TOKENS_ENDPOINT}/{token_id}/balances"
        params = {
            "account.balance": f"gt:{MIN_BALANCE_THRESHOLDS.get(token_symbol, 1)}",
            "limit": MAX_PAGE_SIZE
        }
        
        with tqdm(desc=f"{token_symbol} holders", unit="accounts") as pbar:
            while url and len(holders) < max_accounts:
                if self.request_count % PROGRESS_REPORT_INTERVAL == 0 and holders:
                    last = holders[-1]
                    print(f"  📊 Request #{self.request_count}: {len(holders):,} accounts | "
                          f"Last: {last['account_id']} ({last['balance']:.4f} {token_symbol})")
                
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
                    
                    holders.append({
                        "account_id": account_id,
                        "balance": balance,
                        f"balance_{token_symbol.lower()}": balance
                    })
                    
                    pbar.update(1)
                    
                    if len(holders) >= max_accounts:
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
        
        return holders
    
    def calculate_top_holders_and_percentiles(self, holders: List[Dict], token_symbol: str) -> Tuple[List[Dict], List[Dict]]:
        """Calculate top holders and percentile markers."""
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
    
    def refresh_token_data(self, token_symbol: str, token_id: str, max_accounts: int = 1000000) -> bool:
        """Complete refresh process for a token."""
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
            
            self._log_operation(db_session, token_symbol, "fetch_started", 
                              f"Starting data refresh", refresh_batch_id)
            
            # Fetch holders
            if token_symbol == "HBAR":
                holders = self.fetch_hbar_holders(max_accounts)
            else:
                holders = self.fetch_token_holders(token_id, token_symbol, max_accounts)
            
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
                              refresh_batch_id, self.request_count, len(holders), processing_time)
            
            print(f"✅ {token_symbol} refresh completed in {processing_time:.1f}s")
            print(f"   📊 {len(holders):,} total accounts | {len(top_holders)} top holders | {len(percentile_holders)} percentiles")
            
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