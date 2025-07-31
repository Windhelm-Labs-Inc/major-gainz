"""Database connection and session management."""

import os
import logging
from contextlib import contextmanager
from sqlalchemy import create_engine, exc
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from .models import Base

logger = logging.getLogger(__name__)

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'token_holdings.db')

def get_engine():
    """Get SQLAlchemy engine with improved error handling."""
    try:
        engine = create_engine(
            f'sqlite:///{DB_PATH}',
            poolclass=StaticPool,
            connect_args={
                'check_same_thread': False,
                'timeout': 30
            },
            echo=False  # Set to True for SQL debugging
        )
        return engine
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        raise

def get_session() -> Session:
    """Get database session."""
    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

@contextmanager
def get_db_session():
    """Context manager for database sessions with automatic cleanup and error handling."""
    session = None
    try:
        session = get_session()
        yield session
        session.commit()
    except exc.OperationalError as e:
        if session:
            session.rollback()
        if "database is locked" in str(e).lower():
            logger.error("Database is locked - another operation may be in progress")
            raise RuntimeError("Database is currently locked. Please try again in a moment.") from e
        elif "timeout" in str(e).lower():
            logger.error("Database operation timed out")
            raise RuntimeError("Database operation timed out after 30 seconds") from e
        else:
            logger.error(f"Database operational error: {e}")
            raise RuntimeError(f"Database error: {e}") from e
    except Exception as e:
        if session:
            session.rollback()
        logger.error(f"Unexpected database error: {e}")
        raise
    finally:
        if session:
            try:
                session.close()
            except Exception as e:
                logger.warning(f"Error closing database session: {e}")

def init_database():
    """Initialize database and create all tables with error handling."""
    try:
        engine = get_engine()
        Base.metadata.create_all(bind=engine)
        logger.info(f"Database initialized at: {DB_PATH}")
        print(f"Database initialized at: {DB_PATH}")
    except exc.OperationalError as e:
        if "database is locked" in str(e).lower():
            logger.error("Cannot initialize database - it is currently locked")
            raise RuntimeError("Database is locked. Please ensure no other operations are running.") from e
        else:
            logger.error(f"Failed to initialize database: {e}")
            raise RuntimeError(f"Database initialization failed: {e}") from e
    except Exception as e:
        logger.error(f"Unexpected error during database initialization: {e}")
        raise 