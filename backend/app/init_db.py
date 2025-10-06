# Database initialization and migration script

import time
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
from app.core.config import settings
from app.core.database import Base

# CRITICAL: Import all models to register them with Base before calling create_all()
# Without these imports, Base.metadata.create_all() will create NO tables
from app import models  # This imports all model classes

def wait_for_db(max_retries=60, retry_delay=3):
    """Wait for database to become available with retry logic (extended for Cloud Run IAM)."""
    from app.core.database import get_engine
    
    for attempt in range(max_retries):
        try:
            engine = get_engine()  # Use the proper engine creation function
            # Try to connect
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database connection successful!")
            return engine
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Database connection attempt {attempt + 1}/{max_retries} failed: {str(e)}")
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                print(f"Failed to connect to database after {max_retries} attempts")
                raise e
    return None

def init_db():
    """Initialize the database with tables and default data."""
    try:
        # Wait for database to be available
        engine = wait_for_db()
        
        # Create all tables
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Base tables created")
        except Exception as table_error:
            if "permission denied" in str(table_error).lower():
                print(f"⚠️  Database tables already exist or permission denied: {str(table_error)}")
                print("⚠️  Continuing with existing database schema...")
            else:
                print(f"⚠️  Table creation warning: {str(table_error)}")
        
        # Create session
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        try:
            # For SSO environments, we don't create default admin users
            # Users will be created automatically through SSO authentication
            print("Database initialized successfully! Users will be created through SSO authentication.")
            return True
            
        except Exception as e:
            print(f"Error initializing database: {str(e)}")
            db.rollback()
            return False
        
        finally:
            db.close()
            
    except Exception as e:
        print(f"Failed to initialize database: {str(e)}")
        return False

if __name__ == "__main__":
    success = init_db()
    if not success:
        print("❌ Database initialization failed - backend cannot start without database connectivity")
        sys.exit(1)  # Exit with failure code to prevent backend startup
    else:
        print("✅ Database initialization completed successfully")
        sys.exit(0)  # Exit successfully to allow backend startup
