#!/bin/bash

# Project Nexus DevContainer - Post Start Script
# Minimal version to avoid startup issues

echo "🔄 Starting Project Nexus DevContainer services..."

# The PostgreSQL and Redis features should auto-start services
# Just provide helpful information

echo ""
echo "🚀 DevContainer services should be starting automatically!"
echo ""
echo "💡 To check service status:"
echo "   ./scripts/status.sh"
echo ""
echo "🔗 To start admin tools manually:"
echo "   Adminer: cd /opt/adminer && php -S 0.0.0.0:8080 adminer.php"
echo "   Redis Commander: redis-commander --port 8081"
echo ""
echo "🚀 To start your applications:"
echo "   Backend: cd backend && npm run dev"
echo "   Frontend: cd clients/web && npm run dev"
echo ""