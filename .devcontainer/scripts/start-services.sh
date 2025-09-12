#!/bin/bash

# Project Nexus - Service Management Script
# Manages all services (PostgreSQL, Redis, Adminer, Redis Commander)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a service is running
check_service() {
    case $1 in
        postgres)
            pg_isready -h localhost -p 5432 -U nexus > /dev/null 2>&1
            ;;
        redis)
            redis-cli ping > /dev/null 2>&1
            ;;
        adminer)
            curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null | grep -q "200"
            ;;
        redis-commander)
            curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 2>/dev/null | grep -q "200"
            ;;
    esac
}

# Function to start PostgreSQL
start_postgres() {
    if check_service postgres; then
        print_success "PostgreSQL is already running"
        return 0
    fi
    
    print_status "Starting PostgreSQL..."
    
    # Ensure proper permissions
    sudo mkdir -p /var/run/postgresql
    sudo chown postgres:postgres /var/run/postgresql
    sudo chmod 2775 /var/run/postgresql
    
    # Start PostgreSQL
    sudo -u postgres /usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/15/main -l /var/log/postgresql/postgresql-15-main.log start
    
    # Wait for it to be ready
    for i in {1..30}; do
        if check_service postgres; then
            print_success "PostgreSQL started successfully"
            return 0
        fi
        sleep 1
    done
    
    print_error "PostgreSQL failed to start within 30 seconds"
    return 1
}

# Function to start Redis
start_redis() {
    if check_service redis; then
        print_success "Redis is already running"
        return 0
    fi
    
    print_status "Starting Redis..."
    redis-server /home/vscode/redis.conf --daemonize yes
    
    # Wait for it to be ready
    for i in {1..15}; do
        if check_service redis; then
            print_success "Redis started successfully"
            return 0
        fi
        sleep 1
    done
    
    print_error "Redis failed to start within 15 seconds"
    return 1
}

# Function to start Adminer
start_adminer() {
    if check_service adminer; then
        print_success "Adminer is already running"
        return 0
    fi
    
    print_status "Starting Adminer..."
    
    # Stop any existing process
    pkill -f "adminer.php" 2>/dev/null || true
    
    # Start Adminer
    cd /opt/adminer && nohup php -S 0.0.0.0:8080 adminer.php > /tmp/adminer.log 2>&1 &
    
    # Wait for it to be ready
    sleep 3
    for i in {1..10}; do
        if check_service adminer; then
            print_success "Adminer started successfully - http://localhost:8080"
            return 0
        fi
        sleep 1
    done
    
    print_warning "Adminer may still be starting - check http://localhost:8080"
    return 0
}

# Function to start Redis Commander
start_redis_commander() {
    if check_service redis-commander; then
        print_success "Redis Commander is already running"
        return 0
    fi
    
    print_status "Starting Redis Commander..."
    
    # Stop any existing process
    pkill -f "redis-commander" 2>/dev/null || true
    
    # Start Redis Commander
    nohup redis-commander --port 8081 --redis-host localhost --redis-port 6379 > /tmp/redis-commander.log 2>&1 &
    
    # Wait for it to be ready
    sleep 3
    for i in {1..10}; do
        if check_service redis-commander; then
            print_success "Redis Commander started successfully - http://localhost:8081"
            return 0
        fi
        sleep 1
    done
    
    print_warning "Redis Commander may still be starting - check http://localhost:8081"
    return 0
}

# Function to stop services
stop_service() {
    case $1 in
        postgres)
            print_status "Stopping PostgreSQL..."
            sudo -u postgres /usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/15/main stop || true
            print_success "PostgreSQL stopped"
            ;;
        redis)
            print_status "Stopping Redis..."
            redis-cli shutdown || true
            print_success "Redis stopped"
            ;;
        adminer)
            print_status "Stopping Adminer..."
            pkill -f "adminer.php" 2>/dev/null || true
            print_success "Adminer stopped"
            ;;
        redis-commander)
            print_status "Stopping Redis Commander..."
            pkill -f "redis-commander" 2>/dev/null || true
            print_success "Redis Commander stopped"
            ;;
    esac
}

# Function to show service status
show_status() {
    echo ""
    echo "=== 📊 Project Nexus Service Status ==="
    echo ""
    
    # Database services
    if check_service postgres; then
        echo "🗄️  PostgreSQL:     ✅ Running (port 5432)"
    else
        echo "🗄️  PostgreSQL:     ❌ Not running"
    fi
    
    if check_service redis; then
        echo "🔴 Redis:           ✅ Running (port 6379)"
    else
        echo "🔴 Redis:           ❌ Not running"
    fi
    
    # Admin tools
    if check_service adminer; then
        echo "💾 Adminer:         ✅ Running → http://localhost:8080"
    else
        echo "💾 Adminer:         ❌ Not running"
    fi
    
    if check_service redis-commander; then
        echo "🔧 Redis Commander: ✅ Running → http://localhost:8081"
    else
        echo "🔧 Redis Commander: ❌ Not running"
    fi
    
    echo ""
    
    # Application ports
    echo "=== 🚀 Application Ports ==="
    echo "Backend API:        http://localhost:3000 ($(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null | grep -q "200\|404" && echo "✅" || echo "❌"))"
    echo "Frontend Web:       http://localhost:3001 ($(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null | grep -q "200\|404" && echo "✅" || echo "❌"))"
    echo ""
}

# Main script logic
case "${1:-start}" in
    start)
        print_status "🚀 Starting all Project Nexus services..."
        echo ""
        
        start_postgres || exit 1
        start_redis || exit 1
        start_adminer
        start_redis_commander
        
        echo ""
        show_status
        
        echo "💡 Tips:"
        echo "   • Use './scripts/start-services.sh status' to check service status"
        echo "   • Use './scripts/start-services.sh stop' to stop all services"
        echo "   • Start your apps with 'npm run dev' in backend/ and clients/web/"
        echo ""
        ;;
        
    stop)
        print_status "🛑 Stopping all services..."
        stop_service adminer
        stop_service redis-commander
        stop_service redis
        stop_service postgres
        print_success "All services stopped"
        ;;
        
    restart)
        print_status "🔄 Restarting all services..."
        $0 stop
        sleep 2
        $0 start
        ;;
        
    status)
        show_status
        ;;
        
    postgres)
        start_postgres
        ;;
        
    redis)
        start_redis
        ;;
        
    adminer)
        start_adminer
        ;;
        
    redis-commander)
        start_redis_commander
        ;;
        
    *)
        echo "Usage: $0 {start|stop|restart|status|postgres|redis|adminer|redis-commander}"
        echo ""
        echo "Commands:"
        echo "  start             Start all services"
        echo "  stop              Stop all services"
        echo "  restart           Restart all services"
        echo "  status            Show service status"
        echo "  postgres          Start PostgreSQL only"
        echo "  redis             Start Redis only"
        echo "  adminer           Start Adminer only"
        echo "  redis-commander   Start Redis Commander only"
        exit 1
        ;;
esac