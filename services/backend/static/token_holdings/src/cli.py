"""Command-line interface for token holdings tracking system."""

import sys
import click
import logging
from datetime import datetime, timedelta
from decimal import Decimal
import signal
from tabulate import tabulate
from pathlib import Path
from typing import Optional

from .config import load_tokens_config, ensure_temp_dir
from .database import init_database, get_session, get_db_session, TokenMetadata
from .fetchers import HederaTokenFetcher
from .utils import get_token_summary, get_top_holders, get_percentiles, cleanup_old_data, get_tokens_needing_refresh
from .services import validate_tokens_before_operation, TokenValidationError

# --- Graceful Shutdown Handler ---

def setup_signal_handler():
    """Sets up a signal handler for graceful shutdown."""
    
    def graceful_shutdown(signum, frame):
        print("\n🚫 Aborted! Cleaning up before exit...")
        
        try:
            with get_db_session() as session:
                # Find any tokens that were marked as "in progress" and reset them
                in_progress_tokens = session.query(TokenMetadata).filter_by(refresh_in_progress=True).all()
                
                if in_progress_tokens:
                    print("🔧 Resetting 'in progress' status for:")
                    for token_meta in in_progress_tokens:
                        print(f"  - {token_meta.token_symbol}")
                        token_meta.refresh_in_progress = False
                    
                    session.commit()
                    print("✅ Cleanup complete.")
                else:
                    print("✅ No pending operations to clean up.")
        
        except Exception as e:
            print(f"⚠️  Error during cleanup: {e}")
        
        sys.exit(1)

    signal.signal(signal.SIGINT, graceful_shutdown)

# --- Logging Configuration ---
# Configure logging with critical level visibility
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.StreamHandler(sys.stderr)  # Ensure critical messages go to stderr
    ]
)

# Set critical logger to maximum visibility
critical_logger = logging.getLogger('src.services.token_validator')
critical_logger.setLevel(logging.CRITICAL)


