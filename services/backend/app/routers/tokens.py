from fastapi import APIRouter, HTTPException
from ..settings import SYMBOL_TO_TOKEN_ID, TOKEN_ID_TO_SYMBOL

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.get("")
async def list_tokens():
    return list(SYMBOL_TO_TOKEN_ID.keys())


# Lookup symbol by Hedera Token ID (e.g., 0.0.456858)
@router.get("/lookup/{token_id}")
async def lookup_symbol(token_id: str):
    symbol = TOKEN_ID_TO_SYMBOL.get(token_id)
    if not symbol:
        raise HTTPException(status_code=404, detail="Token ID not found")
    return {"token_id": token_id, "symbol": symbol} 