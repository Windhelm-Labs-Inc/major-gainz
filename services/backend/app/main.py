import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables early
from dotenv import load_dotenv
load_dotenv()

# DEBUG: Print environment variables at startup
print("🔍 DEBUG - Environment Variables Loaded:")
print(f"OPENAI_API_KEY: {repr(os.getenv('OPENAI_API_KEY'))}")
print(f"SAUCER_SWAP_API_KEY: {repr(os.getenv('SAUCER_SWAP_API_KEY'))}")
print(f"HEDERA_NETWORK: {repr(os.getenv('HEDERA_NETWORK'))}")
print(f"DATABASE_URL: {repr(os.getenv('DATABASE_URL'))}")
print("=" * 50)

from .database import Base, engine
from .crud_saucerswap import refresh_all_tokens
# Import routers including new portfolio, defi, and chat
from .routers import tokens, ohlcv, maintenance, portfolio, token_holdings, defi, chat

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hedera Token OHLCV API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",     # Local development
        "http://127.0.0.1:8080",    # Container internal communication
        "http://0.0.0.0:8080",      
        "http://host.docker.internal:8080",  # Docker Bindings
        "*",  # Allow all origins for Azure deployment
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tokens.router)
app.include_router(ohlcv.router)
app.include_router(maintenance.router)
app.include_router(portfolio.router)
app.include_router(token_holdings.router)
app.include_router(defi.router)
app.include_router(chat.router)


@app.on_event("startup")
async def startup_event():
    # Populate DB at startup
    await refresh_all_tokens()


# To run: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
# Docker: `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --loop asyncio` 