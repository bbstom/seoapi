@echo off
REM 数据库备份脚本 (Windows)
REM 用于定期备份 MySQL 数据库
REM 
REM 使用方法：
REM 1. 修改下面的配置信息
REM 2. 双击运行或添加到任务计划程序

REM ========================================
REM 配置信息（请修改为实际值）
REM ========================================
set DB_NAME=seoapi
set DB_USER=seoapi_user
set DB_PASS=your_password_here
set BACKUP_DIR=C:\backups\seoapi
set MYSQL_BIN=C:\Program Files\MySQL\MySQL Server 8.0\bin

REM 生成时间戳
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set DATE=%datetime:~0,8%_%datetime:~8,6%

REM ========================================
REM 备份逻辑
REM ========================================

REM 创建备份目录
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo 开始备份数据库: %DB_NAME%

REM 备份数据库
"%MYSQL_BIN%\mysqldump.exe" -u %DB_USER% -p%DB_PASS% %DB_NAME% > "%BACKUP_DIR%\seoapi_%DATE%.sql"

if %errorlevel% equ 0 (
    echo [成功] 备份完成: seoapi_%DATE%.sql
    
    REM 删除30天前的备份
    forfiles /p "%BACKUP_DIR%" /m seoapi_*.sql /d -30 /c "cmd /c del @path" 2>nul
    echo [成功] 已清理30天前的旧备份
) else (
    echo [失败] 备份失败！
    pause
    exit /b 1
)

REM 显示当前所有备份
echo.
echo 当前所有备份文件：
dir /b "%BACKUP_DIR%\seoapi_*.sql"

echo.
echo 备份完成！
pause
