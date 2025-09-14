#!/bin/bash
echo "=== 📊 Project Nexus Service Status ==="
echo "PostgreSQL: $(pg_isready -h localhost -p 5432 && echo "✅ Running" || echo "❌ Not running")"
echo "Redis: $(redis-cli ping 2>/dev/null && echo "✅ Running" || echo "❌ Not running")"
echo "Adminer (8080): $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 2>/dev/null | grep -q "200" && echo "✅ Running" || echo "❌ Not running")"
echo "Redis Commander (8081): $(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 2>/dev/null | grep -q "200" && echo "✅ Running" || echo "❌ Not running")"
