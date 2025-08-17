#!/bin/bash
# Automated backup script for Project Nexus
# Run daily via cron or docker container

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="${DB_HOST:-postgres}"
DB_NAME="${DB_NAME:-nexus_production}"
DB_USER="${DB_USER:-nexus}"
REDIS_HOST="${REDIS_HOST:-redis}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting backup process at $(date)${NC}"

# Create backup directories
mkdir -p "$BACKUP_DIR/postgres"
mkdir -p "$BACKUP_DIR/redis"
mkdir -p "$BACKUP_DIR/volumes"

# Backup PostgreSQL
echo -e "${YELLOW}Backing up PostgreSQL database...${NC}"
PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --verbose \
    --format=custom \
    --blobs \
    --no-owner \
    --no-privileges \
    -f "$BACKUP_DIR/postgres/nexus_${TIMESTAMP}.dump"

# Compress the backup
gzip "$BACKUP_DIR/postgres/nexus_${TIMESTAMP}.dump"
echo -e "${GREEN}PostgreSQL backup completed: nexus_${TIMESTAMP}.dump.gz${NC}"

# Backup Redis
echo -e "${YELLOW}Backing up Redis data...${NC}"
redis-cli -h "$REDIS_HOST" --auth "$REDIS_PASSWORD" --rdb "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"
gzip "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb"
echo -e "${GREEN}Redis backup completed: redis_${TIMESTAMP}.rdb.gz${NC}"

# Backup Docker volumes (optional - for file uploads, etc.)
echo -e "${YELLOW}Backing up Docker volumes...${NC}"
tar -czf "$BACKUP_DIR/volumes/volumes_${TIMESTAMP}.tar.gz" \
    /var/lib/docker/volumes/project-nexus_* 2>/dev/null || true

# Clean up old backups
echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +$RETENTION_DAYS -delete

# Upload to S3/cloud storage (optional)
if [ ! -z "$AWS_S3_BUCKET" ]; then
    echo -e "${YELLOW}Uploading backups to S3...${NC}"
    aws s3 cp "$BACKUP_DIR/postgres/nexus_${TIMESTAMP}.dump.gz" \
        "s3://$AWS_S3_BUCKET/backups/postgres/" --storage-class GLACIER
    aws s3 cp "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb.gz" \
        "s3://$AWS_S3_BUCKET/backups/redis/" --storage-class GLACIER
fi

# Send notification (optional)
if [ ! -z "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"✅ Backup completed successfully at $(date)\"}" \
        "$SLACK_WEBHOOK"
fi

echo -e "${GREEN}Backup process completed successfully at $(date)${NC}"

# Report backup sizes
echo "Backup sizes:"
du -sh "$BACKUP_DIR/postgres/nexus_${TIMESTAMP}.dump.gz" 2>/dev/null || true
du -sh "$BACKUP_DIR/redis/redis_${TIMESTAMP}.rdb.gz" 2>/dev/null || true
du -sh "$BACKUP_DIR/volumes/volumes_${TIMESTAMP}.tar.gz" 2>/dev/null || true