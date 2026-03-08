# 检查防火墙和网络配置
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SEO API 网络配置检查" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. 检查服务是否运行
Write-Host "1. 检查服务是否运行..." -ForegroundColor Yellow
$process = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -like "*server.js*" -or 
    (Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object LocalPort -eq 8000)
}

if ($process) {
    Write-Host "✓ Node.js 服务正在运行 (PID: $($process.Id))" -ForegroundColor Green
} else {
    Write-Host "✗ Node.js 服务未运行" -ForegroundColor Red
    Write-Host "  请先启动服务: node server.js" -ForegroundColor Yellow
    exit
}

Write-Host ""

# 2. 检查端口监听
Write-Host "2. 检查端口 8000 监听状态..." -ForegroundColor Yellow
$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue

if ($listening) {
    $localAddress = $listening.LocalAddress
    if ($localAddress -eq "0.0.0.0" -or $localAddress -eq "::") {
        Write-Host "✓ 端口 8000 正在监听所有网络接口 ($localAddress)" -ForegroundColor Green
    } elseif ($localAddress -eq "127.0.0.1" -or $localAddress -eq "::1") {
        Write-Host "⚠ 端口 8000 只监听本地回环 ($localAddress)" -ForegroundColor Yellow
        Write-Host "  这意味着只能本地访问，无法通过内网穿透访问" -ForegroundColor Yellow
    } else {
        Write-Host "✓ 端口 8000 正在监听 $localAddress" -ForegroundColor Green
    }
} else {
    Write-Host "✗ 端口 8000 未监听" -ForegroundColor Red
}

Write-Host ""

# 3. 检查防火墙规则
Write-Host "3. 检查防火墙规则..." -ForegroundColor Yellow
$firewallRule = Get-NetFirewallRule -DisplayName "SEO API Service" -ErrorAction SilentlyContinue

if ($firewallRule) {
    if ($firewallRule.Enabled -eq $true) {
        Write-Host "✓ 防火墙规则已存在且已启用" -ForegroundColor Green
    } else {
        Write-Host "⚠ 防火墙规则已存在但未启用" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ 防火墙规则不存在" -ForegroundColor Red
    Write-Host ""
    Write-Host "  是否要创建防火墙规则？(需要管理员权限)" -ForegroundColor Yellow
    $response = Read-Host "  输入 Y 创建，其他键跳过"
    
    if ($response -eq "Y" -or $response -eq "y") {
        try {
            New-NetFirewallRule -DisplayName "SEO API Service" `
                -Direction Inbound `
                -Protocol TCP `
                -LocalPort 8000 `
                -Action Allow `
                -Profile Any `
                -ErrorAction Stop
            
            Write-Host "✓ 防火墙规则创建成功" -ForegroundColor Green
        } catch {
            Write-Host "✗ 防火墙规则创建失败: $_" -ForegroundColor Red
            Write-Host "  请以管理员身份运行此脚本" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# 4. 获取本机 IP 地址
Write-Host "4. 本机 IP 地址..." -ForegroundColor Yellow
$ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.InterfaceAlias -notlike "*Loopback*" -and 
    $_.IPAddress -ne "127.0.0.1"
}

foreach ($ip in $ipAddresses) {
    Write-Host "  $($ip.InterfaceAlias): $($ip.IPAddress)" -ForegroundColor Gray
}

Write-Host ""

# 5. 测试本地访问
Write-Host "5. 测试本地访问..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ 本地访问成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 本地访问失败: $_" -ForegroundColor Red
}

Write-Host ""

# 6. 测试局域网访问
Write-Host "6. 测试局域网访问..." -ForegroundColor Yellow
$localIP = ($ipAddresses | Select-Object -First 1).IPAddress
if ($localIP) {
    try {
        $response = Invoke-WebRequest -Uri "http://${localIP}:8000/health" -UseBasicParsing -TimeoutSec 5
        Write-Host "✓ 局域网访问成功 (http://${localIP}:8000)" -ForegroundColor Green
    } catch {
        Write-Host "✗ 局域网访问失败" -ForegroundColor Red
        Write-Host "  可能是防火墙阻止了连接" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠ 未找到局域网 IP 地址" -ForegroundColor Yellow
}

Write-Host ""

# 7. 总结
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  检查总结" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($process -and $listening -and ($localAddress -eq "0.0.0.0" -or $localAddress -eq "::")) {
    Write-Host "✓ 服务配置正确，可以接受外部连接" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Yellow
    Write-Host "1. 启动内网穿透工具（ngrok、frp 等）" -ForegroundColor Gray
    Write-Host "2. 获取公网地址" -ForegroundColor Gray
    Write-Host "3. 在小旋风中配置公网地址" -ForegroundColor Gray
    Write-Host "4. 测试连接" -ForegroundColor Gray
} else {
    Write-Host "⚠ 发现配置问题，请检查上述输出" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "常见问题：" -ForegroundColor Yellow
    Write-Host "1. 服务未运行 → 运行 node server.js" -ForegroundColor Gray
    Write-Host "2. 只监听 127.0.0.1 → 检查 server.js 配置" -ForegroundColor Gray
    Write-Host "3. 防火墙阻止 → 创建防火墙规则" -ForegroundColor Gray
}

Write-Host ""
Write-Host "详细文档：内网穿透配置指南.md" -ForegroundColor Cyan
Write-Host ""
