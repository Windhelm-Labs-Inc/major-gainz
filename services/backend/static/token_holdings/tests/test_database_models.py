"""Tests for database models."""

import pytest
from decimal import Decimal
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.database.models import Base, TokenMetadata, TokenHolding, TokenPriceHistory, RefreshLog


class TestDatabaseModels:
    """Test suite for database models."""
    
    @pytest.fixture
    def db_session(self):
        """Create in-memory database session for testing."""
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine)
        
        SessionLocal = sessionmaker(bind=engine)
        session = SessionLocal()
        
        yield session
        
        session.close()
    
    def test_token_metadata_creation(self, db_session):
        """Test TokenMetadata model creation and fields."""
        metadata = TokenMetadata(
            token_symbol="TEST",
            token_id="0.0.test",
            price_usd=Decimal("0.05"),
            tokens_per_usd=Decimal("20.0"),
            total_accounts_fetched=1000
        )
        
        db_session.add(metadata)
        db_session.commit()
        
        # Query back and verify
        retrieved = db_session.query(TokenMetadata).filter_by(token_symbol="TEST").first()
        assert retrieved is not None
        assert retrieved.token_symbol == "TEST"
        assert retrieved.token_id == "0.0.test"
        assert retrieved.price_usd == Decimal("0.05")
        assert retrieved.tokens_per_usd == Decimal("20.0")
        assert retrieved.total_accounts_fetched == 1000
        assert retrieved.created_at is not None
        assert retrieved.updated_at is not None
    
    def test_token_holding_creation(self, db_session):
        """Test TokenHolding model creation and USD fields."""
        holding = TokenHolding(
            token_symbol="TEST",
            account_id="0.0.123",
            balance=1000.5,
            balance_rank=1,
            percentile_rank=99.5,
            is_top_holder=True,
            usd_value=Decimal("50.025"),
            price_usd_at_refresh=Decimal("0.05"),
            refresh_batch_id="test-batch-123"
        )
        
        db_session.add(holding)
        db_session.commit()
        
        # Query back and verify
        retrieved = db_session.query(TokenHolding).filter_by(account_id="0.0.123").first()
        assert retrieved is not None
        assert retrieved.token_symbol == "TEST"
        assert retrieved.account_id == "0.0.123"
        assert retrieved.balance == 1000.5
        assert retrieved.balance_rank == 1
        assert retrieved.percentile_rank == 99.5
        assert retrieved.is_top_holder is True
        assert retrieved.usd_value == Decimal("50.02")  # DECIMAL(20, 2) rounds to 2 decimal places
        assert retrieved.price_usd_at_refresh == Decimal("0.05")
        assert retrieved.refresh_batch_id == "test-batch-123"
        assert retrieved.created_at is not None
    
    def test_token_price_history_creation(self, db_session):
        """Test TokenPriceHistory model creation."""
        price_history = TokenPriceHistory(
            token_symbol="TEST",
            token_id="0.0.test",
            price_usd=Decimal("0.05"),
            tokens_per_usd=Decimal("20.0"),
            source="saucerswap"
        )
        
        db_session.add(price_history)
        db_session.commit()
        
        # Query back and verify
        retrieved = db_session.query(TokenPriceHistory).filter_by(token_symbol="TEST").first()
        assert retrieved is not None
        assert retrieved.token_symbol == "TEST"
        assert retrieved.token_id == "0.0.test"
        assert retrieved.price_usd == Decimal("0.05")
        assert retrieved.tokens_per_usd == Decimal("20.0")
        assert retrieved.source == "saucerswap"
        assert retrieved.created_at is not None
    
    def test_refresh_log_with_usd_filters(self, db_session):
        """Test RefreshLog model with USD filtering information."""
        log = RefreshLog(
            token_symbol="TEST",
            operation="fetch_completed",
            message="Test message",
            request_count=50,
            accounts_processed=1000,
            processing_time_seconds=120.5,
            refresh_batch_id="test-batch-123",
            min_usd_filter=Decimal("10.0"),
            price_usd_used=Decimal("0.05")
        )
        
        db_session.add(log)
        db_session.commit()
        
        # Query back and verify
        retrieved = db_session.query(RefreshLog).filter_by(token_symbol="TEST").first()
        assert retrieved is not None
        assert retrieved.token_symbol == "TEST"
        assert retrieved.operation == "fetch_completed"
        assert retrieved.message == "Test message"
        assert retrieved.request_count == 50
        assert retrieved.accounts_processed == 1000
        assert retrieved.processing_time_seconds == 120.5
        assert retrieved.refresh_batch_id == "test-batch-123"
        assert retrieved.min_usd_filter == Decimal("10.0")
        assert retrieved.price_usd_used == Decimal("0.05")
        assert retrieved.created_at is not None
    
    def test_token_holding_indexes(self, db_session):
        """Test that indexes work correctly for TokenHolding."""
        # Create test data
        holdings = [
            TokenHolding(
                token_symbol="TEST",
                account_id=f"0.0.{i}",
                balance=1000 - i * 100,
                balance_rank=i + 1,
                usd_value=Decimal(str((1000 - i * 100) * 0.05)),
                refresh_batch_id="batch-1"
            )
            for i in range(5)
        ]
        
        for holding in holdings:
            db_session.add(holding)
        db_session.commit()
        
        # Test querying by token and rank (should use idx_token_rank)
        top_holder = db_session.query(TokenHolding).filter_by(
            token_symbol="TEST", balance_rank=1
        ).first()
        assert top_holder.account_id == "0.0.0"
        assert top_holder.balance == 1000
        
        # Test querying by USD value (should use idx_usd_value_desc)
        high_value_holders = db_session.query(TokenHolding).filter(
            TokenHolding.token_symbol == "TEST",
            TokenHolding.usd_value > Decimal("40.0")
        ).order_by(TokenHolding.usd_value.desc()).all()
        
        # Holdings: 50.0, 45.0, 40.0, 35.0, 30.0 - should return 2 with value > 40.0
        assert len(high_value_holders) == 2  # Holdings with USD value > $40 (50.0 and 45.0)
        assert high_value_holders[0].usd_value == Decimal("50.00")  # Highest USD value
        assert high_value_holders[1].usd_value == Decimal("45.00")  # Second highest
    
    def test_token_metadata_unique_constraint(self, db_session):
        """Test that token_symbol has unique constraint."""
        # Add first token
        metadata1 = TokenMetadata(token_symbol="TEST", token_id="0.0.1")
        db_session.add(metadata1)
        db_session.commit()
        
        # Try to add duplicate token symbol
        metadata2 = TokenMetadata(token_symbol="TEST", token_id="0.0.2")
        db_session.add(metadata2)
        
        with pytest.raises(Exception):  # Should raise integrity error
            db_session.commit()
    
    def test_decimal_precision(self, db_session):
        """Test that decimal fields maintain precision."""
        # Test high precision price
        precise_price = Decimal("0.0000123456")
        metadata = TokenMetadata(
            token_symbol="PRECISE",
            token_id="0.0.precise",
            price_usd=precise_price,
            tokens_per_usd=Decimal("1") / precise_price
        )
        
        db_session.add(metadata)
        db_session.commit()
        
        # Query back and verify precision is maintained
        retrieved = db_session.query(TokenMetadata).filter_by(token_symbol="PRECISE").first()
        assert retrieved.price_usd == precise_price
        
        # Test USD value precision in holdings
        holding = TokenHolding(
            token_symbol="PRECISE",
            account_id="0.0.test",
            balance=123456.789,
            usd_value=Decimal("123456.789") * precise_price,
            refresh_batch_id="batch-1"
        )
        
        db_session.add(holding)
        db_session.commit()
        
        retrieved_holding = db_session.query(TokenHolding).filter_by(account_id="0.0.test").first()
        expected_usd = Decimal("123456.789") * precise_price
        assert abs(retrieved_holding.usd_value - expected_usd) < Decimal("0.01")  # Within 1 cent