import os
from typing import Optional, List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "dev")
    TESTING: bool = os.getenv("TESTING", "false").lower() == "true"
    
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Dialogflow Agent Tester"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    
    # Database
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "password")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "agent_evaluator")
    POSTGRES_CONNECTION_NAME: str = os.getenv("POSTGRES_CONNECTION_NAME", "")
    USE_IAM_AUTH: bool = os.getenv("USE_IAM_AUTH", "false").lower() == "true"
    
    @property
    def DATABASE_URL(self) -> str:
        """Get database URL, using Cloud SQL Connector for IAM auth or standard connection for local/testing."""
        db_name = f"{self.POSTGRES_DB}_test" if self.TESTING else self.POSTGRES_DB
        
        if self.USE_IAM_AUTH and self.POSTGRES_CONNECTION_NAME:
            # Use Cloud SQL Python Connector with IAM authentication
            # Format: postgresql+pg8000://user@/database?unix_sock=/cloudsql/connection_name/.s.PGSQL.5432
            return f"postgresql+pg8000://{self.POSTGRES_USER}@/{db_name}?unix_sock=/cloudsql/{self.POSTGRES_CONNECTION_NAME}/.s.PGSQL.5432"
        else:
            # Standard connection for local development and testing
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{db_name}"
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # Google Cloud
    GOOGLE_CLOUD_PROJECT: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    
    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")
    
    # Frontend URL for OAuth redirects
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # File Upload
    MAX_FILE_SIZE: int = 50 * 1024 * 1024  # 50MB
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")
    
    # CORS - configurable origins with sensible defaults
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins from environment or use defaults based on environment."""
        cors_env = os.getenv("CORS_ORIGINS", "")
        
        if cors_env == "*":
            # Allow all origins (for development/testing)
            return ["*"]
        elif cors_env:
            # Parse comma-separated origins from environment
            return [origin.strip() for origin in cors_env.split(",")]
        else:
            # Default origins based on environment
            if self.ENVIRONMENT == "dev":
                return [
                    "http://localhost:3000", 
                    "http://127.0.0.1:3000",
                    "https://your-frontend-url.web.app"
                ]
            else:
                return ["https://your-frontend-url.web.app"]
    
    @property 
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        return self.get_cors_origins()


settings = Settings()
