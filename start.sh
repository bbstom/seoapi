#!/bin/bash

echo "========================================"
echo "  SEO API - Node.js 版本"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "[1/3] Node.js 版本:"
node --version
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "[2/3] 安装依赖..."
    npm install
else
    echo "[2/3] 依赖已安装"
fi

# 检查 .env
if [ ! -f ".env" ]; then
    echo ""
    echo "[提示] 复制 .env.example 为 .env"
    cp .env.example .env
fi

echo ""
echo "[3/3] 启动服务..."
echo ""

node server.js
