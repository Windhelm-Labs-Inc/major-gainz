"""Database models for token holdings tracking."""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()


class TokenMetadata(Base):
    """Track metadata for token data refreshes."""
    
    __tablename__ = 'token_metadata'
    
    id = Column(Integer, primary_key=True)
    token_symbol = Column(String(50), unique=True, nullable=False, index=True)
    token_id = Column(String(50), nullable=False)  # e.g., "0.0.731861"
    last_refresh_started = Column(DateTime(timezone=True), nullable=True)
    last_refresh_completed = Column(DateTime(timezone=True), nullable=True)
    last_refresh_success = Column(Boolean, default=False)
    csv_filepath = Column(String(500), nullable=True)
    csv_file_hash = Column(String(128), nullable=True)  # SHA-256 hash
    total_accounts_fetched = Column(Integer, default=0)
    refresh_in_progress = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TokenHolding(Base):
    """Store token holding data including top holders and percentiles."""
    
    __tablename__ = 'token_holdings'
    
    id = Column(Integer, primary_key=True)
    token_symbol = Column(String(50), nullable=False, index=True)
    account_id = Column(String(50), nullable=False)
    balance = Column(Float, nullable=False)
    balance_rank = Column(Integer, nullable=True)  # 1=highest, 2=second highest, etc.
    percentile_rank = Column(Float, nullable=True)  # 99.9, 99.8, etc.
    is_top_holder = Column(Boolean, default=False)  # True for top 1-10
    is_percentile_marker = Column(Boolean, default=False)  # True for 99-1 percentiles
    refresh_batch_id = Column(String(100), nullable=False)  # UUID for this refresh
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Indexes for efficient querying
    __table_args__ = (
        Index('idx_token_rank', 'token_symbol', 'balance_rank'),
        Index('idx_token_percentile', 'token_symbol', 'percentile_rank'),
        Index('idx_token_batch', 'token_symbol', 'refresh_batch_id'),
        Index('idx_balance_desc', 'token_symbol', 'balance'),
    )


class RefreshLog(Base):
    """Log refresh operations for debugging and monitoring."""
    
    __tablename__ = 'refresh_logs'
    
    id = Column(Integer, primary_key=True)
    token_symbol = Column(String(50), nullable=False, index=True)
    operation = Column(String(100), nullable=False)  # 'fetch_started', 'fetch_completed', 'error'
    message = Column(Text, nullable=True)
    request_count = Column(Integer, nullable=True)
    accounts_processed = Column(Integer, nullable=True)
    processing_time_seconds = Column(Float, nullable=True)
    refresh_batch_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now()) 