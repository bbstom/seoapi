@echo off
chcp 65001 >nul
echo ========================================
echo   SEO API - Node.js 版本
echo ========================================
echo.

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Node.js
    echo 请从 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

echo [1/3] Node.js 版本:
node --version
echo.

REM 检查依赖
if not exist "node_modules" (
    echo [2/3] 安装依赖...
    call npm install
) else (
    echo [2/3] 依赖已安装
)

REM 检查 .env
if not exist ".env" (
    echo.
    echo [提示] 复制 .env.example 为 .env
    copy .env.example .env >nul
)

echo.
echo [3/3] 启动服务...
echo.

node server.js

pause
