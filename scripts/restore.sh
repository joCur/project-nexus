#!/bin/bash
# Restore script for Project Nexus
# Usage: ./restore.sh [postgres|redis|all] [backup_file]

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="${DB_HOST:-postgres}"
DB_NAME="${DB_NAME:-nexus_production}"
DB_USER="${DB_USER:-nexus}"
REDIS_HOST="${REDIS_HOST:-redis}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to restore PostgreSQL
restore_postgres() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restoring PostgreSQL from $backup_file...${NC}"
    
    # Stop application containers to prevent connections
    docker-compose -f docker-compose.prod.yml stop backend web
    
    # Drop existing database and recreate
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME}_temp;"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME}_temp;"
    
    # Restore backup
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | PGPASSWORD="$DB_PASSWORD" pg_restore \
            -h "$DB_HOST" \
            -U "$DB_USER" \
            -d "${DB_NAME}_temp" \
            --verbose \
            --no-owner \
            --no-privileges
    else
        PGPASSWORD="$DB_PASSWORD" pg_restore \
            -h "$DB_HOST" \
            -U "$DB_USER" \
            -d "${DB_NAME}_temp" \
            --verbose \
            --no-owner \
            --no-privileges \
            "$backup_file"
    fi
    
    # Swap databases
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" <<EOF
ALTER DATABASE ${DB_NAME} RENAME TO ${DB_NAME}_old;
ALTER DATABASE ${DB_NAME}_temp RENAME TO ${DB_NAME};
EOF
    
    # Restart application
    docker-compose -f docker-compose.prod.yml start backend web
    
    echo -e "${GREEN}PostgreSQL restore completed successfully${NC}"
}

# Function to restore Redis
restore_redis() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not found: $backup_file${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Restoring Redis from $backup_file...${NC}"
    
    # Stop Redis to replace data file
    docker-compose -f docker-compose.prod.yml stop redis
    
    # Extract if compressed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > /tmp/redis_restore.rdb
        backup_file="/tmp/redis_restore.rdb"
    fi
    
    # Copy backup file to Redis data directory
    docker cp "$backup_file" nexus-redis:/data/dump.rdb
    
    # Start Redis
    docker-compose -f docker-compose.prod.yml start redis
    
    echo -e "${GREEN}Redis restore completed successfully${NC}"
}

# Main script
case "$1" in
    postgres)
        restore_postgres "$2"
        ;;
    redis)
        restore_redis "$2"
        ;;
    all)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Usage: $0 all <postgres_backup> <redis_backup>${NC}"
            exit 1
        fi
        restore_postgres "$2"
        restore_redis "$3"
        ;;
    *)
        echo "Usage: $0 [postgres|redis|all] [backup_file(s)]"
        echo ""
        echo "Examples:"
        echo "  $0 postgres /backups/postgres/nexus_20240101_120000.dump.gz"
        echo "  $0 redis /backups/redis/redis_20240101_120000.rdb.gz"
        echo "  $0 all postgres_backup.dump.gz redis_backup.rdb.gz"
        exit 1
        ;;
esac