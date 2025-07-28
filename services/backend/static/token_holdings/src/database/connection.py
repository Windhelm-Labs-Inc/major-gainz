"""Database connection and session management."""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from .models import Base

# Database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'token_holdings.db')

def get_engine():
    """Get SQLAlchemy engine."""
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

def get_session() -> Session:
    """Get database session."""
    engine = get_engine()
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()

def init_database():
    """Initialize database and create all tables."""
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized at: {DB_PATH}") 