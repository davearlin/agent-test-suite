#!/usr/bin/env python3
"""
Automated Migration System
Handles database schema updates automatically on startup
"""

import os
import logging
from sqlalchemy import text, inspect
from app.core.database import get_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize engine
engine = get_engine()

class MigrationManager:
    """Manages database migrations automatically"""
    
    def __init__(self):
        # Import individual migration functions from migration_files folder
        try:
            from app.core.migration_files.add_quick_add_parameters_table import upgrade as create_quick_add_table
        except ImportError:
            create_quick_add_table = None
            
        try:
            from app.core.migration_files.make_evaluation_model_required import main as make_eval_required
        except ImportError:
            make_eval_required = None
            
        try:
            from app.core.migration_files.seed_default_evaluation_parameters import upgrade as seed_eval_params
        except ImportError:
            seed_eval_params = None
        
        self.migrations = [
            {
                'name': 'add_google_oauth_tokens',
                'description': 'Add Google OAuth token columns',
                'columns': [
                    ('users', 'google_access_token', 'VARCHAR'),
                    ('users', 'google_refresh_token', 'VARCHAR'),
                    ('users', 'google_token_expires_at', 'TIMESTAMP WITH TIME ZONE'),
                ]
            },
            {
                'name': 'add_quick_test_preferences',
                'description': 'Add Quick Test preference columns',
                'columns': [
                    ('users', 'quick_test_project_id', 'VARCHAR'),
                    ('users', 'quick_test_agent_id', 'VARCHAR'),
                    ('users', 'quick_test_flow_id', 'VARCHAR'),
                    ('users', 'quick_test_page_id', 'VARCHAR'),
                    ('users', 'quick_test_session_id', 'VARCHAR'),
                    ('users', 'quick_test_session_parameters', 'JSON'),
                ]
            },
            {
                'name': 'add_test_run_preferences',
                'description': 'Add Test Run preference columns',
                'columns': [
                    ('users', 'test_run_project_id', 'VARCHAR'),
                    ('users', 'test_run_agent_id', 'VARCHAR'),
                    ('users', 'test_run_flow_id', 'VARCHAR'),
                    ('users', 'test_run_page_id', 'VARCHAR'),
                    ('users', 'test_run_playbook_id', 'VARCHAR'),
                    ('users', 'test_run_llm_model_id', 'VARCHAR'),
                    ('users', 'test_run_session_parameters', 'JSON'),
                ]
            },
            {
                'name': 'add_display_names',
                'description': 'Add display name columns for UI',
                'columns': [
                    ('test_runs', 'agent_display_name', 'VARCHAR'),
                    ('test_runs', 'flow_display_name', 'VARCHAR'),
                    ('test_runs', 'page_display_name', 'VARCHAR'),
                    ('test_runs', 'playbook_display_name', 'VARCHAR'),
                ]
            },
            {
                'name': 'add_session_parameters',
                'description': 'Add session parameters support',
                'columns': [
                    ('test_runs', 'session_parameters', 'JSON'),
                ]
            },
            {
                'name': 'add_playbook_support',
                'description': 'Add Dialogflow CX Playbook support',
                'columns': [
                    ('test_runs', 'playbook_id', 'VARCHAR'),
                    ('test_runs', 'llm_model_id', 'VARCHAR'),
                ]
            },
            {
                'name': 'add_prompt_message_support',
                'description': 'Add pre/post prompt message support',
                'columns': [
                    ('test_runs', 'pre_prompt_messages', 'JSON'),
                    ('test_runs', 'post_prompt_messages', 'JSON'),
                ]
            },
            {
                'name': 'add_user_prompt_preferences',
                'description': 'Add user preferences for pre/post prompt messages',
                'columns': [
                    ('users', 'quick_test_pre_prompt_messages', 'JSON'),
                    ('users', 'quick_test_post_prompt_messages', 'JSON'),
                    ('users', 'test_run_pre_prompt_messages', 'JSON'),
                    ('users', 'test_run_post_prompt_messages', 'JSON'),
                ]
            },
            {
                'name': 'add_webhook_and_evaluation_preferences',
                'description': 'Add webhook and evaluation parameter preference columns',
                'columns': [
                    ('users', 'test_run_enable_webhook', 'BOOLEAN'),
                    ('users', 'test_run_evaluation_parameters', 'VARCHAR'),
                ]
            },
            {
                'name': 'add_batch_size_preference',
                'description': 'Add batch size preference column for test runs',
                'columns': [
                    ('users', 'test_run_batch_size', 'INTEGER'),
                ]
            },
            {
                'name': 'add_quicktest_playbook_preferences',
                'description': 'Add missing QuickTest playbook and model preference fields',
                'columns': [
                    ('users', 'quick_test_playbook_id', 'VARCHAR'),
                    ('users', 'quick_test_llm_model_id', 'VARCHAR'),
                ]
            },
            {
                'name': 'add_quicktest_webhook_preference',
                'description': 'Add Quick Test webhook preference column',
                'columns': [
                    ('users', 'quick_test_enable_webhook', 'BOOLEAN DEFAULT TRUE'),
                ]
            },
            {
                'name': 'add_evaluation_model_support',
                'description': 'Add LLM model selection for evaluation scoring',
                'columns': [
                    ('test_runs', 'evaluation_model_id', 'VARCHAR'),
                ]
            },
            # Complex migrations from individual files
            {
                'name': 'create_quick_add_parameters_table',
                'description': 'Create quick_add_parameters table with seed data',
                'type': 'function',
                'handler': create_quick_add_table,
                'timeout': None  # No timeout
            },
            {
                'name': 'make_evaluation_model_required',
                'description': 'Set evaluation_model_id to NOT NULL with defaults',
                'type': 'function',
                'handler': make_eval_required,
                'timeout': 60  # 60 second timeout
            },
            {
                'name': 'seed_default_evaluation_parameters',
                'description': 'Seed default evaluation parameters (Similarity Score, Empathy Level, No-Match Detection)',
                'type': 'function',
                'handler': seed_eval_params,
                'timeout': None  # No timeout
            },
            # Data migrations (simple SQL updates)
            {
                'name': 'backfill_test_run_progress_fields',
                'description': 'Set default values for total_questions and completed_questions in existing test runs',
                'type': 'data',
                'sql': [
                    "UPDATE test_runs SET total_questions = 0 WHERE total_questions IS NULL",
                    "UPDATE test_runs SET completed_questions = 0 WHERE completed_questions IS NULL"
                ]
            }
        ]
    
    def column_exists(self, table_name: str, column_name: str) -> bool:
        """Check if a column exists in a table"""
        try:
            inspector = inspect(engine)
            columns = [col['name'] for col in inspector.get_columns(table_name)]
            return column_name in columns
        except Exception as e:
            logger.warning(f"Could not inspect table {table_name}: {e}")
            return False
    
    def table_exists(self, table_name: str) -> bool:
        """Check if a table exists"""
        try:
            inspector = inspect(engine)
            return table_name in inspector.get_table_names()
        except Exception as e:
            logger.warning(f"Could not check table existence: {e}")
            return False
    
    def add_column_if_not_exists(self, table_name: str, column_name: str, column_type: str):
        """Add a column to a table if it doesn't exist"""
        if not self.table_exists(table_name):
            logger.info(f"⚠️  Table {table_name} doesn't exist, skipping column {column_name}")
            return
            
        if self.column_exists(table_name, column_name):
            logger.info(f"✅ Column {table_name}.{column_name} already exists")
            return
        
        try:
            with engine.connect() as connection:
                sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"
                logger.info(f"Adding column: {sql}")
                connection.execute(text(sql))
                connection.commit()
                logger.info(f"✅ Added column {table_name}.{column_name}")
        except Exception as e:
            logger.error(f"❌ Failed to add column {table_name}.{column_name}: {e}")
            raise
    

    def run_migrations(self):
        """Run all pending migrations with connectivity check"""
        logger.info("� Starting database migrations...")
        
        # First verify database connectivity
        try:
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.fetchone()
            logger.info("✅ Database connectivity verified")
        except Exception as e:
            logger.error(f"❌ CRITICAL: Cannot connect to database: {e}")
            raise RuntimeError(f"Database connection failed: {e}")
        
        logger.info("🚀 Running all migrations...")
        
        try:
            for migration in self.migrations:
                migration_type = migration.get('type', 'columns')
                logger.info(f"📝 Running migration: {migration['name']} - {migration['description']}")
                
                try:
                    if migration_type == 'function':
                        # Complex migration from individual file
                        handler = migration.get('handler')
                        timeout = migration.get('timeout')
                        
                        if handler is None:
                            logger.warning(f"⚠️ Migration handler not found, skipping {migration['name']}")
                            continue
                        
                        if timeout:
                            # Run with timeout using threading
                            import threading
                            import time
                            
                            result = {"success": False, "error": None}
                            
                            def run_with_timeout():
                                try:
                                    handler()
                                    result["success"] = True
                                except Exception as e:
                                    result["error"] = e
                            
                            thread = threading.Thread(target=run_with_timeout)
                            thread.daemon = True
                            thread.start()
                            thread.join(timeout=timeout)
                            
                            if thread.is_alive():
                                logger.warning(f"⚠️ Migration {migration['name']} timed out after {timeout}s - skipping")
                                continue
                            elif result["error"]:
                                raise result["error"]
                        else:
                            # Run without timeout
                            handler()
                    
                    elif migration_type == 'data':
                        # Simple SQL data migration
                        inspector = inspect(engine)
                        sql_statements = migration.get('sql', [])
                        if isinstance(sql_statements, str):
                            sql_statements = [sql_statements]
                        
                        # Check if the first table mentioned exists
                        first_table = sql_statements[0].split()[1] if sql_statements else None
                        if first_table and first_table not in inspector.get_table_names():
                            logger.info(f"⚠️ Table {first_table} doesn't exist, skipping data migration")
                            continue
                        
                        with engine.connect() as connection:
                            for sql in sql_statements:
                                result = connection.execute(text(sql))
                                connection.commit()
                                if result.rowcount > 0:
                                    logger.info(f"  ✅ Updated {result.rowcount} rows")
                    
                    else:
                        # Regular column migrations
                        columns = migration.get('columns', [])
                        for table_name, column_name, column_type in columns:
                            self.add_column_if_not_exists(table_name, column_name, column_type)
                    
                    logger.info(f"✅ Completed migration: {migration['name']}")
                    
                except Exception as migration_error:
                    # Check if this is an acceptable error to skip
                    error_str = str(migration_error).lower()
                    if any(phrase in error_str for phrase in [
                        "already exists", "duplicate", "permission denied",
                        "relation \"users\" does not exist",
                        "relation \"test_runs\" does not exist"
                    ]):
                        logger.info(f"⚠️ Migration {migration['name']} skipped: {migration_error}")
                    else:
                        logger.error(f"❌ Migration {migration['name']} failed: {migration_error}")
                        raise
            
            logger.info("🎉 All migrations completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Migration system failed: {e}")
            raise

def run_migrations():
    """Entry point for running migrations"""
    migration_manager = MigrationManager()
    migration_manager.run_migrations()

if __name__ == "__main__":
    run_migrations()