"""Utilities for streaming API data to CSV files."""

import hashlib
import csv
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


def hash_file(filepath: Path) -> str:
    """Calculate SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    try:
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()
    except (IOError, OSError) as e:
        logger.error(f"Error hashing file {filepath}: {e}")
        raise


# -----------------------------------------------------------
# ApiCsvStreamer
# -----------------------------------------------------------
# * Streams raw API data dictionaries directly to CSV.
# * Learns the header row from the first chunk if none supplied.
# * Uses extrasaction='ignore' so unexpected keys never crash.
# -----------------------------------------------------------

class ApiCsvStreamer:
    """Handles streaming of raw API data chunks to a CSV file."""

    def __init__(self, filepath: Path, fieldnames: Optional[List[str]] = None):
        """
        Initializes the streamer with a file path and defined CSV headers.
        
        Args:
            filepath: The path to the CSV file to write to.
            fieldnames: A list of strings for the CSV header row.
        """
        self.filepath = filepath
        # Fieldnames may be supplied or learned lazily.
        self.fieldnames = fieldnames  # Optional upfront header definition

        # Internals
        self._buffer: List[Dict[str, Any]] = []
        self._file_exists = filepath.exists()
        self._writer: Optional[csv.DictWriter] = None
        self._file: Optional[open] = None

    # -----------------------------------------
    # Internal helpers
    # -----------------------------------------
    def _initialise_writer(self, sample_row: Dict[str, Any]):
        """Initialise the CSV writer lazily using the keys from `sample_row` if needed."""
        if self._writer is not None:
            return  # Already initialised

        # Determine fieldnames if they were not provided
        if self.fieldnames is None:
            self.fieldnames = list(sample_row.keys())

        try:
            # Open the file in append mode, create if missing
            self._file = open(self.filepath, 'a', newline='', encoding='utf-8')

            # Use extrasaction='ignore' so unexpected keys never raise
            self._writer = csv.DictWriter(
                self._file,
                fieldnames=self.fieldnames,
                extrasaction='ignore'
            )

            # Write header if file newly created
            if not self._file_exists:
                self._writer.writeheader()
        except (IOError, OSError) as e:
            logger.critical(f"FATAL: Could not open CSV file for streaming at {self.filepath}: {e}")
            raise

    def add_chunk(self, data: List[Dict[str, Any]]):
        """Adds a chunk of raw API data to the internal buffer."""
        if data:
            self._buffer.extend(data)

    def flush(self) -> int:
        """
        Writes the buffered data to the CSV file and clears the buffer.
        
        Returns:
            The number of records written.
        """
        if not self._buffer:
            return 0

        # Ensure writer is ready based on first row
        self._initialise_writer(self._buffer[0])

        num_records = len(self._buffer)

        try:
            assert self._writer is not None  # mypy / type-safety
            self._writer.writerows(self._buffer)
        except (IOError, OSError, csv.Error) as e:
            logger.error(f"Error streaming data to CSV {self.filepath}: {e}")
            return 0
        finally:
            self._buffer.clear()
            
        return num_records

    def close(self):
        """Flushes any remaining data and closes the file."""
        self.flush()
        if self._file:
            self._file.close()