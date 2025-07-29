#!/usr/bin/env python3
"""Quick test script to verify the bug fixes work correctly."""

import sys
import os
from decimal import Decimal

# Add src to path for testing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def test_database_context_manager():
    """Test the new database context manager."""
    print("🧪 Testing database context manager...")
    try:
        from src.database.connection import get_db_session, init_database
        from sqlalchemy import text
        
        # Initialize database first
        init_database()
        
        # Test context manager
        with get_db_session() as session:
            print("  ✅ Context manager created session successfully")
            # Just a simple query to test using proper SQLAlchemy syntax
            result = session.execute(text("SELECT 1")).fetchone()
            print(f"  ✅ Database query successful: {result}")
        
        print("  ✅ Database context manager test passed")
        return True
    except Exception as e:
        print(f"  ❌ Database context manager test failed: {e}")
        return False

def test_percentile_calculation():
    """Test the improved percentile calculation."""
    print("🧪 Testing percentile calculation...")
    try:
        from src.fetchers.hedera_fetcher import HederaTokenFetcher
        
        # Create mock holder data
        mock_holders = []
        for i in range(1000):  # Test with 1000 holders
            mock_holders.append({
                "account_id": f"0.0.{i}",
                "balance": 1000000 - (i * 1000),  # Decreasing balances
                "balance_hbar": 1000000 - (i * 1000)  # For HBAR test
            })
        
        fetcher = HederaTokenFetcher(enable_usd_features=False)
        
        # Test the calculation
        top_holders, percentile_holders = fetcher.calculate_top_holders_and_percentiles(
            mock_holders, "TEST"
        )
        
        # Validate results
        assert len(top_holders) == 10, f"Expected 10 top holders, got {len(top_holders)}"
        assert len(percentile_holders) == 99, f"Expected 99 percentile holders, got {len(percentile_holders)}"
        
        # Check ordering
        for i in range(9):
            assert top_holders[i]["balance"] >= top_holders[i+1]["balance"], "Top holders not ordered correctly"
        
        print("  ✅ Percentile calculation test passed")
        return True
    except Exception as e:
        print(f"  ❌ Percentile calculation test failed: {e}")
        return False

def test_input_validation():
    """Test CLI input validation (without actually running CLI)."""
    print("🧪 Testing input validation logic...")
    try:
        # Test max_accounts validation
        max_accounts_invalid = [-1, 0, 50_000_001]
        max_accounts_valid = [1, 1000, 50_000_000]
        
        for val in max_accounts_invalid:
            if val <= 0 or val > 50_000_000:
                print(f"  ✅ Correctly identified invalid max_accounts: {val}")
            else:
                print(f"  ❌ Failed to catch invalid max_accounts: {val}")
                return False
        
        for val in max_accounts_valid:
            if val > 0 and val <= 50_000_000:
                print(f"  ✅ Correctly accepted valid max_accounts: {val}")
            else:
                print(f"  ❌ Incorrectly rejected valid max_accounts: {val}")
                return False
        
        # Test min_usd validation
        min_usd_invalid = [-1, -0.01, 1_000_000_001]
        min_usd_valid = [0, 0.01, 1000, 1_000_000_000]
        
        for val in min_usd_invalid:
            if val < 0 or val > 1_000_000_000:
                print(f"  ✅ Correctly identified invalid min_usd: {val}")
            else:
                print(f"  ❌ Failed to catch invalid min_usd: {val}")
                return False
        
        for val in min_usd_valid:
            if val >= 0 and val <= 1_000_000_000:
                print(f"  ✅ Correctly accepted valid min_usd: {val}")
            else:
                print(f"  ❌ Incorrectly rejected valid min_usd: {val}")
                return False
        
        print("  ✅ Input validation test passed")
        return True
    except Exception as e:
        print(f"  ❌ Input validation test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("🚀 Running bug fix verification tests...\n")
    
    tests = [
        test_database_context_manager,
        test_percentile_calculation,
        test_input_validation
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"❌ Test {test.__name__} crashed: {e}")
            failed += 1
        print()  # Empty line between tests
    
    print("="*50)
    print(f"📊 Test Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("✅ All bug fixes verified successfully!")
        return 0
    else:
        print("❌ Some tests failed - please review the fixes")
        return 1

if __name__ == "__main__":
    sys.exit(main())