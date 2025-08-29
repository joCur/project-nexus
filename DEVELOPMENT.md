# Development Setup Guide

This guide provides comprehensive instructions for setting up Project Nexus for local development with optimized hot-reload capabilities.

## Quick Start

### Windows Users
```cmd
# Run the setup script
dev-setup.bat

# Or for a clean start (removes all development caches)
dev-setup.bat --clean
```

### Linux/macOS Users
```bash
# Make the script executable (first time only)
chmod +x dev-setup.sh

# Run the setup script
./dev-setup.sh

# Or for a clean start (removes all development caches)
./dev-setup.sh --clean
```

## What's Optimized

### Hot-Reload Configuration

**Frontend (Next.js):**
- ✅ Turbopack enabled for faster builds
- ✅ File watching with polling for Docker compatibility
- ✅ Separate volume for `.next` cache to preserve builds
- ✅ Source code mounted with read-write access
- ✅ Development-specific environment variables

**Backend (Node.js):**
- ✅ Nodemon with polling and legacy watch mode
- ✅ Source files mounted with read-write access (no `:ro`)
- ✅ TypeScript transpilation with `ts-node`
- ✅ Automatic restart on file changes
- ✅ Separate volume for `node_modules` to preserve dependencies

### Performance Optimizations

1. **Volume Strategy:**
   - Source code: Mounted directly for hot-reload
   - Dependencies: Cached in named volumes for performance
   - Build artifacts: Persisted to avoid rebuilds

2. **Container Startup:**
   - Parallel building with `docker-compose build --parallel`
   - Sequential startup to respect service dependencies
   - Health checks to ensure services are ready

3. **Development Tools:**
   - Adminer for database management
   - Redis Commander for cache management
   - Exposed ports for direct database access

## Service URLs

- **Web Application:** http://localhost:3001
- **Backend API:** http://localhost:3000
- **GraphQL Playground:** http://localhost:3000/graphql
- **Database Admin (Adminer):** http://localhost:8080
- **Redis Commander:** http://localhost:8081

## Development Commands

### Common Operations
```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f web

# Restart a specific service
docker-compose restart backend
docker-compose restart web

# Check service status
docker-compose ps

# Stop all services
docker-compose down

# Full cleanup and restart
./dev-setup.sh --clean  # or dev-setup.bat --clean
```

### Manual Docker Commands
```bash
# Build specific service
docker-compose build backend
docker-compose build web

# Start specific service
docker-compose up -d backend
docker-compose up -d web

# Access service shell
docker-compose exec backend sh
docker-compose exec web sh

# View service resource usage
docker stats
```

## Configuration Files

### Environment Configuration
- `.env.development` - Template with optimized development settings
- `.env` - Active environment file (created from template)

### Docker Configuration
- `docker-compose.yml` - Base configuration for all environments
- `docker-compose.override.yml` - Development-specific overrides
- `Dockerfile` - Multi-stage builds for both development and production

### Hot-Reload Configuration
- `backend/nodemon.json` - Optimized for Docker file watching
- `clients/web/next.config.js` - Next.js development optimizations

## Troubleshooting

### Hot-Reload Not Working

**Backend Issues:**
1. Check if nodemon is running: `docker-compose logs -f backend`
2. Verify file changes are detected: Look for restart messages
3. Ensure volumes are mounted correctly: Check `docker-compose ps`

**Frontend Issues:**
1. Check Next.js dev server: `docker-compose logs -f web`
2. Verify file watching: Look for compilation messages
3. Check browser cache: Hard refresh (Ctrl+Shift+R)

### Performance Issues

**Slow File Watching:**
1. Increase polling interval in `nodemon.json`
2. Enable legacy watch mode: `CHOKIDAR_USEPOLLING=true`
3. Reduce watched files: Add more ignore patterns

**Slow Builds:**
1. Clear Docker build cache: `docker system prune -a`
2. Remove development volumes: `./dev-setup.sh --clean`
3. Restart Docker service

### Database Connection Issues

**Connection Refused:**
1. Check if PostgreSQL is running: `docker-compose ps postgres`
2. Wait for health check: `docker-compose logs postgres`
3. Verify environment variables in `.env`

**Migration Failures:**
1. Check database logs: `docker-compose logs postgres`
2. Manually run migrations: `docker-compose exec backend npm run migrate`
3. Reset database: `docker-compose exec backend npm run db:reset`

## Best Practices

### File Watching
- Use polling mode for better Docker compatibility
- Avoid editing files inside node_modules
- Keep source files on the host filesystem

### Performance
- Don't mount node_modules - use volumes instead
- Use multi-stage Dockerfiles for size optimization
- Enable build caches with named volumes

### Security
- Use separate development and production configurations
- Don't commit sensitive data to `.env`
- Use non-root users in containers

### Development Workflow
1. Make code changes on your host machine
2. Watch for automatic restarts in Docker logs
3. Test changes at service URLs
4. Use development tools for debugging

## Advanced Configuration

### Custom Environment Variables
Add to `.env`:
```bash
# Custom backend port
BACKEND_PORT=3001

# Enable debug logging
LOG_LEVEL=debug

# Custom database settings
POSTGRES_DB=my_custom_db
```

### Additional Services
Modify `docker-compose.override.yml` to add services:
```yaml
services:
  mailhog:
    image: mailhog/mailhog
    ports:
      - "8025:8025"
```

### Performance Tuning
Adjust resource limits in `docker-compose.override.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs [service]`
3. Verify your configuration matches this guide
4. Consider a clean restart: `./dev-setup.sh --clean`