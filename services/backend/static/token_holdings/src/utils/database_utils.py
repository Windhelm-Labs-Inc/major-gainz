"""Database utility functions for querying token holdings data."""

from typing import List, Dict, Optional
from sqlalchemy import desc
from datetime import datetime, timedelta

from ..database import get_session, TokenMetadata, TokenHolding, RefreshLog


def get_token_summary(token_symbol: str = None) -> List[Dict]:
    """Get summary information for tokens."""
    db_session = get_session()
    
    try:
        if token_symbol:
            # Get specific token
            tokens = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).all()
        else:
            # Get all tokens
            tokens = db_session.query(TokenMetadata).all()
        
        summary = []
        for token in tokens:
            # Get count of holdings
            holdings_count = db_session.query(TokenHolding).filter_by(token_symbol=token.token_symbol).count()
            top_holders_count = db_session.query(TokenHolding).filter_by(
                token_symbol=token.token_symbol, 
                is_top_holder=True
            ).count()
            percentiles_count = db_session.query(TokenHolding).filter_by(
                token_symbol=token.token_symbol, 
                is_percentile_marker=True
            ).count()
            
            summary.append({
                'token_symbol': token.token_symbol,
                'token_id': token.token_id,
                'last_refresh_started': token.last_refresh_started,
                'last_refresh_completed': token.last_refresh_completed,
                'last_refresh_success': token.last_refresh_success,
                'refresh_in_progress': token.refresh_in_progress,
                'total_accounts_fetched': token.total_accounts_fetched,
                'holdings_in_db': holdings_count,
                'top_holders_count': top_holders_count,
                'percentiles_count': percentiles_count,
                'csv_filepath': token.csv_filepath,
                'csv_file_hash': token.csv_file_hash[:16] + '...' if token.csv_file_hash else None,
                'error_message': token.error_message
            })
        
        return summary
        
    finally:
        db_session.close()


def get_tokens_needing_refresh(hours_threshold: int = 24) -> List[Dict]:
    """Get tokens that need refresh based on age threshold."""
    db_session = get_session()
    
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_threshold)
        
        # Get all tokens from config first
        from ..config import load_tokens_config
        tokens_config = load_tokens_config()
        
        result = []
        
        for token_symbol, token_id in tokens_config.items():
            # Check if token exists in metadata
            metadata = db_session.query(TokenMetadata).filter_by(token_symbol=token_symbol).first()
            
            needs_refresh = False
            last_refresh = None
            reason = ""
            
            if not metadata:
                needs_refresh = True
                reason = "Never refreshed"
            elif not metadata.last_refresh_success:
                needs_refresh = True
                last_refresh = metadata.last_refresh_completed
                reason = "Last refresh failed"
            elif not metadata.last_refresh_completed:
                needs_refresh = True
                reason = "No successful refresh"
            elif metadata.last_refresh_completed < cutoff_time:
                needs_refresh = True
                last_refresh = metadata.last_refresh_completed
                age_hours = (datetime.utcnow() - metadata.last_refresh_completed).total_seconds() / 3600
                reason = f"Data is {age_hours:.1f} hours old"
            elif metadata.refresh_in_progress:
                needs_refresh = False
                last_refresh = metadata.last_refresh_started
                reason = "Refresh currently in progress"
            else:
                needs_refresh = False
                last_refresh = metadata.last_refresh_completed
                age_hours = (datetime.utcnow() - metadata.last_refresh_completed).total_seconds() / 3600
                reason = f"Data is {age_hours:.1f} hours old (fresh)"
            
            result.append({
                'token_symbol': token_symbol,
                'token_id': token_id,
                'needs_refresh': needs_refresh,
                'last_refresh_completed': last_refresh,
                'reason': reason,
                'total_accounts': metadata.total_accounts_fetched if metadata else 0,
                'refresh_in_progress': metadata.refresh_in_progress if metadata else False
            })
        
        return result
        
    finally:
        db_session.close()


def get_top_holders(token_symbol: str, limit: int = 10) -> List[Dict]:
    """Get top holders for a token."""
    db_session = get_session()
    
    try:
        holdings = db_session.query(TokenHolding).filter_by(
            token_symbol=token_symbol,
            is_top_holder=True
        ).order_by(TokenHolding.balance_rank).limit(limit).all()
        
        result = []
        for holding in holdings:
            result.append({
                'rank': holding.balance_rank,
                'account_id': holding.account_id,
                'balance': holding.balance,
                'created_at': holding.created_at
            })
        
        return result
        
    finally:
        db_session.close()


def get_percentiles(token_symbol: str, percentile_range: List[int] = None) -> List[Dict]:
    """Get percentile markers for a token."""
    db_session = get_session()
    
    try:
        query = db_session.query(TokenHolding).filter_by(
            token_symbol=token_symbol,
            is_percentile_marker=True
        )
        
        if percentile_range:
            query = query.filter(TokenHolding.percentile_rank.in_(percentile_range))
        
        holdings = query.order_by(desc(TokenHolding.percentile_rank)).all()
        
        result = []
        for holding in holdings:
            result.append({
                'percentile': holding.percentile_rank,
                'rank': holding.balance_rank,
                'account_id': holding.account_id,
                'balance': holding.balance,
                'created_at': holding.created_at
            })
        
        return result
        
    finally:
        db_session.close()


def get_refresh_logs(token_symbol: str = None, limit: int = 50) -> List[Dict]:
    """Get refresh operation logs."""
    db_session = get_session()
    
    try:
        query = db_session.query(RefreshLog)
        
        if token_symbol:
            query = query.filter_by(token_symbol=token_symbol)
        
        logs = query.order_by(desc(RefreshLog.created_at)).limit(limit).all()
        
        result = []
        for log in logs:
            result.append({
                'token_symbol': log.token_symbol,
                'operation': log.operation,
                'message': log.message,
                'request_count': log.request_count,
                'accounts_processed': log.accounts_processed,
                'processing_time_seconds': log.processing_time_seconds,
                'refresh_batch_id': log.refresh_batch_id,
                'created_at': log.created_at
            })
        
        return result
        
    finally:
        db_session.close()


def cleanup_old_data(token_symbol: str = None, keep_latest_n: int = 5) -> int:
    """Clean up old refresh data, keeping only the latest N refreshes."""
    db_session = get_session()
    
    try:
        if token_symbol:
            tokens = [token_symbol]
        else:
            # Get all tokens
            token_results = db_session.query(TokenMetadata.token_symbol).all()
            tokens = [t[0] for t in token_results]
        
        total_deleted = 0
        
        for token in tokens:
            # Get unique batch IDs for this token, ordered by creation date
            batch_results = db_session.query(TokenHolding.refresh_batch_id, TokenHolding.created_at).filter_by(
                token_symbol=token
            ).distinct().order_by(desc(TokenHolding.created_at)).all()
            
            if len(batch_results) > keep_latest_n:
                # Delete old batches
                old_batches = [b[0] for b in batch_results[keep_latest_n:]]
                
                deleted_count = db_session.query(TokenHolding).filter(
                    TokenHolding.token_symbol == token,
                    TokenHolding.refresh_batch_id.in_(old_batches)
                ).delete(synchronize_session=False)
                
                total_deleted += deleted_count
                
                print(f"  🗑️  Cleaned up {deleted_count} old records for {token}")
        
        db_session.commit()
        return total_deleted
        
    finally:
        db_session.close() 