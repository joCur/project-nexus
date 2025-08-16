# Project Nexus Backend

A secure, scalable Node.js backend API with Auth0 authentication, GraphQL, PostgreSQL, and Redis caching.

## Features

- **Auth0 Integration**: JWT validation, user synchronization, and session management
- **GraphQL API**: Type-safe queries and mutations with Apollo Server
- **PostgreSQL Database**: With pgvector extension for AI embeddings
- **Redis Caching**: Session storage and performance optimization
- **Security**: Rate limiting, CORS, helmet, and comprehensive logging
- **Health Monitoring**: Detailed health checks for all services
- **TypeScript**: Full type safety and development experience

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ with pgvector extension
- Redis 7+
- Auth0 tenant configured

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   # The backend uses the .env file from the project root
   # Navigate to the project root and configure the environment
   cd ..
   # Edit the .env file with your Auth0 and database configuration
   # See AUTH0_SETUP.md for detailed Auth0 configuration instructions
   ```

3. **Run database migrations:**
   ```bash
   npm run migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

The server will be available at:
- API: http://localhost:3000
- GraphQL Playground: http://localhost:3000/graphql
- Health Check: http://localhost:3000/health

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | No | development |
| `PORT` | Server port | No | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | Yes | - |
| `REDIS_URL` | Redis connection string | Yes | - |
| `AUTH0_DOMAIN` | Auth0 tenant domain | Yes | - |
| `AUTH0_CLIENT_ID` | Auth0 application client ID | Yes | - |
| `AUTH0_CLIENT_SECRET` | Auth0 application client secret | Yes | - |
| `AUTH0_AUDIENCE` | Auth0 API audience | No | https://api.nexus.app |
| `JWT_SECRET` | JWT signing secret (32+ chars) | Yes | - |
| `CORS_ORIGIN` | Allowed CORS origins | No | localhost:3000,3001 |

See `.env.example` for complete configuration options.

### Auth0 Setup

1. Create an Auth0 application (Single Page Application)
2. Configure allowed callback URLs
3. Create an Auth0 API with identifier matching `AUTH0_AUDIENCE`
4. Set up Auth0 Rules/Actions for custom claims:
   ```javascript
   // Add to Auth0 Action
   exports.onExecutePostLogin = async (event, api) => {
     const namespace = 'https://nexus.app/';
     api.idToken.setCustomClaim(`${namespace}roles`, event.user.app_metadata?.roles || []);
     api.idToken.setCustomClaim(`${namespace}permissions`, event.user.app_metadata?.permissions || []);
   };
   ```

## API Documentation

### GraphQL Schema

The API uses GraphQL with the following main types:

- **User**: User account with Auth0 integration
- **AuthPayload**: Authentication response with session
- **Session**: User session management
- **HealthCheck**: Service health monitoring

### Key Endpoints

- `POST /graphql` - GraphQL API
- `GET /health` - Comprehensive health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe
- `GET /version` - API version

### Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Example GraphQL authentication:

```graphql
mutation SyncUser($token: String!) {
  syncUserFromAuth0(auth0Token: $token) {
    user {
      id
      email
      displayName
    }
    sessionId
    expiresAt
    permissions
  }
}
```

## Development

### Project Structure

```
src/
├── config/          # Environment configuration
├── database/        # Database connection and utilities
├── graphql/         # GraphQL type definitions
├── middleware/      # Express middleware
├── resolvers/       # GraphQL resolvers
├── routes/          # Express routes
├── services/        # Business logic services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── server.ts        # Main server file
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run migrate` - Run database migrations
- `npm run db:reset` - Reset database (dev only)

### Database Migrations

Create a new migration:
```bash
npx knex migrate:make migration_name
```

Run migrations:
```bash
npm run migrate
```

Rollback migrations:
```bash
npm run migrate:rollback
```

### Testing

Run tests with coverage:
```bash
npm run test:coverage
```

Watch mode for development:
```bash
npm run test:watch
```

## Security Features

### Authentication & Authorization

- Auth0 JWT validation with JWKS
- Role-based access control (RBAC)
- Permission-based authorization
- Session management with Redis

### Security Middleware

- CORS protection with configurable origins
- Rate limiting (configurable per endpoint type)
- Helmet for security headers
- Request size validation
- IP-based monitoring

### Logging & Monitoring

- Structured JSON logging with Winston
- Security event logging
- Performance monitoring
- GraphQL operation logging
- Health check endpoints

## Production Deployment

### Docker

The backend includes a multi-stage Dockerfile:

```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Environment Considerations

1. **Database**: Ensure PostgreSQL has pgvector extension
2. **Redis**: Configure persistence and memory limits
3. **Auth0**: Use production tenant with proper security
4. **Secrets**: Use secure secret management
5. **Logging**: Configure log aggregation
6. **Monitoring**: Set up health check monitoring

### Performance Optimization

- Connection pooling for PostgreSQL
- Redis caching for sessions and permissions
- Query optimization with indexes
- Rate limiting to prevent abuse
- Compression middleware

## Health Monitoring

### Health Check Endpoints

- `/health` - Complete service status
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe
- `/health/database` - Database connectivity
- `/health/redis` - Redis connectivity
- `/health/auth0` - Auth0 connectivity

### Monitoring Metrics

The health checks provide:
- Response times for each service
- Connection pool status
- Cache hit rates
- Error rates and types
- System resource usage (development)

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection string
   - Ensure pgvector extension is installed

2. **Auth0 Token Validation Failed**
   - Verify Auth0 configuration
   - Check token expiration
   - Ensure JWKS endpoint is accessible

3. **Redis Connection Issues**
   - Check Redis server status
   - Verify connection string
   - Check Redis password/auth

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Check Debugging

Check individual service health:
```bash
curl http://localhost:3000/health/database
curl http://localhost:3000/health/redis
curl http://localhost:3000/health/auth0
```

## Contributing

1. Follow TypeScript strict mode guidelines
2. Add tests for new features
3. Update documentation
4. Ensure security best practices
5. Run linting and tests before committing

## License

MIT License - see LICENSE file for details.