"""
Migration to add quick_add_parameters table
"""
from sqlalchemy import text
from app.core.database import engine


def upgrade():
    """Add quick_add_parameters table"""
    with engine.connect() as connection:
        # Check if table already exists
        result = connection.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'quick_add_parameters'
            );
        """))
        
        table_exists = result.scalar()
        
        if not table_exists:
            print("Creating quick_add_parameters table...")
            connection.execute(text("""
                CREATE TABLE quick_add_parameters (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL,
                    key VARCHAR NOT NULL,
                    value VARCHAR NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT true,
                    sort_order INTEGER DEFAULT 0,
                    created_by_id INTEGER NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                    updated_at TIMESTAMP WITH TIME ZONE,
                    FOREIGN KEY (created_by_id) REFERENCES users(id)
                );
            """))
            
            # Create index for performance
            connection.execute(text("""
                CREATE INDEX idx_quick_add_parameters_active ON quick_add_parameters(is_active);
                CREATE INDEX idx_quick_add_parameters_sort_order ON quick_add_parameters(sort_order);
            """))
            
            # Note: No default/seed parameters inserted - users create their own via Session Parameters Management UI
            # Previous versions had hardcoded userType and retirementPlaybookRole parameters, but these were
            # application-specific and not generic enough. Users now have full control via the UI.
            
            connection.commit()
            print("✅ quick_add_parameters table created (no seed data - users manage via UI)")
        else:
            print("quick_add_parameters table already exists, skipping...")


if __name__ == "__main__":
    upgrade()