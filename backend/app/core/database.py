from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

def create_database_engine():
    """Create database engine with appropriate configuration for Cloud SQL or local development."""
    try:
        # Configure engine with appropriate settings for Cloud SQL or local development
        if settings.USE_IAM_AUTH and settings.POSTGRES_CONNECTION_NAME:
            # For Cloud SQL with IAM authentication, use Cloud SQL Python Connector
            logger.info("Configuring Cloud SQL IAM authentication")
            logger.info(f"Connection name: {settings.POSTGRES_CONNECTION_NAME}")
            logger.info(f"Database user: {settings.POSTGRES_USER}")
            logger.info(f"Database name: {settings.POSTGRES_DB}")
            
            try:
                from google.cloud.sql.connector import Connector
                import pg8000
            except ImportError as e:
                logger.error(f"Cloud SQL dependencies missing: {e}")
                raise RuntimeError(f"Missing Cloud SQL dependencies: {e}")
            
            # Initialize Cloud SQL Python Connector
            connector = Connector()
            
            def getconn():
                conn = connector.connect(
                    settings.POSTGRES_CONNECTION_NAME,
                    "pg8000",
                    user=settings.POSTGRES_USER,
                    db=settings.POSTGRES_DB,
                    enable_iam_auth=True,
                    ip_type="PRIVATE",  # Use private IP for VPC-only Cloud SQL instances
                )
                return conn
            
            # Create engine with connector
            engine = create_engine(
                "postgresql+pg8000://",
                creator=getconn,
                pool_pre_ping=True,
                pool_recycle=300,
            )
            logger.info("Cloud SQL IAM engine created successfully")
        else:
            # Standard connection for local development
            logger.info("Using standard PostgreSQL connection")
            engine = create_engine(
                settings.DATABASE_URL,
                pool_pre_ping=True,
                pool_recycle=300,
                echo=False
            )
            
        return engine
    except Exception as e:
        logger.error(f"Failed to create database engine: {e}")
        raise

# Global engine variable
engine = None
SessionLocal = None

def get_engine():
    """Get database engine, creating it if necessary."""
    global engine, SessionLocal
    if engine is None:
        engine = create_database_engine()
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine

def get_session_local():
    """Get SessionLocal, creating engine if necessary."""
    if SessionLocal is None:
        get_engine()  # This will create both engine and SessionLocal
    return SessionLocal

Base = declarative_base()


def get_db():
    SessionLocalClass = get_session_local()
    db = SessionLocalClass()
    try:
        yield db
    finally:
        db.close()
