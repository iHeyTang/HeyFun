import logging
from typing import Generator

from sqlalchemy.exc import DisconnectionError, InterfaceError
from sqlalchemy.pool import QueuePool
from sqlmodel import Session, create_engine

from app.config import config


logger = logging.getLogger(__name__)

# Database engine configuration
engine = create_engine(
    config.database_url,
    echo=config.debug,  # show sql queries
    poolclass=QueuePool,  # use queue pool instead of static pool
    pool_pre_ping=True,  # check connection before use
    pool_recycle=3600,  # connection recycle time (seconds)
    pool_size=10,  # number of connections to maintain
    max_overflow=20,  # maximum number of connections that can be created beyond pool_size
    pool_timeout=30,  # timeout for getting connection from pool
    connect_args={
        "connect_timeout": 10,
        "application_name": "HeyFun",
    },
)


def get_session() -> Generator[Session, None, None]:
    """获取数据库会话，带错误处理"""
    session = Session(engine)
    try:
        yield session
    except (InterfaceError, DisconnectionError) as e:
        logger.warning(f"Database connection error: {e}")
        session.rollback()
        raise
    except Exception as e:
        logger.error(f"Database session error: {e}")
        session.rollback()
        raise
    finally:
        try:
            session.close()
        except Exception as e:
            logger.warning(f"Error closing database session: {e}")
