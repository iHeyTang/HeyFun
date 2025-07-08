from typing import Generator

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.config import config


# Database engine configuration
engine = create_engine(
    config.database_url,
    echo=config.debug,  # show sql queries
    poolclass=StaticPool,  # use static connection pool
    pool_pre_ping=True,  # check connection before use
    pool_recycle=3600,  # connection recycle time (seconds)
)


def get_session() -> Generator[Session, None, None]:
    """Get database session"""
    with Session(engine) as session:
        yield session


def get_session_sync() -> Session:
    """Get synchronous database session"""
    return Session(engine)
