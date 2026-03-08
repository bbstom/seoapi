@echo off
chcp 65001 >nul
echo ========================================
echo   SEO API - 启动并保存日志
echo ========================================
echo.
echo 正在启动服务...
echo 日志将保存到 logs.txt
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

REM 创建日志目录
if not exist logs mkdir logs

REM 设置开发环境
set NODE_ENV=development

REM 生成日期时间戳
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set log_file=logs\seoapi-%datetime:~0,8%-%datetime:~8,6%.log

echo 日志文件: %log_file%
echo.

REM 启动服务并保存日志
node server.js > %log_file% 2>&1

pause
