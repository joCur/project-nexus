# Production-ready multi-stage Dockerfile for Project Nexus Web Frontend
# Next.js 14 + TypeScript with Auth0, GraphQL, and Tailwind CSS support

#######################
# Stage 1: Dependencies
#######################
FROM node:22-alpine AS dependencies

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files for dependency caching
COPY package*.json ./

# Install production dependencies only
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && npm cache clean --force

#######################
# Stage 2: Build
#######################
FROM node:22-alpine AS build

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code and configuration files
COPY app/ ./app/
COPY components/ ./components/
COPY hooks/ ./hooks/
COPY lib/ ./lib/
COPY styles/ ./styles/
COPY types/ ./types/
COPY next.config.js ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY tsconfig.json ./

# Copy public directory if it exists
COPY public/ ./public/

# Set build-time environment variables
ARG NODE_ENV=production
ARG NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN npm run build

#######################
# Stage 3: Production
#######################
FROM node:22-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy production dependencies from dependencies stage
COPY --from=dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application from build stage
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/package*.json ./

# Switch to non-root user
USER nextjs

# Expose application port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the Next.js application
CMD ["node", "server.js"]

#######################
# Stage 4: Development
#######################
FROM node:22-alpine AS development

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code and configuration files
COPY . .

# Expose development port
EXPOSE 3000

# Set development environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Start development server with hot reload
CMD ["npm", "run", "dev"]

# Metadata labels
LABEL maintainer="Project Nexus Team"
LABEL version="1.0"
LABEL description="Project Nexus Web Frontend - Next.js 14 + TypeScript + Auth0"
LABEL org.opencontainers.image.source="https://github.com/your-org/project-nexus"