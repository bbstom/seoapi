@echo off
echo 修复 Tailwind CSS 配置问题...
echo.

echo 1. 删除 node_modules 和 package-lock.json
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo.
echo 2. 清除 npm 缓存
call npm cache clean --force

echo.
echo 3. 重新安装依赖
call npm install

echo.
echo 4. 清除 Vite 缓存
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo.
echo ✅ 修复完成！
echo.
echo 现在运行: npm run dev
pause
