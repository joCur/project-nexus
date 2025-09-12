#!/bin/bash

# Project Nexus DevContainer - Post Create Setup Script
# Minimal version to avoid setup issues

set -e

echo "🚀 Starting Project Nexus DevContainer setup..."

# Navigate to workspace root
cd "${PWD}"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
if [ -f "backend/package.json" ]; then
    cd backend
    npm ci || echo "⚠️ Backend npm install failed"
    cd ..
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
if [ -f "clients/web/package.json" ]; then
    cd clients/web
    npm ci || echo "⚠️ Frontend npm install failed"
    cd ../..
fi

# Install basic admin tools
echo "📦 Installing admin tools..."
sudo npm install -g redis-commander || echo "⚠️ Redis Commander install failed"

# Install PHP for Adminer
echo "🛠️ Installing Adminer..."
sudo apt-get update && sudo apt-get install -y php php-pgsql || echo "⚠️ PHP install failed"
sudo mkdir -p /opt/adminer
sudo wget -O /opt/adminer/adminer.php "https://github.com/vrana/adminer/releases/download/v4.8.1/adminer-4.8.1-en.php" || echo "⚠️ Adminer download failed"
CURRENT_USER="${USER:-$(whoami)}"
sudo chown -R "${CURRENT_USER}:${CURRENT_USER}" /opt/adminer || echo "⚠️ Could not change Adminer permissions"

# Create environment file template if it doesn't exist
echo "📝 Setting up environment files..."
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
# Project Nexus Environment Configuration (DevContainer)
NODE_ENV=development
DOCKER_ENV=false

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=nexus_db
POSTGRES_USER=nexus
POSTGRES_PASSWORD=nexus_secure_2024

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
BACKEND_PORT=3000
WEB_PORT=3001

# Auth0 Configuration (Add your actual values)
AUTH0_SECRET=your-auth0-secret-change-in-production
AUTH0_BASE_URL=http://localhost:3001
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
OPENAI_API_KEY=your-openai-api-key
EOF
    echo "📝 Created .env template"
fi

# Create utility scripts
mkdir -p scripts

# Create a simple status script
cat > scripts/status.sh << 'EOF'
#!/bin/bash
echo "=== 📊 Project Nexus Service Status ==="
echo "PostgreSQL: $(pg_isready -h localhost -p 5432 && echo "✅ Running" || echo "❌ Not running")"
echo "Redis: $(redis-cli ping 2>/dev/null && echo "✅ Running" || echo "❌ Not running")"
echo "Adminer (8080): $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null | grep -q "200" && echo "✅ Running" || echo "❌ Not running")"
echo "Redis Commander (8081): $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 2>/dev/null | grep -q "200" && echo "✅ Running" || echo "❌ Not running")"
EOF
chmod +x scripts/status.sh

echo ""
echo "🎉 Basic DevContainer setup completed!"
echo ""
echo "🔗 Next steps:"
echo "   1. Update .env file with your Auth0 credentials"
echo "   2. Start your applications:"
echo "      Backend: cd backend && npm run dev"
echo "      Frontend: cd clients/web && npm run dev"
echo "   3. Access Adminer: php -S 0.0.0.0:8080 -t /opt/adminer"
echo ""