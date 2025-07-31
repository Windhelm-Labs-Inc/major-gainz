import sqlite3
import pandas as pd
from typing import Dict, Any, List

def get_token_holdings_data(token: str, address: str, token_balance: str) -> Dict[str, Any]:
    """
    Retrieves token holdings data, including percentile rank for a given address,
    percentile balances, and top 10 holders.
    """
    db_path = 'static/token_holdings/token_holdings.db'
    
    # Check if database file exists
    import os
    if not os.path.exists(db_path):
        return {"error": "Token holdings database not found."}
    
    try:
        conn = sqlite3.connect(db_path)
        
        # Get metadata first
        meta_query = "SELECT token_id, last_refresh_completed FROM token_metadata WHERE token_symbol = ?"
        cursor = conn.cursor()
        cursor.execute(meta_query, (token,))
        meta_data = cursor.fetchone()
        
        if not meta_data:
            return {"error": "Token not found."}
            
        token_id, last_updated = meta_data

        # Query to get all holdings for the specified token
        query = "SELECT account_id, balance FROM token_holdings WHERE token_symbol = ?"
        df = pd.read_sql_query(query, conn, params=(token,))
        
        if df.empty:
            return {
                "token_name": token,
                "token_id": token_id,
                "last_updated_at": last_updated,
                "error": "No holdings data available for this token."
            }
            
        # Convert balance to numeric, coercing errors
        df['balance'] = pd.to_numeric(df['balance'], errors='coerce')
        df.dropna(subset=['balance'], inplace=True)
        
        if df.empty:
            return {
                "token_name": token,
                "token_id": token_id,
                "last_updated_at": last_updated,
                "error": "No valid balance data found for this token."
            }
        
        # Calculate percentile for the given address
        user_balance = float(token_balance)
        percentile_rank = (df['balance'] < user_balance).mean() * 100
        
        # Calculate balances at each percentile (1-99)
        percentiles = range(1, 100)
        percentile_balances = df['balance'].quantile([p / 100 for p in percentiles]).to_dict()
        
        # Get top 10 holders
        top_10_holders = df.nlargest(10, 'balance').to_dict('records')
        
        return {
            "token_name": token,
            "token_id": token_id,
            "last_updated_at": last_updated,
            "address": address,
            "token_balance": user_balance,
            "percentile_rank": percentile_rank,
            "percentile_balances": {f"p{int(k*100)}": v for k, v in percentile_balances.items()},
            "top_10_holders": top_10_holders,
        }
        
    except sqlite3.Error as e:
        return {"error": f"Database error: {e}"}
    except Exception as e:
        return {"error": f"An unexpected error occurred: {e}"}
    finally:
        if 'conn' in locals() and conn:
            conn.close()