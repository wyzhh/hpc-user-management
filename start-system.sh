#!/bin/bash

# HPC用户管理系统启动脚本
# 该脚本会执行系统初始化检查，然后启动服务

set -e  # 遇到错误立即退出

echo "🚀 HPC用户管理系统启动脚本"
echo "================================"

# 检查当前目录
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 函数：显示帮助信息
show_help() {
    echo "使用方法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --skip-init     跳过系统初始化检查"
    echo "  --docker-only   仅启动Docker服务"
    echo "  --dev           开发模式启动"
    echo "  --help          显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0                    # 完整启动流程"
    echo "  $0 --skip-init        # 跳过初始化直接启动"
    echo "  $0 --docker-only      # 仅启动Docker服务"
    echo "  $0 --dev              # 开发模式"
}

# 解析命令行参数
SKIP_INIT=false
DOCKER_ONLY=false
DEV_MODE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-init)
            SKIP_INIT=true
            shift
            ;;
        --docker-only)
            DOCKER_ONLY=true
            shift
            ;;
        --dev)
            DEV_MODE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo "❌ 未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 函数：检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ 缺少依赖: $1"
        echo "请安装 $1 后重试"
        exit 1
    fi
}

# 函数：等待服务启动
wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ 等待 $service_name 启动 (端口 $port)..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z localhost $port 2>/dev/null; then
            echo "✅ $service_name 已启动"
            return 0
        fi
        
        echo "   尝试 $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ $service_name 启动超时"
    return 1
}

# 函数：启动Docker服务
start_docker_services() {
    echo "📦 启动Docker服务..."
    
    # 检查Docker和docker-compose
    check_command docker
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        echo "❌ 未找到 docker-compose 或 docker compose"
        exit 1
    fi
    
    # 启动数据库和LDAP
    echo "🗄️  启动数据库和LDAP服务..."
    $COMPOSE_CMD up -d db ldap
    
    # 等待服务启动
    wait_for_service "PostgreSQL" 5433
    wait_for_service "LDAP" 389
    
    echo "✅ Docker服务启动完成"
}

# 函数：运行系统初始化
run_initialization() {
    echo "🔧 运行系统初始化检查..."
    
    cd backend
    
    # 检查Node.js和npm
    check_command node
    check_command npm
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装后端依赖..."
        npm install
    fi
    
    # 运行初始化脚本
    echo "🚀 执行系统初始化..."
    node scripts/init-system.js
    
    if [ $? -ne 0 ]; then
        echo "❌ 系统初始化失败，请检查错误信息"
        exit 1
    fi
    
    cd ..
    echo "✅ 系统初始化完成"
}

# 函数：启动后端服务
start_backend() {
    echo "🔙 启动后端服务..."
    
    cd backend
    
    if [ "$DEV_MODE" = true ]; then
        echo "🔧 开发模式启动后端..."
        npm run dev &
        BACKEND_PID=$!
        echo $BACKEND_PID > ../backend.pid
    else
        echo "🏗️  构建后端..."
        npm run build
        echo "🚀 启动后端..."
        npm start &
        BACKEND_PID=$!
        echo $BACKEND_PID > ../backend.pid
    fi
    
    cd ..
    
    # 等待后端启动
    wait_for_service "后端API" 8000
}

# 函数：启动前端服务
start_frontend() {
    echo "🎨 启动前端服务..."
    
    cd frontend
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        echo "📦 安装前端依赖..."
        npm install
    fi
    
    if [ "$DEV_MODE" = true ]; then
        echo "🔧 开发模式启动前端..."
        npm start &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > ../frontend.pid
    else
        echo "🏗️  构建前端..."
        npm run build
        # 这里可以添加nginx或其他静态服务器来serve构建后的文件
        echo "📝 前端已构建完成，请配置Web服务器serve build目录"
    fi
    
    cd ..
    
    if [ "$DEV_MODE" = true ]; then
        # 等待前端启动
        wait_for_service "前端Web" 3000
    fi
}

# 函数：显示系统信息
show_system_info() {
    echo ""
    echo "🎉 HPC用户管理系统启动完成！"
    echo "================================"
    echo ""
    echo "📋 服务信息:"
    echo "  - 数据库 (PostgreSQL): localhost:5433"
    echo "  - LDAP服务: localhost:389"
    echo "  - LDAP管理界面: http://localhost:8080"
    echo "  - 后端API: http://localhost:8000"
    echo "  - 后端健康检查: http://localhost:8000/health"
    
    if [ "$DEV_MODE" = true ]; then
        echo "  - 前端Web界面: http://localhost:3000"
    fi
    
    echo ""
    echo "👤 测试账号:"
    echo "  PI用户: pi001 / changeme123"
    echo "  PI用户: pi002 / changeme123"
    echo "  管理员: admin / admin123"
    
    # 显示LDAP管理员
    if [ ! -z "${LDAP_ADMIN_USERS}" ]; then
        echo "  LDAP管理员: ${LDAP_ADMIN_USERS}"
    fi
    
    echo ""
    echo "📚 管理命令:"
    echo "  - 停止服务: ./stop-system.sh"
    echo "  - 查看日志: docker compose logs -f"
    echo "  - 检查状态: docker compose ps"
    echo ""
}

# 函数：清理函数
cleanup() {
    echo ""
    echo "🛑 收到停止信号，正在清理..."
    
    if [ -f "backend.pid" ]; then
        kill $(cat backend.pid) 2>/dev/null || true
        rm backend.pid
    fi
    
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null || true
        rm frontend.pid
    fi
    
    echo "✅ 清理完成"
    exit 0
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 主执行流程
main() {
    echo "🔍 检查环境..."
    
    # 检查.env文件
    if [ ! -f "backend/.env" ]; then
        echo "⚠️  未找到配置文件 backend/.env"
        if [ -f "backend/.env.example" ]; then
            echo "📝 复制示例配置文件..."
            cp backend/.env.example backend/.env
            echo "⚠️  请编辑 backend/.env 文件配置您的环境"
            echo "   特别是LDAP服务器地址和认证信息"
        else
            echo "❌ 未找到示例配置文件"
            exit 1
        fi
    fi
    
    # 启动Docker服务
    start_docker_services
    
    if [ "$DOCKER_ONLY" = true ]; then
        echo "✅ 仅启动Docker服务完成"
        return 0
    fi
    
    # 运行初始化（除非跳过）
    if [ "$SKIP_INIT" = false ]; then
        run_initialization
    else
        echo "⏭️  跳过系统初始化"
    fi
    
    # 启动应用服务
    start_backend
    start_frontend
    
    # 显示系统信息
    show_system_info
    
    if [ "$DEV_MODE" = true ]; then
        echo "🔄 开发模式运行中，按 Ctrl+C 停止服务"
        # 保持脚本运行
        wait
    fi
}

# 执行主函数
main "$@"