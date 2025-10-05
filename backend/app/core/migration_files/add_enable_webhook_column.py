"""Add enable_webhook column to test_runs table

This migration adds the enable_webhook column to the test_runs table
to support webhook enable/disable functionality.
"""

from sqlalchemy import text


def add_enable_webhook_column(connection):
    """Add enable_webhook column to test_runs table with default True"""
    try:
        # Check if column already exists
        result = connection.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'test_runs' 
            AND column_name = 'enable_webhook'
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            connection.execute(text("""
                ALTER TABLE test_runs 
                ADD COLUMN enable_webhook BOOLEAN DEFAULT TRUE
            """))
            print("✅ Added enable_webhook column to test_runs table")
        else:
            print("ℹ️ enable_webhook column already exists in test_runs table")
            
    except Exception as e:
        print(f"❌ Error adding enable_webhook column: {e}")
        raise


if __name__ == "__main__":
    from app.core.database import engine
    
    print("🔄 Running migration: add_enable_webhook_column")
    
    with engine.connect() as connection:
        with connection.begin():
            add_enable_webhook_column(connection)
    
    print("✅ Migration completed successfully")