from datetime import date
from pydantic import BaseModel


class OHLCVSchema(BaseModel):
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float

    model_config = {
        "from_attributes": True,
    }


class StatsSchema(BaseModel):
    token: str
    start: date
    end: date
    average: float
    high: float
    low: float

    model_config = {
        "from_attributes": True,
    } 