#!/bin/bash
# Development startup script for Linux/macOS
# Provides easy Docker Compose management with hot-reload

set -e

echo "============================================"
echo "Project Nexus Development Environment"
echo "============================================"
echo

# Check if Docker is running
if ! docker version >/dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker."
    exit 1
fi

# Parse command line arguments
case "$1" in
    --clean)
        echo "Cleaning development environment..."
        docker-compose down -v
        docker volume rm project-nexus_web_node_modules project-nexus_web_next_cache project-nexus_backend_node_modules 2>/dev/null || true
        echo "Clean complete!"
        ;;
    --rebuild)
        echo "Rebuilding containers..."
        docker-compose build --no-cache
        ;;
    --logs)
        if [ -z "$2" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$2"
        fi
        exit 0
        ;;
    --stop)
        echo "Stopping development environment..."
        docker-compose down
        echo "Stopped!"
        exit 0
        ;;
esac

echo "Starting development environment with hot-reload..."
echo
echo "Services will be available at:"
echo "  - Frontend:   http://localhost:3001 (hot-reload enabled)"
echo "  - Backend:    http://localhost:3000 (hot-reload enabled)"
echo "  - GraphQL:    http://localhost:3000/graphql"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis:      localhost:6379"
echo

# Start services
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Check health status
docker-compose ps

echo
echo "Development environment started!"
echo
echo "Commands:"
echo "  ./dev-start.sh --clean    - Clean start (removes volumes)"
echo "  ./dev-start.sh --rebuild  - Rebuild containers"
echo "  ./dev-start.sh --logs     - View all logs"
echo "  ./dev-start.sh --logs backend - View backend logs"
echo "  ./dev-start.sh --stop     - Stop environment"
echo
echo "Press Ctrl+C to stop viewing logs"
docker-compose logs -f --tail=50