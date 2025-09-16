#!/bin/bash
set -e

echo "🚀 Starting Project Nexus services..."

# Start PostgreSQL
echo "📊 Starting PostgreSQL..."
sudo -u postgres /usr/lib/postgresql/15/bin/postgres -D /var/lib/postgresql/data -c config_file=/etc/postgresql/15/main/postgresql.conf &
sleep 5

# Setup PostgreSQL database and user
echo "🔧 Setting up PostgreSQL database..."
sudo -u postgres bash -c '
createuser -s nexus 2>/dev/null || true
createdb -O nexus nexus_db 2>/dev/null || true
psql -c "ALTER USER nexus WITH PASSWORD '\''nexus_secure_2024'\'';" 2>/dev/null || true
psql -d nexus_db -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
'

# Start Redis
echo "📊 Starting Redis..."
redis-server --daemonize yes --port 6379 --bind 0.0.0.0 --protected-mode no --dir /var/lib/redis --appendonly no --maxmemory 512mb --maxmemory-policy allkeys-lru

# Start Adminer
echo "📊 Starting Adminer..."
cd /var/www/html && php -S 0.0.0.0:8080 &

# Start Redis Commander
echo "📊 Starting Redis Commander..."
redis-commander --port 8081 --redis-host localhost --redis-port 6379 &

sleep 3

echo "✅ All services started successfully!"
echo ""
echo "📊 Services available:"
echo "  PostgreSQL: localhost:5432"
echo "  Redis: localhost:6379"
echo "  Adminer: http://localhost:8080"
echo "  Redis Commander: http://localhost:8081"
echo ""
echo "🗄️  Adminer login details:"
echo "  Server: localhost"
echo "  Username: nexus"
echo "  Password: nexus_secure_2024"
echo "  Database: nexus_db"
echo ""
echo "💡 Quick Adminer URL:"
echo "  http://localhost:8080/?server=localhost&username=nexus&db=nexus_db"
echo ""
echo "🚀 DevContainer ready!"