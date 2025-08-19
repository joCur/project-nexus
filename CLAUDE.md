# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Project Nexus is an AI-powered visual knowledge workspace that transforms scattered thoughts into an interconnected knowledge graph. The system combines infinite canvas visualization, intelligent content analysis, and cross-platform synchronization.

## Architecture

**Monorepo Structure:**
- `backend/` - Node.js GraphQL API with Auth0 authentication
- `clients/web/` - Next.js 14 web application
- `clients/app/` - Flutter mobile app (future implementation)
- `database/` - PostgreSQL with pgvector extension setup
- `redis/` - Redis cache configuration

**Key Technologies:**
- Backend: Node.js, GraphQL (Apollo Server), PostgreSQL + pgvector, Redis, Auth0
- Frontend: Next.js 14, TypeScript, Tailwind CSS, Konva.js (canvas), Zustand (state)
- Infrastructure: Docker Compose for local development

## Development Commands

### Backend (`cd backend`)
```bash
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript to dist/
npm run start            # Start production server
npm test                 # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix

# Database commands
npm run migrate          # Run database migrations
npm run migrate:rollback # Rollback last migration
npm run migrate:status   # Check migration status
npm run seed             # Run database seeds
npm run db:reset         # Reset database (rollback all, migrate, seed)
```

### Frontend (`cd clients/web`)
```bash
npm run dev              # Start Next.js development server
npm run build            # Build for production
npm run start            # Start production server
npm test                 # Run Jest tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage
npm run lint             # Next.js ESLint check
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript type checking
```

### Docker Environment (Root Directory)
```bash
# Never start docker-compose yourself - always ask the user
# These are reference commands:
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs      # View logs
```

## Testing

**Backend Testing:**
- Uses Jest with ts-jest preset
- Test files: `src/__tests__/**/*.test.ts`
- Comprehensive test suite includes unit, integration, and security tests
- Coverage target: 90%+ for core services
- Mock Auth0 for development testing

**Frontend Testing:**
- Uses Jest with Next.js configuration
- Test files: `**/__tests__/**/*.test.{ts,tsx}`
- React Testing Library for component tests
- Includes tests for hooks, components, and API integration

## Key Architectural Patterns

**Authentication Flow:**
- Auth0 integration with Universal Login
- Development mode authentication for testing
- JWT token validation via Auth0 JWKS

**State Management:**
- Backend: GraphQL resolvers with service layer pattern
- Frontend: Zustand for client state, React Query for server state
- Database: Knex.js query builder with PostgreSQL

**Testing Strategy:**
- Server-side state management (no localStorage dependency)
- Enum case conversion handling (frontend uppercase, backend lowercase)
- Cross-platform consistency validation

## Current Implementation Status

**Completed:**
- Authentication flow with Auth0 integration
- Basic onboarding system with backend API integration
- Database schema with user profiles, workspaces, and onboarding tracking
- Comprehensive test suite for onboarding features

**Current Task:**
- Implementing the basic onboarding flow described in `design-documentation/features/onboarding/v1-simple-onboarding.md`

## Important Development Guidelines

- **Docker**: Never start docker-compose yourself - always ask the user to do it
- **Environment**: .env files are at root level, set through docker-compose
- **Testing**: Always write tests before implementing a new feature; when updating existing code always run the tests to check if anything broke.
- **Linear Integration**: When using Linear MCP to move tasks to backlog, remove them from markdown feature documentation files
- **Code Style**: Follow existing patterns, use TypeScript strictly, maintain test coverage

## File Structure Highlights

```
backend/src/
├── services/           # Business logic layer
├── resolvers/          # GraphQL resolvers
├── middleware/         # Express middleware
├── database/           # Migrations and seeds
├── __tests__/          # Test suites
└── types/              # TypeScript type definitions

clients/web/
├── app/                # Next.js app directory
├── components/         # React components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── __tests__/          # Frontend tests
```

## Documentation References

- [Elevator Pitch](./README.md)
- [Design Guidelines](./design-documentation/)
- [Product Manager Documentation](./project-documentation/product-manager-output.md)
- [Technical Architecture](./project-documentation/technical-architecture.md)
- [Testing Guide](./TESTING.md)
- Always update the state and other required properties, while working on a ticket from Linear.