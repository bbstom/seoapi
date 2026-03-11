#!/bin/bash

echo "========================================="
echo "开始部署 React 前端"
echo "========================================="

# 进入前端目录
cd frontend

# 检查 node_modules 是否存在
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

# 构建前端
echo "🔨 构建前端..."
npm run build

# 返回根目录
cd ..

# 重启服务
echo "🔄 重启服务..."
pm2 restart seoapi

echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
