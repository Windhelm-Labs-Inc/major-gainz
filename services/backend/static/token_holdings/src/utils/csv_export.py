"""CSV export utilities for token holdings data."""

import os
import hashlib
import pandas as pd
from pathlib import Path
from typing import Optional
from datetime import datetime
import logging

from ..database import get_session, TokenHolding, TokenMetadata, get_db_session
from ..config import ensure_temp_dir

logger = logging.getLogger(__name__)


def hash_file(filepath: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except (IOError, OSError) as e:
        logger.error(f"Error hashing file {filepath}: {e}")
        raise


def export_to_csv(token_symbol: str, include_percentiles: bool = True) -> Optional[str]:
    """Export token holdings data to CSV file."""
    temp_dir = ensure_temp_dir()
    
    try:
        with get_db_session() as db_session:
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
                try:
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
                    
                    # Add USD fields if available
                    if hasattr(holding, 'usd_value') and holding.usd_value is not None:
                        row['usd_value'] = float(holding.usd_value)
                    if hasattr(holding, 'price_usd_at_refresh') and holding.price_usd_at_refresh is not None:
                        row['price_usd_at_refresh'] = float(holding.price_usd_at_refresh)
                    
                    data.append(row)
                except AttributeError as e:
                    logger.warning(f"Missing expected field in holding data: {e}")
                    continue
            
            if not data:
                print(f"  ⚠️  No valid data to export for {token_symbol}")
                return None
            
            try:
                df = pd.DataFrame(data)
            except (ValueError, TypeError) as e:
                logger.error(f"Error creating DataFrame for {token_symbol}: {e}")
                print(f"  ❌ Failed to create data structure for export: {e}")
                return None
            
            # Sort data (top holders first, then by rank/percentile)
            try:
                df = df.sort_values([
                    'is_top_holder', 
                    'balance_rank', 
                    'percentile_rank'
                ], ascending=[False, True, False])
            except KeyError as e:
                logger.warning(f"Error sorting data for {token_symbol}: {e}")
                # Continue without sorting if columns are missing
            
            # Generate filename with timestamp
            timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            filename = f"{token_symbol.lower()}_holdings_{timestamp}.csv"
            filepath = temp_dir / filename
            
            # Export to CSV
            try:
                df.to_csv(filepath, index=False)
            except (IOError, OSError, PermissionError) as e:
                logger.error(f"Error writing CSV file {filepath}: {e}")
                print(f"  ❌ Failed to write CSV file: {e}")
                return None
            
            # Calculate file hash
            try:
                file_hash = hash_file(filepath)
            except Exception as e:
                logger.error(f"Error calculating file hash: {e}")
                file_hash = "unknown"
            
            # Update metadata with CSV info
            try:
                metadata = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
                if metadata:
                    metadata.csv_filepath = str(filepath)
                    metadata.csv_file_hash = file_hash
                    # Note: commit handled by context manager
            except Exception as e:
                logger.warning(f"Error updating metadata for {token_symbol}: {e}")
                # Continue anyway - file was exported successfully
            
            print(f"  ✅ Exported {len(df)} records to: {filepath}")
            print(f"  🔐 File hash: {file_hash[:16]}...")
            
            return str(filepath)
            
    except RuntimeError as e:
        # Database errors from our context manager
        print(f"  ❌ Database error during CSV export: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during CSV export for {token_symbol}: {e}")
        print(f"  ❌ CSV export failed unexpectedly: {e}")
        return None


def export_all_tokens_summary() -> Optional[str]:
    """Export a summary CSV with all tokens' top holders."""
    temp_dir = ensure_temp_dir()
    
    try:
        with get_db_session() as db_session:
            print("📊 Exporting summary of all tokens...")
            
            # Query top holders for all tokens
            try:
                holdings = db_session.query(TokenHolding).filter_by(is_top_holder=True).all()
            except Exception as e:
                logger.error(f"Error querying top holders: {e}")
                print(f"  ❌ Failed to query data: {e}")
                return None
            
            if not holdings:
                print("  ⚠️  No top holder data found")
                return None
            
            # Convert to DataFrame
            data = []
            for holding in holdings:
                try:
                    row = {
                        'token_symbol': holding.token_symbol,
                        'account_id': holding.account_id,
                        'balance': holding.balance,
                        'balance_rank': holding.balance_rank,
                        'created_at': holding.created_at
                    }
                    
                    # Add USD fields if available
                    if hasattr(holding, 'usd_value') and holding.usd_value is not None:
                        row['usd_value'] = float(holding.usd_value)
                    if hasattr(holding, 'price_usd_at_refresh') and holding.price_usd_at_refresh is not None:
                        row['price_usd_at_refresh'] = float(holding.price_usd_at_refresh)
                    
                    data.append(row)
                except AttributeError as e:
                    logger.warning(f"Missing expected field in summary data: {e}")
                    continue
            
            if not data:
                print("  ⚠️  No valid data to export for summary")
                return None
            
            try:
                df = pd.DataFrame(data)
                df = df.sort_values(['token_symbol', 'balance_rank'])
            except (ValueError, TypeError, KeyError) as e:
                logger.error(f"Error processing summary data: {e}")
                print(f"  ❌ Failed to process summary data: {e}")
                return None
            
            # Generate filename
            timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
            filename = f"all_tokens_summary_{timestamp}.csv"
            filepath = temp_dir / filename
            
            try:
                df.to_csv(filepath, index=False)
            except (IOError, OSError, PermissionError) as e:
                logger.error(f"Error writing summary CSV file {filepath}: {e}")
                print(f"  ❌ Failed to write summary file: {e}")
                return None
            
            print(f"  ✅ Exported summary with {len(df)} records to: {filepath}")
            return str(filepath)
            
    except RuntimeError as e:
        # Database errors from our context manager
        print(f"  ❌ Database error during summary export: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during summary export: {e}")
        print(f"  ❌ Summary export failed unexpectedly: {e}")
        return None 