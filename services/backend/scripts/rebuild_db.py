"""Utility script to wipe and rebuild the local SQLite OHLCV database.

Usage:
    poetry run python -m scripts.rebuild_db

It deletes `ohlcv.db` if present, recreates the schema, then calls
`refresh_all_tokens` to repopulate data for all configured Hedera tokens.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from app import database as db, crud


def remove_existing_db():
    url = db.DATABASE_URL
    if url.startswith("sqlite"):
        # Extract path after last ':'
        path = url.split(":", 2)[-1]
        # Handle relative prefix (e.g. ///./ohlcv.db or ///absolute)
        path = path.lstrip("/")
        p = Path(path)
        if p.exists():
            print(f"[rebuild_db] Removing existing DB file {p}")
            p.unlink()


def recreate_schema():
    print("[rebuild_db] Creating tables…")
    db.Base.metadata.create_all(bind=db.engine)


async def populate_data():
    print("[rebuild_db] Fetching latest token data… (this may take a while)")
    await crud.refresh_all_tokens()


def main() -> None:
    remove_existing_db()
    recreate_schema()
    asyncio.run(populate_data())
    print("[rebuild_db] Done.")


if __name__ == "__main__":
    main() 