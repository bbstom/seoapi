@echo off
echo =========================================
echo 开始部署 React 前端
echo =========================================

cd frontend

if not exist "node_modules" (
    echo 📦 安装依赖...
    call npm install
)

echo 🔨 构建前端...
call npm run build

cd ..

echo 🔄 重启服务...
pm2 restart seoapi

echo =========================================
echo ✅ 部署完成！
echo =========================================
pause
