# DevContainer Dockerfile - All-in-one development environment
# Includes PostgreSQL, Redis, Adminer, Redis Commander, and development tools
FROM node:22-bookworm

# Install system dependencies and database servers
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Development tools
    git \
    curl \
    wget \
    vim \
    sudo \
    # PostgreSQL server and client
    postgresql \
    postgresql-contrib \
    postgresql-client \
    # Redis server and tools
    redis-server \
    redis-tools \
    # Build tools
    build-essential \
    python3 \
    # Process management
    supervisor \
    # PHP for Adminer
    php \
    php-cli \
    php-pgsql \
    php-redis \
    # Clean up
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt update \
    && apt install gh -y --no-install-recommends

# Install global Node.js packages
RUN npm install -g \
    typescript \
    nodemon \
    ts-node \
    @types/node

# Install Redis Commander globally
RUN npm install -g redis-commander

# Download and set up Adminer
RUN mkdir -p /var/www/html \
    && curl -L https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1.php -o /var/www/html/adminer.php \
    && chmod 644 /var/www/html/adminer.php

# Copy custom Adminer auto-login script
COPY adminer-auto.php /var/www/html/index.php

# Create non-root user for development
RUN useradd -m -s /bin/bash vscode \
    && usermod -aG sudo vscode \
    && echo 'vscode ALL=(root) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /bin/systemctl, /usr/bin/npm, /usr/bin/supervisord, /usr/bin/supervisorctl' >> /etc/sudoers

# Set up PostgreSQL data directory and configuration
RUN mkdir -p /var/lib/postgresql/data \
    && chown -R postgres:postgres /var/lib/postgresql/data \
    && chmod 700 /var/lib/postgresql/data \
    && sudo -u postgres /usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data

# Configure PostgreSQL
RUN echo "host all all 0.0.0.0/0 scram-sha-256" >> /etc/postgresql/15/main/pg_hba.conf \
    && echo "listen_addresses = '*'" >> /etc/postgresql/15/main/postgresql.conf \
    && echo "port = 5432" >> /etc/postgresql/15/main/postgresql.conf \
    && echo "max_connections = 200" >> /etc/postgresql/15/main/postgresql.conf \
    && echo "shared_buffers = 256MB" >> /etc/postgresql/15/main/postgresql.conf

# Set up workspace directory
RUN mkdir -p /workspaces/project-nexus && chown vscode:vscode /workspaces/project-nexus

# Create supervisor configuration directory and copy config
RUN mkdir -p /etc/supervisor/conf.d \
    && mkdir -p /var/log/supervisor

# Copy supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create redis user for redis service (if not exists)
RUN id -u redis &>/dev/null || useradd -r -s /bin/false redis

# Create www-data user for Adminer (if not exists)
RUN id -u www-data &>/dev/null || useradd -r -s /bin/false www-data

# Health check to ensure container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node --version && npm --version && pg_isready -U postgres && redis-cli ping || exit 1

# Switch to development user
USER vscode

# Set working directory
WORKDIR /workspaces/project-nexus

# Default command
CMD ["sleep", "infinity"]