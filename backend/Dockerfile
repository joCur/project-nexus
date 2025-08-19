# Production-ready multi-stage Dockerfile for Project Nexus Backend
# Node.js 18 + TypeScript with Auth0, GraphQL, PostgreSQL, and Redis support

#######################
# Stage 1: Dependencies
#######################
FROM node:18-alpine AS dependencies

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    && ln -sf python3 /usr/bin/python

# Copy package files for dependency caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build stage)
RUN npm ci --only=production --silent && npm cache clean --force

#######################
# Stage 2: Build
#######################
FROM node:18-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci --silent

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript application
RUN npm run build

#######################
# Stage 3: Production
#######################
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=backend:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=backend:nodejs /app/dist ./dist
COPY --from=build --chown=backend:nodejs /app/package*.json ./

# Copy knex configuration and migration source for production migrations
COPY --from=build --chown=backend:nodejs /app/knexfile.js ./
COPY --from=build --chown=backend:nodejs /app/src/database ./src/database

# Create logs directory
RUN mkdir -p /app/logs && chown backend:nodejs /app/logs

# Switch to non-root user
USER backend

# Expose application port (defaults to 3000, can be overridden by BACKEND_PORT)
EXPOSE ${BACKEND_PORT:-3000}

# Health check endpoint (uses BACKEND_PORT from environment)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health/ready || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application with migrations
CMD ["sh", "-c", "npm run migrate:container && node dist/server.js"]

#######################
# Stage 4: Development
#######################
FROM node:18-alpine AS development

# Set working directory
WORKDIR /app

# Install system dependencies including development tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    curl \
    && ln -sf python3 /usr/bin/python

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN npm ci --silent

# Copy source code and configuration files
COPY src/ ./src/
COPY tsconfig.json ./
COPY nodemon.json ./
COPY knexfile.js ./

# Create logs directory
RUN mkdir -p /app/logs

# Expose development port
EXPOSE ${BACKEND_PORT:-3000}

# Set development environment variables
ENV NODE_ENV=development

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health/ready || exit 1

# Start development server with migrations and hot reload
CMD ["sh", "-c", "npm run migrate:container && npm run dev"]

# Metadata labels
LABEL maintainer="Project Nexus Team"
LABEL version="1.0"
LABEL description="Project Nexus Backend API - Node.js + TypeScript + GraphQL"
LABEL org.opencontainers.image.source="https://github.com/your-org/project-nexus"