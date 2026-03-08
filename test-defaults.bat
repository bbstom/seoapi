@echo off
chcp 65001 >nul
echo ========================================
echo 测试默认配置功能
echo ========================================
echo.

set API_KEY=sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00

echo 测试 1: 不指定任何参数（使用默认配置）
echo ----------------------------------------
curl -s -X POST http://localhost:8000/api/rewrite ^
  -H "Content-Type: application/json" ^
  -H "Authorization: %API_KEY%" ^
  -d "{\"txt\":\"人工智能发展很快\",\"sim\":1}"
echo.
echo.

echo 测试 2: 只指定模式（使用默认模型）
echo ----------------------------------------
curl -s -X POST http://localhost:8000/api/rewrite ^
  -H "Content-Type: application/json" ^
  -H "Authorization: %API_KEY%" ^
  -d "{\"txt\":\"人工智能发展很快\",\"mode\":\"creative\",\"sim\":1}"
echo.
echo.

echo 测试 3: 只指定模型（使用默认模式）
echo ----------------------------------------
curl -s -X POST http://localhost:8000/api/rewrite ^
  -H "Content-Type: application/json" ^
  -H "Authorization: %API_KEY%" ^
  -d "{\"txt\":\"人工智能发展很快\",\"model\":\"claude-haiku-4-5-20251001\",\"sim\":1}"
echo.
echo.

echo 测试 4: 同时指定模式和模型（覆盖默认配置）
echo ----------------------------------------
curl -s -X POST http://localhost:8000/api/rewrite ^
  -H "Content-Type: application/json" ^
  -H "Authorization: %API_KEY%" ^
  -d "{\"txt\":\"人工智能发展很快\",\"mode\":\"formal\",\"model\":\"claude-haiku-4-5-20251001\",\"sim\":1}"
echo.
echo.

echo ========================================
echo 测试完成
echo ========================================
pause
