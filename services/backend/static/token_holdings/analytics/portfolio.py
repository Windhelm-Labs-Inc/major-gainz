import click
import pandas as pd
from pathlib import Path
import sys
from sqlalchemy import create_engine, text
from decimal import Decimal

# Add src to the Python path to allow for absolute imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import DB_PATH, load_decimals_config, load_tokens_config
from src.services import SaucerSwapPricingService
from src.config import get_saucerswap_api_key

TEMP_DATA_DIR = Path(__file__).parent.parent / "temp_data"
DB_URI = f"sqlite:///{DB_PATH}"


def get_latest_file_for_each_token() -> dict:
    """Finds the most recent raw CSV file for each token symbol."""
    latest_files = {}
    for f in TEMP_DATA_DIR.glob("*_raw_api_data_*.csv"):
        try:
            token_symbol = f.name.split('_')[0].upper()
            if token_symbol not in latest_files or f.stat().st_mtime > latest_files[token_symbol].stat().st_mtime:
                latest_files[token_symbol] = f
        except IndexError:
            continue
    return latest_files


def get_token_prices(engine) -> dict:
    """Fetches the latest USD price for each token from the database."""
    prices = {}
    with engine.connect() as connection:
        result = connection.execute(text("SELECT token_symbol, price_usd FROM token_metadata WHERE price_usd IS NOT NULL"))
        for row in result:
            prices[row.token_symbol] = Decimal(str(row.price_usd))
    return prices


@click.command()
@click.argument('address', required=False)
def find_address(address):
    """
    Finds an address across all raw CSV files in temp_data
    and reports its holdings and estimated USD value.
    """
    if not address:
        address = click.prompt("Please enter a Hedera address (e.g., 0.0.12345)", type=str)

    if not address or not address.startswith("0.0."):
        click.echo("❌ Error: Please provide a valid Hedera address (e.g., 0.0.12345).")
        return

    click.echo(f"🔍 Searching for address: {address} in {TEMP_DATA_DIR}...")

    latest_files = get_latest_file_for_each_token()
    if not latest_files:
        click.echo("❌ No raw data files found in temp_data. Run a refresh with --export-csv first.")
        return

    # Use the live pricing service instead of stale DB data
    api_key = get_saucerswap_api_key()
    if not api_key:
        click.echo("❌ SaucerSwap API key not found. Cannot fetch live prices.")
        return
        
    pricing_service = SaucerSwapPricingService(api_key)
    decimals_config = load_decimals_config()
    tokens_config = load_tokens_config()

    portfolio = []
    total_portfolio_value = Decimal("0")

    for token, filepath in latest_files.items():
        try:
            df = pd.read_csv(filepath, low_memory=False)
            
            # The account ID might be in 'account' or 'account_id' column
            account_col = 'account' if 'account' in df.columns else 'account_id'
            
            result = df[df[account_col] == address]

            if not result.empty:
                balance_raw = result.iloc[0]['balance']
                
                # Handle HBAR's nested balance structure
                if token == 'HBAR' and isinstance(balance_raw, str) and 'balance' in balance_raw:
                    try:
                        import json
                        balance_dict = json.loads(balance_raw.replace("'", "\""))
                        balance_raw = balance_dict.get('balance', 0)
                    except json.JSONDecodeError:
                        pass # Stick with raw value if parsing fails

                decimals = decimals_config.get(token, 0)
                balance = Decimal(str(balance_raw)) / (Decimal(10) ** decimals)
                
                token_id = tokens_config.get(token)
                price = pricing_service.get_token_price_usd(token_id) if token_id else None
                usd_value = (balance * price) if price else Decimal("0")
                total_portfolio_value += usd_value

                portfolio.append({
                    "token": token,
                    "balance": f"{balance:,.8f}",
                    "price_usd": f"${price:,.6f}" if price else "N/A",
                    "usd_value": f"${usd_value:,.2f}" if price else "N/A"
                })
        except Exception as e:
            click.echo(f"⚠️ Could not process file {filepath.name}: {e}")

    if not portfolio:
        click.echo(f"\n✅ Address {address} not found in any of the latest data files.")
        return

    click.echo("\n" + "="*60)
    click.echo(f"💰 PORTFOLIO SUMMARY FOR ADDRESS: {address}")
    click.echo("="*60)
    
    from tabulate import tabulate
    headers = ["Token", "Balance", "Price (USD)", "Value (USD)"]
    table_data = [[p['token'], p['balance'], p['price_usd'], p['usd_value']] for p in portfolio]
    
    click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))
    
    click.echo("\n" + "-"*60)
    click.echo(f"  TOTAL ESTIMATED PORTFOLIO VALUE: ${total_portfolio_value:,.2f}")
    click.echo("-" * 60)


if __name__ == '__main__':
    find_address()