def handle_interactive_refresh(max_accounts: Optional[int], min_usd_decimal: Optional[Decimal], 
                               enable_usd_features: bool, stream_to_csv: bool):
    """Handle the interactive refresh process."""
    click.echo("🔎 Checking for stale token data (older than 24 hours)...")
    
    # Check which tokens need refresh
    tokens_status = get_tokens_needing_refresh(hours_threshold=24)
    
    if not tokens_status:
        click.echo("📭 No tokens found in configuration.")
        return {}
    
    # Show current status
    click.echo("\n📊 Current Token Status:")
    headers = ['Token', 'Last Refresh', 'Status', 'Accounts', 'Action Needed']
    rows = []
    
    for token_info in tokens_status:
        last_refresh = "Never"
        if token_info['last_refresh_completed']:
            last_refresh = token_info['last_refresh_completed'].strftime('%Y-%m-%d %H:%M')
        
        status_icon = "✅" if not token_info['needs_refresh'] else "⚠️"
        if token_info['refresh_in_progress']:
            status_icon = "🔄"
        
        action = "Update Recommended" if token_info['needs_refresh'] else "Up to Date"
        if token_info['refresh_in_progress']:
            action = "In Progress"
        
        rows.append([
            token_info['token_symbol'],
            last_refresh,
            f"{status_icon} {token_info['reason']}",
            f"{token_info['total_accounts']:,}" if token_info['total_accounts'] else "0",
            action
        ])
    
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))
    
    # Find tokens that need refresh
    tokens_needing_refresh = [t for t in tokens_status if t['needs_refresh'] and not t['refresh_in_progress']]
    
    if not tokens_needing_refresh:
        click.echo("\n✅ All tokens are up to date (refreshed within 24 hours)!")
        return {}
    
    # Interactive prompts for tokens needing refresh
    click.echo(f"\n🤔 Found {len(tokens_needing_refresh)} token(s) that may need updating...")
    
    tokens_to_update = {}
    
    for token_info in tokens_needing_refresh:
        token_symbol = token_info['token_symbol']
        token_id = token_info['token_id']
        reason = token_info['reason']
        
        # Create a descriptive prompt
        prompt_text = f"\n🔄 Update {token_symbol} (ID: {token_id})?\n   Reason: {reason}"
        
        if click.confirm(prompt_text, default=True):
            tokens_to_update[token_symbol] = token_id
            click.echo(f"   ✅ {token_symbol} added to update list")
        else:
            click.echo(f"   ⏭️  {token_symbol} skipped")
    
    if not tokens_to_update:
        click.echo("\n🤷 No tokens selected for update.")
        return {}
    
    # Confirm the batch update
    click.echo(f"\n📋 Selected tokens for update: {', '.join(tokens_to_update.keys())}")
    if max_accounts:
        click.echo(f"📊 Max accounts per token: {max_accounts:,}")
    else:
        click.echo(f"📊 Max accounts per token: unlimited")
    click.echo(f"📄 Export CSV during refresh: {'Yes' if stream_to_csv else 'No'}")
    
    if not click.confirm(f"\n🚀 Proceed with updating {len(tokens_to_update)} token(s)?", default=True):
        click.echo("🚫 Update cancelled by user.")
        return {}
    
    return tokens_to_update


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Token Holdings Tracking System
    
    Track and analyze token holder distributions on Hedera network.
    """
    setup_signal_handler()


@cli.command()
def init():
    """Initialize the database and create tables."""
    click.echo("🔧 Initializing database...")
    
    try:
        init_database()
        # Validate tokens configuration during initialization
        validate_tokens_before_operation("database initialization")
        click.echo("✅ Database initialized successfully!")
    except TokenValidationError as e:
        click.echo(f"❌ Database initialization failed due to token validation errors.")
        click.echo(f"Fix the token configuration and try again.")
        sys.exit(1)
    except Exception as e:
        click.echo(f"❌ Database initialization failed: {e}")
        sys.exit(1)


@cli.command()
@click.option('--token', '-t', help='Specific token symbol to refresh (e.g., HBAR, SAUCE)')
@click.option('--max-accounts', '-m', type=int, help='Maximum accounts to fetch per token (default: unlimited)')
@click.option('--export-csv', '-e', is_flag=True, help='Stream raw API data to a CSV file during refresh.')
@click.option('--interactive', '-i', is_flag=True, help='Interactive mode - prompt for tokens older than 24 hours')
@click.option('--min-usd', type=float, help='Minimum USD value filter for holders')
@click.option('--disable-usd', is_flag=True, help='Disable USD pricing features')
def refresh(token, max_accounts, export_csv, interactive, min_usd, disable_usd):
    """Refresh token holder data from Hedera API."""
    
    # Ensure database is initialized before any operations
    try:
        init_database()
    except Exception as e:
        click.echo(f"❌ Critical error: Database could not be initialized: {e}")
        sys.exit(1)
        
    # Input validation
    if max_accounts is not None:
        if max_accounts <= 0:
            click.echo("❌ Error: max-accounts must be a positive integer")
            sys.exit(1)
        if max_accounts > 50_000_000:  # 50 million seems reasonable upper bound
            click.echo("❌ Error: max-accounts too large (maximum: 50,000,000)")
            sys.exit(1)
    
    if min_usd is not None:
        if min_usd < 0:
            click.echo("❌ Error: min-usd must be non-negative")
            sys.exit(1)
        if min_usd > 1_000_000_000:  # 1 billion USD seems reasonable upper bound
            click.echo("❌ Error: min-usd too large (maximum: $1,000,000,000)")
            sys.exit(1)
    
    if disable_usd and min_usd is not None:
        click.echo("❌ Error: Cannot use --min-usd with --disable-usd")
        sys.exit(1)
    
    # CRITICAL: Validate token configuration before proceeding
    try:
        validate_tokens_before_operation("token refresh")
    except TokenValidationError:
        click.echo("❌ Token refresh aborted due to validation failures.")
        click.echo("Fix the token configuration issues above and try again.")
        sys.exit(1)
    
    tokens_config = load_tokens_config()
    
    if not tokens_config:
        click.echo("❌ No tokens configuration found!")
        sys.exit(1)
    
    # Validate token symbol if provided
    if token:
        if not isinstance(token, str) or not token.strip():
            click.echo("❌ Error: Token symbol cannot be empty")
            sys.exit(1)
        
        token = token.upper().strip()  # Normalize token symbol
        if token not in tokens_config:
            click.echo(f"❌ Token '{token}' not found in configuration!")
            click.echo(f"Available tokens: {', '.join(tokens_config.keys())}")
            sys.exit(1)
    
    # Convert USD filters to Decimal for precision
    min_usd_decimal = Decimal(str(min_usd)) if min_usd is not None else None

    # Handle interactive mode
    if interactive:
        handle_interactive_refresh(max_accounts, min_usd_decimal, not disable_usd, export_csv)
        return
    
    # Handle non-interactive mode (existing logic)
    if token:
        # Token was already validated and normalized above
        tokens_to_refresh = {token: tokens_config[token]}
    else:
        tokens_to_refresh = tokens_config
    
    click.echo(f"🚀 Starting refresh for {len(tokens_to_refresh)} token(s)...")
    if max_accounts:
        click.echo(f"📊 Max accounts per token: {max_accounts:,}")
    else:
        click.echo(f"📊 Max accounts per token: unlimited")
    
    if min_usd_decimal:
        click.echo(f"💰 USD filter: min=${min_usd_decimal}")
    
    if disable_usd:
        click.echo("⚠️  USD pricing features disabled")
    
    fetcher = HederaTokenFetcher(enable_usd_features=not disable_usd)
    successful_refreshes = []
    failed_refreshes = []
    
    start_time = datetime.utcnow()
    
    for token_symbol, token_id in tokens_to_refresh.items():
        success = fetcher.refresh_token_data(
            token_symbol, token_id, max_accounts, 
            min_usd_decimal, stream_to_csv=export_csv
        )
        
        if success:
            successful_refreshes.append(token_symbol)
            
            # The export_to_csv function is no longer used here,
            # as the CSV streaming is handled by HederaTokenFetcher.
            # If specific CSV export is needed, it should be re-added or handled differently.
        else:
            failed_refreshes.append(token_symbol)
    
    # Comprehensive summary
    end_time = datetime.utcnow()
    total_time = (end_time - start_time).total_seconds()
    
    click.echo(f"\n{'='*60}")
    click.echo(f"📋 REFRESH SUMMARY")
    click.echo(f"{'='*60}")
    click.echo(f"⏱️  Total time: {total_time:.1f} seconds")
    click.echo(f"✅ Successful: {len(successful_refreshes)} token(s)")
    
    if successful_refreshes:
        for token in successful_refreshes:
            click.echo(f"   • {token}")
    
    if failed_refreshes:
        click.echo(f"❌ Failed: {len(failed_refreshes)} token(s)")
        for token in failed_refreshes:
            click.echo(f"   • {token}")
    
    if interactive:
        click.echo(f"🎯 Interactive mode completed!")
        if successful_refreshes:
            click.echo(f"💡 Tip: Run 'make status' to see updated information")


@cli.command()
@click.option('--token', help='Specific token to check status for (e.g., HBAR)')
def status(token):
    """Show status and summary of all tokens."""
    ensure_temp_dir() # Ensure temp dir is set up for CSV files
    
    with get_db_session() as db_session:
        tokens_config = load_tokens_config()
        
        # Convert dict to list of dicts for consistent handling
        tokens = [{'symbol': symbol, 'token_id': token_id} 
                 for symbol, token_id in tokens_config.items()]
        
        if not tokens_config:
            click.echo("❌ No token configuration found. Run 'init' and 'refresh' first.")
            sys.exit(1)
            
        if token:
            tokens = [t for t in tokens if t['symbol'].upper() == token.upper()]
            if not tokens:
                click.echo(f"❌ Token '{token}' not found in configuration.")
                available_tokens = list(tokens_config.keys())
                click.echo(f"Available tokens: {', '.join(available_tokens)}")
                sys.exit(1)

        if not tokens:
            click.echo("No token data found in the database. Run 'init' and 'refresh' first.")
            return
        
        click.echo("\n" + "="*80)
        click.echo("📊 TOKEN HOLDINGS SYSTEM STATUS")
        click.echo("="*80)
        
        table_data = []
        headers = [
            "Token", "Token ID", "Last Refresh", "Status", 
            "Accounts", "Price (USD)", "Price Updated"
        ]
        
        metadata_records = {m.token_symbol: m for m in db_session.query(TokenMetadata).all()}
        
        for t in tokens:
            symbol = t['symbol']
            metadata = metadata_records.get(symbol)
            
            if not metadata:
                table_data.append([symbol, t['token_id'], "Never", "Not found", "", "", ""])
                continue
                
            last_refresh = metadata.last_refresh_completed
            if last_refresh:
                time_since_refresh = datetime.utcnow() - last_refresh.replace(tzinfo=None)
                last_refresh_str = f"{time_since_refresh.days}d {time_since_refresh.seconds//3600}h ago"
            else:
                last_refresh_str = "Never"
                
            status = "✅ OK" if metadata.last_refresh_success else "❌ Failed"
            if metadata.refresh_in_progress:
                status = "⏳ In Progress"
                
            accounts = f"{metadata.total_accounts_fetched:,}" if metadata.total_accounts_fetched else ""
            
            price_usd = f"${metadata.price_usd:.6f}" if metadata.price_usd else "N/A"
            price_updated = metadata.price_updated_at.strftime('%Y-%m-%d %H:%M') if metadata.price_updated_at else "N/A"
            
            table_data.append([
                symbol, metadata.token_id, last_refresh_str, status,
                accounts, price_usd, price_updated
            ])

        click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))
        click.echo("")


@cli.command()
@click.option('--token', '-t', required=True, help='Token symbol to query')
@click.option('--limit', '-l', default=10, help='Number of top holders to show')
def top(token, limit):
    """Show top holders for a token."""
    holders = get_top_holders(token, limit)
    
    if not holders:
        click.echo(f"📭 No top holders data found for {token}")
        return
    
    headers = ['Rank', 'Account ID', 'Balance', 'Last Updated']
    rows = []
    
    for holder in holders:
        rows.append([
            holder['rank'],
            holder['account_id'],
            f"{holder['balance']:,.8f}",
            holder['created_at'].strftime('%Y-%m-%d %H:%M')
        ])
    
    click.echo(f"🏆 Top {len(holders)} {token} Holders:")
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@cli.command()
@click.option('--token', '-t', required=True, help='Token symbol to query')
@click.option('--percentiles', '-p', default='99,95,90,75,50,25,10,5,1', help='Comma-separated percentiles to show')
def percentiles(token, percentiles):
    """Show percentile markers for a token."""
    percentile_list = [int(p.strip()) for p in percentiles.split(',')]
    percentile_data = get_percentiles(token, percentile_list)
    
    if not percentile_data:
        click.echo(f"📭 No percentile data found for {token}")
        return
    
    headers = ['Percentile', 'Rank', 'Account ID', 'Balance', 'Last Updated']
    rows = []
    
    for data in percentile_data:
        rows.append([
            f"{data['percentile']}%",
            data['rank'],
            data['account_id'],
            f"{data['balance']:,.8f}",
            data['created_at'].strftime('%Y-%m-%d %H:%M')
        ])
    
    click.echo(f"📈 {token} Percentile Markers:")
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


@cli.command()
@click.option('--token', '-t', help='Specific token to clean up')
@click.option('--keep', '-k', default=5, help='Number of latest refreshes to keep')
@click.confirmation_option(prompt='This will delete old data. Continue?')
def cleanup(token, keep):
    """Clean up old data from the database."""
    click.echo("🗑️  Cleaning up old database records...")
    cleanup_old_data(token, keep)
    click.echo("✅ Cleanup complete.")


if __name__ == '__main__':
    cli() 