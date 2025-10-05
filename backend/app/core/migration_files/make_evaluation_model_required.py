"""
Migration: Make evaluation_model_id required and set default for existing test runs.

This migration:
1. Updates existing test runs with NULL evaluation_model_id to use a default model
2. Changes the column to be NOT NULL
"""

from sqlalchemy import text
from app.core.database import get_engine


def upgrade():
    """Apply the migration."""
    engine = get_engine()
    
    # Use autocommit to avoid hanging transactions
    with engine.connect() as connection:
        # Use a transaction block for better control
        with connection.begin():
            print("🔄 Starting evaluation_model_id migration...")
            
            # First, check if the column is already NOT NULL to avoid unnecessary work
            try:
                check_result = connection.execute(text("""
                    SELECT column_name, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = 'test_runs' 
                    AND column_name = 'evaluation_model_id'
                """))
                column_info = check_result.fetchone()
                
                if column_info and column_info[1] == 'NO':
                    print("✅ evaluation_model_id column is already NOT NULL - migration already applied")
                    return
                    
            except Exception as e:
                print(f"⚠️  Could not check column constraints, proceeding with migration: {e}")
            
            # Update any existing test runs with NULL evaluation_model_id to use a default
            default_model = "models/gemini-2.0-flash"  # Use a stable, working model as default
            
            # First check if there are any NULL values to update
            null_count_result = connection.execute(text("""
                SELECT COUNT(*) FROM test_runs WHERE evaluation_model_id IS NULL
            """))
            null_count = null_count_result.scalar()
            
            if null_count > 0:
                result = connection.execute(text("""
                    UPDATE test_runs 
                    SET evaluation_model_id = :default_model 
                    WHERE evaluation_model_id IS NULL
                """), {"default_model": default_model})
                
                updated_count = result.rowcount
                print(f"📝 Updated {updated_count} test runs with default evaluation model: {default_model}")
            else:
                print("📝 No test runs with NULL evaluation_model_id found")
            
            # Now make the column NOT NULL (PostgreSQL)
            try:
                connection.execute(text("""
                    ALTER TABLE test_runs 
                    ALTER COLUMN evaluation_model_id SET NOT NULL
                """))
                print("✅ Made evaluation_model_id column NOT NULL")
            except Exception as e:
                # If the column is already NOT NULL, this might fail
                if "is already not null" in str(e).lower() or "not null constraint" in str(e).lower():
                    print(f"✅ evaluation_model_id column was already NOT NULL")
                else:
                    print(f"⚠️  Could not alter column constraint: {e}")
                    raise
        
        print("✅ Migration completed successfully")


def main():
    """Run the migration."""
    try:
        upgrade()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    main()