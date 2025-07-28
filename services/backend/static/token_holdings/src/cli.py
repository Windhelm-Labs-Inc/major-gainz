"""Command-line interface for token holdings tracking system."""

import sys
import click
from datetime import datetime
from tabulate import tabulate

from .config import load_tokens_config, ensure_temp_dir
from .database import init_database
from .fetchers import HederaTokenFetcher
from .utils import export_to_csv, export_all_tokens_summary, get_token_summary, get_top_holders, get_percentiles, cleanup_old_data, get_tokens_needing_refresh


def handle_interactive_refresh(tokens_config, max_accounts, export_csv):
    """Handle interactive mode for token refresh."""
    click.echo("🔍 Checking token data age...")
    
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
    click.echo(f"📊 Max accounts per token: {max_accounts:,}")
    click.echo(f"📄 Export CSV after refresh: {'Yes' if export_csv else 'No'}")
    
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
    pass


@cli.command()
def init():
    """Initialize the database and create tables."""
    click.echo("🔧 Initializing database...")
    init_database()
    ensure_temp_dir()
    click.echo("✅ Database initialized successfully!")


@cli.command()
@click.option('--token', '-t', help='Specific token symbol to refresh (e.g., HBAR, SAUCE)')
@click.option('--max-accounts', '-m', default=1000000, help='Maximum accounts to fetch per token')
@click.option('--export-csv', '-e', is_flag=True, help='Export to CSV after refresh')
@click.option('--interactive', '-i', is_flag=True, help='Interactive mode - prompt for tokens older than 24 hours')
def refresh(token, max_accounts, export_csv, interactive):
    """Refresh token holder data from Hedera API."""
    tokens_config = load_tokens_config()
    
    if not tokens_config:
        click.echo("❌ No tokens configuration found!")
        sys.exit(1)
    
    # Handle interactive mode
    if interactive:
        tokens_to_refresh = handle_interactive_refresh(tokens_config, max_accounts, export_csv)
        if not tokens_to_refresh:
            click.echo("🤷 No tokens selected for refresh.")
            return
    else:
        # Handle non-interactive mode (existing logic)
        if token:
            if token not in tokens_config:
                click.echo(f"❌ Token '{token}' not found in configuration!")
                click.echo(f"Available tokens: {', '.join(tokens_config.keys())}")
                sys.exit(1)
            tokens_to_refresh = {token: tokens_config[token]}
        else:
            tokens_to_refresh = tokens_config
    
    click.echo(f"🚀 Starting refresh for {len(tokens_to_refresh)} token(s)...")
    click.echo(f"📊 Max accounts per token: {max_accounts:,}")
    
    fetcher = HederaTokenFetcher()
    successful_refreshes = []
    failed_refreshes = []
    
    start_time = datetime.utcnow()
    
    for token_symbol, token_id in tokens_to_refresh.items():
        success = fetcher.refresh_token_data(token_symbol, token_id, max_accounts)
        
        if success:
            successful_refreshes.append(token_symbol)
            
            if export_csv:
                click.echo(f"\n📄 Exporting {token_symbol} to CSV...")
                csv_path = export_to_csv(token_symbol)
                if csv_path:
                    click.echo(f"✅ CSV exported: {csv_path}")
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
@click.option('--token', '-t', help='Specific token symbol to export')
@click.option('--include-percentiles/--top-only', default=True, help='Include percentile data or top holders only')
@click.option('--summary', '-s', is_flag=True, help='Export summary of all tokens')
def export(token, include_percentiles, summary):
    """Export token data to CSV files."""
    ensure_temp_dir()
    
    if summary:
        click.echo("📊 Exporting summary of all tokens...")
        csv_path = export_all_tokens_summary()
        if csv_path:
            click.echo(f"✅ Summary exported: {csv_path}")
        return
    
    if token:
        csv_path = export_to_csv(token, include_percentiles)
        if csv_path:
            click.echo(f"✅ {token} data exported: {csv_path}")
    else:
        # Export all tokens
        tokens_config = load_tokens_config()
        for token_symbol in tokens_config.keys():
            csv_path = export_to_csv(token_symbol, include_percentiles)
            if csv_path:
                click.echo(f"✅ {token_symbol} data exported: {csv_path}")


@cli.command()
@click.option('--token', '-t', help='Specific token symbol to show')
def status(token):
    """Show status and summary of all tokens."""
    summary_data = get_token_summary()
    
    if not summary_data:
        click.echo("📭 No token data found. Run 'refresh' command first.")
        return
    
    # Prepare table data
    headers = [
        'Token', 'Token ID', 'Last Refresh', 'Success', 'Total Accounts', 
        'Top Holders', 'Percentiles', 'In Progress', 'Error'
    ]
    
    rows = []
    for token in summary_data:
        last_refresh = "Never"
        if token['last_refresh_completed']:
            last_refresh = token['last_refresh_completed'].strftime('%Y-%m-%d %H:%M')
        
        success_icon = "✅" if token['last_refresh_success'] else "❌"
        progress_icon = "🔄" if token['refresh_in_progress'] else ""
        error_msg = token['error_message'][:30] + "..." if token['error_message'] and len(token['error_message']) > 30 else token['error_message'] or ""
        
        rows.append([
            token['token_symbol'],
            token['token_id'],
            last_refresh,
            success_icon,
            f"{token['total_accounts_fetched']:,}" if token['total_accounts_fetched'] else "0",
            str(token['top_holders_count']),
            str(token['percentiles_count']),
            progress_icon,
            error_msg
        ])
    
    click.echo("📊 Token Holdings Status:")
    click.echo(tabulate(rows, headers=headers, tablefmt='grid'))


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
    """Clean up old refresh data, keeping only recent refreshes."""
    click.echo(f"🗑️  Cleaning up old data (keeping latest {keep} refreshes)...")
    
    deleted_count = cleanup_old_data(token, keep)
    
    if deleted_count > 0:
        click.echo(f"✅ Cleaned up {deleted_count:,} old records")
    else:
        click.echo("✅ No old data to clean up")


if __name__ == '__main__':
    cli() 