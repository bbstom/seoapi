@echo off
chcp 65001 >nul
echo ========================================
echo   测试 API 接口
echo ========================================
echo.
echo 正在测试健康检查接口...
echo.

curl http://localhost:8000/health

echo.
echo.
echo ========================================
echo 正在测试改写接口...
echo ========================================
echo.
echo 请确保：
echo 1. 服务已启动（node server.js）
echo 2. 已在 Web 界面配置 Claude API Key
echo 3. 使用正确的 API Key
echo.
echo 按任意键开始测试...
pause >nul
echo.

curl -X POST http://localhost:8000/api/rewrite ^
  -H "Authorization: sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00" ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -d "txt=人工智能技术正在快速发展&mode=seo_fast&sim=1"

echo.
echo.
echo ========================================
echo 测试完成！
echo 请查看运行 node server.js 的窗口
echo 应该能看到详细的请求日志
echo ========================================
echo.
pause
