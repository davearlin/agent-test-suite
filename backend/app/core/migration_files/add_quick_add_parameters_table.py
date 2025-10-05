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
            
            # Insert default parameters (migrating from hardcoded values)
            connection.execute(text("""
                INSERT INTO quick_add_parameters (name, key, value, description, sort_order, created_by_id)
                SELECT 
                    'User Type: Employee',
                    'userType',
                    'employee',
                    'Set user type to employee',
                    1,
                    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');
            """))
            
            connection.execute(text("""
                INSERT INTO quick_add_parameters (name, key, value, description, sort_order, created_by_id)
                SELECT 
                    'User Type: Admin',
                    'userType',
                    'admin',
                    'Set user type to admin',
                    2,
                    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');
            """))
            
            connection.execute(text("""
                INSERT INTO quick_add_parameters (name, key, value, description, sort_order, created_by_id)
                SELECT 
                    'Retirement Playbook Role: Employee',
                    'retirementPlaybookRole',
                    'employee',
                    'Set retirement playbook role to employee',
                    3,
                    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');
            """))
            
            connection.execute(text("""
                INSERT INTO quick_add_parameters (name, key, value, description, sort_order, created_by_id)
                SELECT 
                    'Retirement Playbook Role: Admin',
                    'retirementPlaybookRole',
                    'admin',
                    'Set retirement playbook role to admin',
                    4,
                    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
                WHERE EXISTS (SELECT 1 FROM users WHERE role = 'admin');
            """))
            
            connection.commit()
            print("✅ quick_add_parameters table created with default data")
        else:
            print("quick_add_parameters table already exists, skipping...")


if __name__ == "__main__":
    upgrade()