@echo off
chcp 65001 >nul
echo ========================================
echo   SEO API - 开发环境启动
echo ========================================
echo.
echo 正在启动服务...
echo 日志将实时显示在此窗口
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

REM 设置开发环境
set NODE_ENV=development

REM 启动服务
node server.js

pause
