"""CSV export utilities with file hashing."""

import os
import hashlib
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from ..config import ensure_temp_dir
from ..database import get_session, TokenMetadata, TokenHolding


def calculate_file_hash(filepath: str) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except FileNotFoundError:
        return ""


def export_to_csv(token_symbol: str, include_percentiles: bool = True) -> Optional[str]:
    """Export token holdings data to CSV file."""
    db_session = get_session()
    temp_dir = ensure_temp_dir()
    
    try:
        print(f"📄 Exporting {token_symbol} data to CSV...")
        
        # Query data
        query = db_session.query(TokenHolding).filter_by(token_symbol=token_symbol)
        
        if include_percentiles:
            # Get both top holders and percentiles
            holdings = query.all()
        else:
            # Get only top holders
            holdings = query.filter_by(is_top_holder=True).all()
        
        if not holdings:
            print(f"  ⚠️  No data found for {token_symbol}")
            return None
        
        # Convert to DataFrame
        data = []
        for holding in holdings:
            row = {
                'token_symbol': holding.token_symbol,
                'account_id': holding.account_id,
                'balance': holding.balance,
                'balance_rank': holding.balance_rank,
                'percentile_rank': holding.percentile_rank,
                'is_top_holder': holding.is_top_holder,
                'is_percentile_marker': holding.is_percentile_marker,
                'refresh_batch_id': holding.refresh_batch_id,
                'created_at': holding.created_at
            }
            data.append(row)
        
        df = pd.DataFrame(data)
        
        # Sort data (top holders first, then by rank/percentile)
        df = df.sort_values([
            'is_top_holder', 
            'balance_rank', 
            'percentile_rank'
        ], ascending=[False, True, False])
        
        # Generate filename with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"{token_symbol.lower()}_holdings_{timestamp}.csv"
        filepath = temp_dir / filename
        
        # Export to CSV
        df.to_csv(filepath, index=False)
        
        # Calculate file hash
        file_hash = calculate_file_hash(str(filepath))
        
        # Update metadata with CSV info
        metadata = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
        if metadata:
            metadata.csv_filepath = str(filepath)
            metadata.csv_file_hash = file_hash
            db_session.commit()
        
        print(f"  ✅ Exported {len(df)} records to: {filepath}")
        print(f"  🔐 File hash: {file_hash[:16]}...")
        
        return str(filepath)
        
    except Exception as e:
        print(f"  ❌ CSV export failed: {e}")
        return None
        
    finally:
        db_session.close()


def export_all_tokens_summary() -> Optional[str]:
    """Export a summary CSV with all tokens' top holders."""
    db_session = get_session()
    temp_dir = ensure_temp_dir()
    
    try:
        print("📊 Exporting summary of all tokens...")
        
        # Get all tokens with data
        tokens = db_session.query(TokenMetadata).filter_by(last_refresh_success=True).all()
        
        if not tokens:
            print("  ⚠️  No token data found")
            return None
        
        all_data = []
        
        for metadata in tokens:
            # Get top 10 holders for this token
            top_holders = db_session.query(TokenHolding).filter_by(
                token_symbol=metadata.token_symbol,
                is_top_holder=True
            ).order_by(TokenHolding.balance_rank).limit(10).all()
            
            for holding in top_holders:
                row = {
                    'token_symbol': holding.token_symbol,
                    'rank': holding.balance_rank,
                    'account_id': holding.account_id,
                    'balance': holding.balance,
                    'last_refresh': metadata.last_refresh_completed,
                    'total_accounts_fetched': metadata.total_accounts_fetched
                }
                all_data.append(row)
        
        if not all_data:
            print("  ⚠️  No holdings data found")
            return None
        
        df = pd.DataFrame(all_data)
        df = df.sort_values(['token_symbol', 'rank'])
        
        # Generate filename
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        filename = f"all_tokens_summary_{timestamp}.csv"
        filepath = temp_dir / filename
        
        df.to_csv(filepath, index=False)
        
        print(f"  ✅ Exported summary with {len(df)} records to: {filepath}")
        return str(filepath)
        
    except Exception as e:
        print(f"  ❌ Summary export failed: {e}")
        return None
        
    finally:
        db_session.close() 