#!/bin/bash
# Project Nexus Docker Setup Script
# Automates the setup of the development environment

set -e  # Exit on any error

echo "🚀 Setting up Project Nexus Development Environment"
echo "=================================================="

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

# Create necessary directories
echo "📁 Creating data directories..."
mkdir -p ./data/postgres
mkdir -p ./data/redis  
mkdir -p ./data/logs
chmod 755 ./data/postgres ./data/redis ./data/logs

# Copy environment template if .env doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your Auth0 and OpenAI credentials before continuing."
    echo "   Required variables:"
    echo "   - AUTH0_DOMAIN"
    echo "   - AUTH0_CLIENT_ID"
    echo "   - AUTH0_CLIENT_SECRET"
    echo "   - OPENAI_API_KEY"
    echo ""
    read -p "Have you configured the .env file? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Please configure .env file and run this script again."
        exit 1
    fi
fi

# Check if required environment variables are set
echo "🔍 Checking environment configuration..."
source .env

required_vars=("AUTH0_DOMAIN" "AUTH0_CLIENT_ID" "AUTH0_CLIENT_SECRET" "OPENAI_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" = "your_" ] || [ "${!var}" = "sk-your-" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "❌ Missing or invalid environment variables:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo "Please configure these in your .env file."
    exit 1
fi

echo "✅ Environment configuration looks good!"

# Build and start services
echo "🏗️  Building and starting services..."
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
timeout 60 bash -c 'until docker-compose exec postgres pg_isready -U ${POSTGRES_USER:-nexus} -d ${POSTGRES_DB:-nexus_db}; do sleep 2; done' || {
    echo "❌ PostgreSQL failed to start within 60 seconds"
    docker-compose logs postgres
    exit 1
}

timeout 30 bash -c 'until docker-compose exec redis redis-cli ping | grep -q PONG; do sleep 2; done' || {
    echo "❌ Redis failed to start within 30 seconds"
    docker-compose logs redis
    exit 1
}

echo "✅ All services are running!"

# Display service information
echo ""
echo "🎉 Project Nexus is ready!"
echo "========================="
echo "Backend API:          http://localhost:${BACKEND_PORT:-3000}"
echo "GraphQL Playground:   http://localhost:${BACKEND_PORT:-3000}/graphql"
echo "Database Admin:       http://localhost:${ADMINER_PORT:-8080}"
echo "Redis Commander:      http://localhost:${REDIS_COMMANDER_PORT:-8081}"
echo ""
echo "Health checks:"
echo "- Backend:   curl http://localhost:${BACKEND_PORT:-3000}/health"
echo "- Database:  docker-compose exec postgres pg_isready"
echo "- Redis:     docker-compose exec redis redis-cli ping"
echo ""
echo "Useful commands:"
echo "- View logs:     docker-compose logs -f [service]"
echo "- Stop services: docker-compose down"
echo "- Restart:       docker-compose restart [service]"
echo "- Shell access:  docker-compose exec [service] sh"
echo ""
echo "📚 Check the README for development workflow and API documentation."