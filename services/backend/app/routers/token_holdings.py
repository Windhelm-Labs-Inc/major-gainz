from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
import sqlite3

from ..services.token_holdings import get_token_holdings_data

router = APIRouter(prefix="/token_holdings", tags=["token_holdings"])

class TokenHoldingsRequest(BaseModel):
    address: str
    token_balance: str

@router.post("/{token}")
async def get_holdings_data(token: str, request: TokenHoldingsRequest):
    """
    Retrieves token holdings data, including the percentile rank of a given balance,
    a mapping of percentiles to balances, and the top 10 holders.
    """
    try:
        data = get_token_holdings_data(
            token=token,
            address=request.address,
            token_balance=request.token_balance
        )
        if "error" in data:
            raise HTTPException(status_code=404, detail=data["error"])
        return data
    except HTTPException:
        # Re-raise HTTPExceptions to let them pass through
        raise
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    except Exception as e:
        # Catch any other exceptions and return a generic 500 error
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")