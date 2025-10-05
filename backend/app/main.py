from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import json
import logging

from app.core.config import settings
from app.api import auth, datasets, dialogflow, tests, evaluation, quick_add_parameters, dashboard
from app.services.test_execution_service import TestRunExecutionService
from app.services.model_cache_service import model_cache_service

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database initialization is handled separately in init_db.py during container startup

def run_migrations_safely():
    """Run database migrations - delegates to MigrationManager with built-in error handling."""
    try:
        from app.core.migration_manager import run_migrations
        run_migrations()
        logger.info("✅ All database migrations completed successfully")
    except Exception as e:
        # MigrationManager already logged the error details
        # Only re-raise if it's truly critical (not permission or already exists errors)
        if not any(phrase in str(e).lower() for phrase in ["permission denied", "already exists", "does not exist"]):
            logger.error(f"❌ CRITICAL migration error: {e}")
            raise
        else:
            logger.warning(f"⚠️ Migration warning (non-critical): {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on application startup."""
    logger.info("🚀 Starting application services...")
    
    # Run database migrations SYNCHRONOUSLY - must succeed for app to start
    logger.info("🔄 Running required database migrations...")
    run_migrations_safely()
    logger.info("✅ All database migrations completed successfully")
    
    # Initialize model cache in background (don't block further startup)
    asyncio.create_task(initialize_model_cache())
    
    logger.info("✅ Application startup completed")

async def initialize_model_cache():
    """Initialize the model cache service in the background."""
    try:
        logger.info("🔄 Starting Gemini model cache initialization...")
        logger.info(f"🔧 Environment check - GOOGLE_API_KEY present: {bool(getattr(settings, 'GOOGLE_API_KEY', None))}")
        
        models = await model_cache_service.get_available_models()
        
        logger.info(f"✅ Model cache initialization completed: {len(models)} models loaded")
        if models:
            model_ids = [m.get('id', 'unknown') for m in models[:5]]  # Log first 5 model IDs
            logger.info(f"📋 Sample models: {', '.join(model_ids)}{'...' if len(models) > 5 else ''}")
        else:
            logger.warning("⚠️  No models were loaded into cache!")
            
    except Exception as e:
        logger.error(f"❌ Model cache initialization failed with error: {e}")
        logger.error(f"🔍 Error details: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(f"📜 Traceback: {traceback.format_exc()}")

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(datasets.router, prefix=f"{settings.API_V1_STR}/datasets", tags=["datasets"])
app.include_router(dialogflow.router, prefix=f"{settings.API_V1_STR}/dialogflow", tags=["dialogflow"])
app.include_router(tests.router, prefix=f"{settings.API_V1_STR}/tests", tags=["tests"])
app.include_router(evaluation.router, prefix=f"{settings.API_V1_STR}", tags=["evaluation"])
app.include_router(quick_add_parameters.router, prefix=f"{settings.API_V1_STR}", tags=["quick-add-parameters"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove broken connections
                self.active_connections.remove(connection)

manager = ConnectionManager()

@app.websocket("/ws/{test_run_id}")
async def websocket_endpoint(websocket: WebSocket, test_run_id: int):
    """WebSocket endpoint for real-time test progress updates."""
    await manager.connect(websocket)
    test_execution_service = TestRunExecutionService()
    
    try:
        while True:
            # Get current progress
            progress = await test_execution_service.get_test_progress(test_run_id)
            
            # Send progress update
            await manager.send_personal_message(json.dumps(progress), websocket)
            
            # Stop sending updates if test is completed
            if progress.get("status") in ["completed", "failed", "cancelled"]:
                break
            
            # Wait before next update
            await asyncio.sleep(2)  # Update every 2 seconds
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        # Log error and disconnect
        print(f"WebSocket error for test run {test_run_id}: {str(e)}")
        manager.disconnect(websocket)

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Dialogflow Agent Tester API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

@app.get("/health/database")
async def database_health_check():
    """Database connectivity health check endpoint."""
    health_status = {"status": "checking"}
    
    # Test database connectivity
    try:
        from app.core.database import get_engine
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test_connection, current_user, current_database()"))
            row = result.fetchone()
            health_status["status"] = "healthy"
            health_status["database"] = "connected"
            health_status["database_auth"] = "IAM" if settings.USE_IAM_AUTH else "password"
            health_status["current_user"] = row[1] if row else "unknown"
            health_status["current_database"] = row[2] if row else "unknown"
            health_status["connection_name"] = settings.POSTGRES_CONNECTION_NAME
    except Exception as e:
        health_status["status"] = "error"
        health_status["database"] = "error"
        health_status["database_error"] = str(e)
    
    return health_status

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
