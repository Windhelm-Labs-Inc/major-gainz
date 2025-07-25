from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .crud import refresh_all_tokens
# Import routers including new portfolio
from .routers import tokens, ohlcv, maintenance, portfolio

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Hedera Token OHLCV API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # Local development
        "http://127.0.0.1:3000",    
        "http://0.0.0.0:3000",      
        "http://host.docker.internal:3000",  # Docker Bindings
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tokens.router)
app.include_router(ohlcv.router)
app.include_router(maintenance.router)
app.include_router(portfolio.router)


@app.on_event("startup")
async def startup_event():
    # Populate DB at startup
    await refresh_all_tokens()


# To run: `uvicorn app.main:app --reload` 