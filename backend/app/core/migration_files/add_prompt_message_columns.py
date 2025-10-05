"""Add pre_prompt_messages and post_prompt_messages columns to test_runs table

This migration adds the pre_prompt_messages and post_prompt_messages columns 
to the test_runs table to support sending initialization and closing messages
before and after each question in a test run.
"""

from sqlalchemy import text


def add_prompt_message_columns(connection):
    """Add pre_prompt_messages and post_prompt_messages columns to test_runs table"""
    try:
        # Check if pre_prompt_messages column already exists
        result = connection.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'test_runs' 
            AND column_name = 'pre_prompt_messages'
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            connection.execute(text("""
                ALTER TABLE test_runs 
                ADD COLUMN pre_prompt_messages JSON
            """))
            print("✅ Added pre_prompt_messages column to test_runs table")
        else:
            print("ℹ️ pre_prompt_messages column already exists in test_runs table")
        
        # Check if post_prompt_messages column already exists
        result = connection.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'test_runs' 
            AND column_name = 'post_prompt_messages'
        """))
        
        if result.fetchone() is None:
            # Column doesn't exist, add it
            connection.execute(text("""
                ALTER TABLE test_runs 
                ADD COLUMN post_prompt_messages JSON
            """))
            print("✅ Added post_prompt_messages column to test_runs table")
        else:
            print("ℹ️ post_prompt_messages column already exists in test_runs table")
            
    except Exception as e:
        print(f"❌ Error adding prompt message columns: {e}")
        raise


if __name__ == "__main__":
    from app.core.database import engine
    
    print("🔄 Running migration: add_prompt_message_columns")
    
    with engine.connect() as connection:
        with connection.begin():
            add_prompt_message_columns(connection)
    
    print("✅ Migration completed successfully")