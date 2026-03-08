# PowerShell 测试脚本
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试 API 接口" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 测试健康检查
Write-Host "正在测试健康检查接口..." -ForegroundColor Yellow
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing
    Write-Host "✓ 健康检查成功" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "✗ 健康检查失败" -ForegroundColor Red
    Write-Host "错误: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "请确保服务已启动：node server.js" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "正在测试改写接口..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 替换为你的实际 API Key
$apiKey = "sk_f7747efeefece9fbeb79bfecd825e01ff427c2f343acd398f6f3713469906d00"

$headers = @{
    "Authorization" = $apiKey
    "Content-Type" = "application/x-www-form-urlencoded"
}

$body = "txt=人工智能技术正在快速发展&mode=seo_fast&sim=1"

Write-Host "发送测试请求..." -ForegroundColor Yellow
Write-Host "文本: 人工智能技术正在快速发展" -ForegroundColor Gray
Write-Host "模式: seo_fast" -ForegroundColor Gray
Write-Host "模型: 默认" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/api/rewrite" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -UseBasicParsing
    
    Write-Host "✓ 改写请求成功" -ForegroundColor Green
    Write-Host ""
    Write-Host "响应内容:" -ForegroundColor Cyan
    $json = $response.Content | ConvertFrom-Json
    Write-Host "errcode: $($json.errcode)" -ForegroundColor Gray
    Write-Host "errmsg: $($json.errmsg)" -ForegroundColor Gray
    Write-Host "data: $($json.data.Substring(0, [Math]::Min(100, $json.data.Length)))..." -ForegroundColor Gray
    if ($json.like) {
        Write-Host "like: $($json.like)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ 改写请求失败" -ForegroundColor Red
    Write-Host "错误: $_" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "响应内容:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "请查看运行 node server.js 的窗口" -ForegroundColor Yellow
Write-Host "应该能看到详细的请求日志" -ForegroundColor Yellow
Write-Host ""
