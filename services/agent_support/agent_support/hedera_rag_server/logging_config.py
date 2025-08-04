"""Centralised logging configuration for the Hedera RAG service.

The configuration sets up two handlers:

1. **Console handler** – logs at *INFO* level and above.
2. **Rotating file handler** – logs **all** records at *DEBUG* level or higher, writing
   to ``logs/server.log`` with up to five 1-MiB rotated files.

Importing this module is sufficient to configure the root logger.  If you need
an explicit logger in your own module simply call ``logging.getLogger(__name__)``.
"""
from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------

LOG_DIR = Path(os.getenv("LOG_DIR", "logs")).resolve()
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "server.log"

# Rotate after ~1 MiB per file, keep 5 backups
_MAX_BYTES = 1 * 1024 * 1024  # 1 MiB
_BACKUP_COUNT = 5

# ---------------------------------------------------------------------------
# Formatter – unified log format
# ---------------------------------------------------------------------------

_FMT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
_DATEFMT = "%Y-%m-%d %H:%M:%S"
formatter = logging.Formatter(fmt=_FMT, datefmt=_DATEFMT)

# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

# Console – human-friendly INFO+ messages
_console = logging.StreamHandler()
_console.setLevel(logging.INFO)
_console.setFormatter(formatter)

# File – verbose DEBUG+      
_file = RotatingFileHandler(
    filename=str(LOG_FILE),
    maxBytes=_MAX_BYTES,
    backupCount=_BACKUP_COUNT,
    encoding="utf-8",
)
_file.setLevel(logging.DEBUG)
_file.setFormatter(formatter)

# ---------------------------------------------------------------------------
# Root logger configuration (idempotent)
# ---------------------------------------------------------------------------

_root = logging.getLogger()
if not _root.handlers:  # Prevent duplicate configuration on re-import
    _root.setLevel(logging.DEBUG)
    _root.addHandler(_console)
    _root.addHandler(_file)
