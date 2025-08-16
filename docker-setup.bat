@echo off
REM Project Nexus Docker Setup Script for Windows
REM Automates the setup of the development environment

echo 🚀 Setting up Project Nexus Development Environment
echo ==================================================

REM Check if Docker is installed and running
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Docker Compose is not available. Please install Docker Compose.
        pause
        exit /b 1
    )
)

REM Create necessary directories
echo 📁 Creating data directories...
if not exist "data" mkdir data
if not exist "data\postgres" mkdir data\postgres
if not exist "data\redis" mkdir data\redis
if not exist "data\logs" mkdir data\logs

REM Copy environment template if .env doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy ".env.example" ".env"
    echo ⚠️  Please edit .env file with your Auth0 and OpenAI credentials before continuing.
    echo    Required variables:
    echo    - AUTH0_DOMAIN
    echo    - AUTH0_CLIENT_ID
    echo    - AUTH0_CLIENT_SECRET
    echo    - OPENAI_API_KEY
    echo.
    set /p configured="Have you configured the .env file? (y/N): "
    if /i not "%configured%"=="y" (
        echo Please configure .env file and run this script again.
        pause
        exit /b 1
    )
)

echo ✅ Environment file exists!

REM Build and start services
echo 🏗️  Building and starting services...
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

REM Wait for services to be healthy
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

echo ✅ Services started!

REM Display service information
echo.
echo 🎉 Project Nexus is ready!
echo =========================
echo Backend API:          http://localhost:3000
echo GraphQL Playground:   http://localhost:3000/graphql
echo Database Admin:       http://localhost:8080
echo Redis Commander:      http://localhost:8081
echo.
echo Health checks:
echo - Backend:   curl http://localhost:3000/health
echo - Database:  docker-compose exec postgres pg_isready
echo - Redis:     docker-compose exec redis redis-cli ping
echo.
echo Useful commands:
echo - View logs:     docker-compose logs -f [service]
echo - Stop services: docker-compose down
echo - Restart:       docker-compose restart [service]
echo - Shell access:  docker-compose exec [service] sh
echo.
echo 📚 Check the README for development workflow and API documentation.
pause