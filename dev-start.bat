@echo off
REM Development startup script for Windows
REM Provides easy Docker Compose management with hot-reload

echo ============================================
echo Project Nexus Development Environment
echo ============================================
echo.

REM Check if Docker is running
docker version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Parse command line arguments
if "%1"=="--clean" goto clean
if "%1"=="--rebuild" goto rebuild
if "%1"=="--logs" goto logs
if "%1"=="--stop" goto stop
goto start

:clean
echo Cleaning development environment...
docker-compose down -v
docker volume rm project-nexus_web_node_modules project-nexus_web_next_cache project-nexus_backend_node_modules 2>nul
echo Clean complete!
goto start

:rebuild
echo Rebuilding containers...
docker-compose build --no-cache
goto start

:logs
if "%2"=="" (
    docker-compose logs -f
) else (
    docker-compose logs -f %2
)
goto end

:stop
echo Stopping development environment...
docker-compose down
echo Stopped!
goto end

:start
echo Starting development environment with hot-reload...
echo.
echo Services will be available at:
echo   - Frontend:   http://localhost:3001 (hot-reload enabled)
echo   - Backend:    http://localhost:3000 (hot-reload enabled)
echo   - GraphQL:    http://localhost:3000/graphql
echo   - PostgreSQL: localhost:5432
echo   - Redis:      localhost:6379
echo.

REM Start services
docker-compose up -d

REM Wait for services to be healthy
echo Waiting for services to be ready...
timeout /t 5 /nobreak >nul

REM Check health status
docker-compose ps

echo.
echo Development environment started!
echo.
echo Commands:
echo   dev-start --clean    - Clean start (removes volumes)
echo   dev-start --rebuild  - Rebuild containers
echo   dev-start --logs     - View all logs
echo   dev-start --logs backend - View backend logs
echo   dev-start --stop     - Stop environment
echo.
echo Press Ctrl+C to stop viewing logs
docker-compose logs -f --tail=50

:end