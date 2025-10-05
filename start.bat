@echo off
setlocal EnableDelayedExpansion

echo 🚀 Starting Dialogflow Agent Tester Setup...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ docker-compose is not installed. Please install docker-compose and try again.
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist "backend\.env" (
    echo 📝 Creating backend\.env file...
    copy "backend\.env.example" "backend\.env"
    echo ⚠️  Please edit backend\.env with your Google Cloud configuration before continuing.
    echo    Required: GOOGLE_CLOUD_PROJECT, service-account.json file
)

REM Check for service account file
if not exist "service-account.json" (
    echo ⚠️  service-account.json not found in project root.
    echo    Please add your Google Cloud service account key file as 'service-account.json'
    echo    You can continue without it for local development, but Dialogflow features won't work.
)

REM Build and start services
echo 🔨 Building and starting services...
docker-compose down --remove-orphans
docker-compose build
docker-compose up -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

REM Check service health
echo 🔍 Checking service health...

REM Check backend
curl -f http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo ❌ Backend health check failed
    echo    Logs:
    docker-compose logs backend
) else (
    echo ✅ Backend is healthy
)

REM Check frontend
curl -f http://localhost:3000 >nul 2>&1
if errorlevel 1 (
    echo ❌ Frontend health check failed
    echo    Logs:
    docker-compose logs frontend
) else (
    echo ✅ Frontend is healthy
)

echo.
echo 🎉 Setup complete!
echo.
echo 🌐 Access the application:
echo    Frontend: http://localhost:3000
echo    Backend API: http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo.
echo 📋 Useful commands:
echo    View logs: docker-compose logs -f
echo    Stop services: docker-compose down
echo    Restart: docker-compose restart
echo.
echo ⚠️  Remember to:
echo    1. Update backend\.env with your Google Cloud settings
echo    2. Add service-account.json for Dialogflow integration
echo    3. Change the default admin password in production

pause
