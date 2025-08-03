from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Numeric, UniqueConstraint, func
from .database import Base


class OHLCV(Base):
    __tablename__ = "ohlcv"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, index=True)
    date = Column(Date, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)

    __table_args__ = (UniqueConstraint("token", "date", name="uix_token_date"),)

# -----------------------------------------------------------------------------
# New SaucerSwap OHLCV model (ISO timestamps, USD-normalised values)
# -----------------------------------------------------------------------------

class OHLCVSaucerSwap(Base):
    __tablename__ = "ohlcv_saucerswap"

    id = Column(Integer, primary_key=True, index=True)
    token_id = Column(String, index=True)  # Hedera token ID (e.g., 0.0.456858)
    token_symbol = Column(String, index=True)
    timestamp_iso = Column(DateTime(timezone=True), index=True)

    # Raw token amounts (string to preserve precision)
    open_raw = Column(String)
    high_raw = Column(String)
    low_raw = Column(String)
    close_raw = Column(String)
    volume_raw = Column(String)
    liquidity_raw = Column(String)

    # USD-normalised Decimal values
    open_usd = Column(Numeric(precision=18, scale=8))
    high_usd = Column(Numeric(precision=18, scale=8))
    low_usd = Column(Numeric(precision=18, scale=8))
    close_usd = Column(Numeric(precision=18, scale=8))
    volume_usd = Column(Numeric(precision=18, scale=8))
    liquidity_usd = Column(Numeric(precision=18, scale=8))

    decimals = Column(Integer)
    data_source = Column(String, default="saucerswap")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("token_id", "timestamp_iso", name="uix_token_ts"),
    ) 