# DevContainer Dockerfile - Simple Node.js 22 environment
FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Development tools
    git \
    curl \
    wget \
    vim \
    sudo \
    # Database clients
    postgresql-client \
    redis-tools \
    # Build tools
    build-essential \
    python3 \
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

# Create non-root user for development
RUN useradd -m -s /bin/bash vscode \
    && usermod -aG sudo vscode \
    && echo 'vscode ALL=(root) NOPASSWD: /usr/bin/apt, /usr/bin/apt-get, /bin/systemctl, /usr/bin/npm' >> /etc/sudoers

# Set up workspace directory
RUN mkdir -p /workspaces/project-nexus && chown vscode:vscode /workspaces/project-nexus

# Switch to development user
USER vscode

# Set working directory
WORKDIR /workspaces/project-nexus

# Health check to ensure container is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node --version && npm --version || exit 1

# Default command
CMD ["sleep", "infinity"]