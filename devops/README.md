# Project Nexus - Docker Development Environment

This directory contains the Docker Compose configuration for running Project Nexus infrastructure services locally.

## Services Included

- **PostgreSQL with pgvector**: Main database with vector search capabilities
- **Redis**: Caching and session storage
- **Adminer**: Web-based database administration tool
- **Redis Commander**: Web-based Redis administration tool

## Quick Start

### Option 1: Run from devops directory (recommended)
```bash
cd devops
docker-compose up -d
```

### Option 2: Run from root directory
```bash
docker-compose -f devops/docker-compose.yml up -d
```

## Service Access

- **PostgreSQL**: `localhost:5432`
  - Database: `nexus_db`
  - Username: `nexus`
  - Password: `nexus_secure_2024`

- **Redis**: `localhost:6379`
  - No password required for development

- **Adminer** (Database GUI): http://localhost:8080
  - Pre-configured with auto-login

- **Redis Commander** (Redis GUI): http://localhost:8081
  - Username: `admin`
  - Password: `admin123`

## Environment Variables

All environment variables are loaded from the root `.env` file. The containers inherit all environment variables from that file, ensuring consistency across the application.

## Data Persistence

Database and cache data are persisted using Docker named volumes:
- `postgres-data`: PostgreSQL database files
- `redis-data`: Redis data files

## Stopping Services

```bash
cd devops
docker-compose down
```

To also remove volumes (⚠️ this will delete all data):
```bash
cd devops
docker-compose down -v
```