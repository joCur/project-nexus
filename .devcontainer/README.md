# Project Nexus DevContainer

This devcontainer provides a complete development environment for Project Nexus with all services running natively in GitHub Codespaces (no docker-in-docker).

## 🚀 Quick Start

1. **Open in Codespaces**: Click "Create codespace" when opening this repository
2. **Wait for setup**: The container will automatically install dependencies and configure services
3. **Update environment**: Add your Auth0 credentials to `.env`
4. **Start development**: Run your backend and frontend applications

## 📦 What's Included

### Core Services
- **Node.js 22 LTS** - Latest long-term support version
- **PostgreSQL 15** with pgvector extension for embeddings
- **Redis 7** with persistence configuration
- **TypeScript** with full toolchain support

### Admin Tools
- **Adminer** (port 8080) - Web-based PostgreSQL admin interface
- **Redis Commander** (port 8081) - Redis visualization and management

### Development Tools
- **VS Code Extensions** - TypeScript, GraphQL, Tailwind CSS, testing tools
- **GitHub CLI** - For managing pull requests and issues
- **Claude Code** - AI coding assistant integration
- **Database tools** - psql client, redis-cli

## 🔧 Service Management

### Automatic Startup
Services start automatically when the container launches:
- PostgreSQL on port 5432
- Redis on port 6379  
- Adminer on port 8080
- Redis Commander on port 8081

### Manual Control
Use the service management script for manual control:

```bash
# Start all services
./scripts/start-services.sh start

# Check service status
./scripts/start-services.sh status

# Stop all services
./scripts/start-services.sh stop

# Restart services
./scripts/start-services.sh restart

# Start individual services
./scripts/start-services.sh postgres
./scripts/start-services.sh redis
./scripts/start-services.sh adminer
./scripts/start-services.sh redis-commander
```

### Quick Status Check
```bash
./scripts/status.sh
```

## 🗄️ Database Setup

### Automatic Configuration
- **Main Database**: `nexus_db`
- **Test Database**: `nexus_db_test`
- **User**: `nexus` / **Password**: `nexus_secure_2024`
- **Extensions**: pgvector, uuid-ossp, pg_trgm, btree_gin, pg_stat_statements

### Manual Database Setup
```bash
./.devcontainer/scripts/setup-database.sh
```

### Database Reset
```bash
./scripts/db-reset.sh
```

## 🌐 Port Mapping

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Backend API | 3000 | http://localhost:3000 | GraphQL API |
| Frontend Web | 3001 | http://localhost:3001 | Next.js Application |
| PostgreSQL | 5432 | localhost:5432 | Database |
| Redis | 6379 | localhost:6379 | Cache |
| Adminer | 8080 | http://localhost:8080 | Database Admin |
| Redis Commander | 8081 | http://localhost:8081 | Redis Management |

## 🚀 Starting Your Applications

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development  
```bash
cd clients/web
npm run dev
```

### Run Both Concurrently
```bash
# In one terminal
cd backend && npm run dev

# In another terminal  
cd clients/web && npm run dev
```

## 📝 Environment Configuration

The setup creates a `.env` template with all required variables. Update these values:

### Required Updates
```env
# Auth0 Configuration (Required)
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_MANAGEMENT_CLIENT_ID=your-management-client-id
AUTH0_MANAGEMENT_CLIENT_SECRET=your-management-client-secret

# OpenAI Configuration (For embeddings)
OPENAI_API_KEY=your-openai-api-key
```

### Pre-configured Values
```env
# Database (Ready to use)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=nexus_db
POSTGRES_USER=nexus
POSTGRES_PASSWORD=nexus_secure_2024

# Redis (Ready to use)
REDIS_HOST=localhost
REDIS_PORT=6379

# Development settings
NODE_ENV=development
BACKEND_PORT=3000
WEB_PORT=3001
```

## 🔍 Database Access

### Via Adminer (Web Interface)
1. Open http://localhost:8080
2. **Server**: `localhost`
3. **Username**: `nexus`
4. **Password**: `nexus_secure_2024`
5. **Database**: `nexus_db`

### Via psql (Command Line)
```bash
psql -h localhost -U nexus -d nexus_db
```

## 🔧 Troubleshooting

### Services Not Starting
```bash
# Check service status
./scripts/start-services.sh status

# Restart all services
./scripts/start-services.sh restart

# Check logs
tail -f /var/log/postgresql/postgresql-15-main.log
tail -f /tmp/adminer.log
tail -f /tmp/redis-commander.log
```

### Database Connection Issues
```bash
# Test database connection
pg_isready -h localhost -p 5432 -U nexus

# Reset database
./scripts/db-reset.sh

# Manual database setup
./.devcontainer/scripts/setup-database.sh
```

### Application Issues
```bash
# Clear npm cache and reinstall
cd backend && rm -rf node_modules && npm ci
cd clients/web && rm -rf node_modules && npm ci

# Check TypeScript
cd backend && npm run type-check
cd clients/web && npm run type-check
```

## 🧩 PostgreSQL Extensions

Pre-installed extensions for Project Nexus:

- **vector** - pgvector for embeddings and similarity search
- **uuid-ossp** - UUID generation functions
- **pg_trgm** - Text similarity and fuzzy matching
- **btree_gin** - GIN indexes for better performance
- **pg_stat_statements** - Query performance statistics

## 📊 Sample Data

The setup includes a sample `sample_embeddings` table with:
- Vector similarity search capabilities
- Sample embedding data
- Optimized indexes for performance

## 🔒 Security Notes

- Default passwords are for development only
- Auth0 credentials must be configured for authentication
- Services are bound to localhost only
- No external network access by default

## 📚 Additional Resources

- [Project Documentation](../README.md)
- [Backend Documentation](../backend/README.md)
- [Frontend Documentation](../clients/web/README.md)
- [Testing Guide](../TESTING.md)

## 🎯 Development Workflow

1. **Start Services**: All services start automatically
2. **Update Environment**: Configure `.env` with your credentials  
3. **Run Migrations**: Database setup happens automatically
4. **Start Applications**: Run backend and frontend in development mode
5. **Use Admin Tools**: Access Adminer and Redis Commander for debugging
6. **Run Tests**: Execute test suites as needed
7. **Commit Changes**: Use GitHub CLI for pull requests

Ready to start developing! 🚀