from fastapi import APIRouter, HTTPException
from ..settings import HEDERA_TOKEN_IDS, HEDERA_TOKEN_ADDRESS_TO_SYMBOL

router = APIRouter(prefix="/tokens", tags=["tokens"])


@router.get("")
async def list_tokens():
    return list(HEDERA_TOKEN_IDS.keys())


# Lookup symbol by Hedera Token ID (e.g., 0.0.456858)
@router.get("/lookup/{token_id}")
async def lookup_symbol(token_id: str):
    symbol = HEDERA_TOKEN_ADDRESS_TO_SYMBOL.get(token_id)
    if not symbol:
        raise HTTPException(status_code=404, detail="Token ID not found")
    return {"token_id": token_id, "symbol": symbol} 