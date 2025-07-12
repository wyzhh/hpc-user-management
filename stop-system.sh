#!/bin/bash

# HPC用户管理系统停止脚本

set -e

echo "🛑 停止HPC用户管理系统..."
echo "================================"

# 检查docker-compose命令
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "❌ 未找到 docker-compose 或 docker compose"
    exit 1
fi

# 停止Node.js进程
echo "🔙 停止后端和前端进程..."

if [ -f "backend.pid" ]; then
    echo "  停止后端进程..."
    kill $(cat backend.pid) 2>/dev/null || echo "  后端进程已停止"
    rm backend.pid
fi

if [ -f "frontend.pid" ]; then
    echo "  停止前端进程..."
    kill $(cat frontend.pid) 2>/dev/null || echo "  前端进程已停止"
    rm frontend.pid
fi

# 也尝试通过进程名停止
pkill -f "ts-node-dev" 2>/dev/null || true
pkill -f "react-scripts" 2>/dev/null || true

echo "📦 停止Docker服务..."
$COMPOSE_CMD down

echo "✅ 系统已停止"