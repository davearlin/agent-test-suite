"""
Simple database connection test to verify proxy connectivity
"""
import psycopg2
import os

def test_connection():
    """Test database connection through proxy"""
    try:
        print(f"Attempting to connect to database...")
        print(f"Host: 127.0.0.1")
        print(f"Port: 5432")
        print(f"Database: dialogflow_tester_dev")
        print(f"User: postgres")
        
        conn = psycopg2.connect(
            host="127.0.0.1",
            port=5432,
            database="dialogflow_tester_dev",
            user="postgres",
            password="SDATWNERgJLFM4mLwEZA"
        )
        
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        result = cursor.fetchone()
        print(f"✅ Connection successful!")
        print(f"PostgreSQL version: {result[0]}")
        
        # Test database name
        cursor.execute("SELECT current_database();")
        db_name = cursor.fetchone()[0]
        print(f"Connected to database: {db_name}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    test_connection()