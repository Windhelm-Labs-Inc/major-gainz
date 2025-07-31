import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal, get_db

# Use the production SQLite database (`ohlcv.db`) for all backend tests.


def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="module")
def client():
    """TestClient wired to the live database."""
    with TestClient(app) as c:
        yield c 