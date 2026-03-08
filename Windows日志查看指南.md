# Windows 日志查看指南

## 🪟 Windows 开发环境

在 Windows 上运行 Node.js 服务时，日志会直接输出到控制台（PowerShell 或 CMD）。

## 🔍 查看日志的方法

### 方法 1：直接在控制台查看（推荐）

**启动服务时：**

```powershell
# PowerShell
cd seoapi-nodejs
node server.js
```

或

```cmd
# CMD
cd seoapi-nodejs
node server.js
```

**日志会实时显示在控制台：**

```
========================================
  SEO API - Claude AI 文本改写服务
========================================

服务地址: http://localhost:8000
API 文档: http://localhost:8000/api/docs
Web 界面: http://localhost:8000

按 Ctrl+C 停止服务
========================================

Trust proxy: loopback (开发环境)

========================================
[请求 a1b2c3d4e5f6g7h8] 收到改写请求
[请求 a1b2c3d4e5f6g7h8] 用户: admin
[请求 a1b2c3d4e5f6g7h8] 客户端 IP: ::1
...
```

**优点：**
- ✅ 实时查看
- ✅ 彩色输出（如果终端支持）
- ✅ 可以直接看到所有日志

**缺点：**
- ❌ 关闭窗口服务就停止
- ❌ 无法保存历史日志

### 方法 2：重定向到文件

**保存日志到文件：**

```powershell
# PowerShell
node server.js > logs.txt 2>&1
```

或

```cmd
# CMD
node server.js > logs.txt 2>&1
```

**查看日志文件：**

```powershell
# 查看完整日志
Get-Content logs.txt

# 查看最后 50 行
Get-Content logs.txt -Tail 50

# 实时查看（类似 tail -f）
Get-Content logs.txt -Wait -Tail 50
```

**优点：**
- ✅ 保存历史日志
- ✅ 可以搜索和分析

**缺点：**
- ❌ 不能同时在控制台看到
- ❌ 文件可能很大

### 方法 3：使用 PM2（推荐生产环境）

**安装 PM2：**

```powershell
npm install -g pm2
```

**启动服务：**

```powershell
cd seoapi-nodejs
pm2 start server.js --name seoapi
```

**查看日志：**

```powershell
# 查看实时日志
pm2 logs seoapi

# 查看最近 100 行
pm2 logs seoapi --lines 100

# 只看错误日志
pm2 logs seoapi --err

# 清空日志
pm2 flush seoapi
```

**其他 PM2 命令：**

```powershell
# 查看状态
pm2 status

# 重启服务
pm2 restart seoapi

# 停止服务
pm2 stop seoapi

# 删除服务
pm2 delete seoapi
```

**优点：**
- ✅ 后台运行
- ✅ 自动重启
- ✅ 日志管理
- ✅ 多进程支持

### 方法 4：使用 Windows Terminal（推荐）

**安装 Windows Terminal：**

从 Microsoft Store 安装 Windows Terminal

**优点：**
- ✅ 多标签页
- ✅ 更好的显示效果
- ✅ 支持彩色输出
- ✅ 可以分屏查看

**使用方法：**

1. 打开 Windows Terminal
2. 新建 PowerShell 标签页
3. 运行 `node server.js`
4. 日志会实时显示

## 📊 日志搜索和过滤

### PowerShell 搜索

**搜索包含特定文本的日志：**

```powershell
# 搜索错误
Get-Content logs.txt | Select-String "❌"

# 搜索特定请求 ID
Get-Content logs.txt | Select-String "请求 a1b2c3d4"

# 搜索特定用户
Get-Content logs.txt | Select-String "\[admin\]"

# 统计成功的请求
(Get-Content logs.txt | Select-String "✅ 响应已发送").Count

# 统计失败的请求
(Get-Content logs.txt | Select-String "❌ 错误响应已发送").Count
```

### 使用 findstr（CMD）

```cmd
# 搜索错误
type logs.txt | findstr "错误"

# 搜索特定请求
type logs.txt | findstr "请求 a1b2c3d4"
```

## 🎯 实时监控日志

### 方法 1：PowerShell 实时监控

```powershell
# 启动服务并实时查看
node server.js

# 或者在另一个窗口实时查看日志文件
Get-Content logs.txt -Wait -Tail 50
```

### 方法 2：使用 PM2

```powershell
pm2 logs seoapi --lines 50
```

### 方法 3：使用 Windows Terminal 分屏

1. 打开 Windows Terminal
2. 按 `Alt + Shift + D` 分屏
3. 左边运行服务：`node server.js`
4. 右边查看日志或测试 API

## 📝 日志文件管理

### 按日期保存日志

**PowerShell 脚本：**

```powershell
# 创建日志目录
New-Item -ItemType Directory -Force -Path logs

# 启动服务并保存日志（带日期）
$date = Get-Date -Format "yyyy-MM-dd"
node server.js > "logs\seoapi-$date.log" 2>&1
```

### 自动清理旧日志

**PowerShell 脚本：**

```powershell
# 删除 7 天前的日志
Get-ChildItem logs\*.log | Where-Object {
    $_.LastWriteTime -lt (Get-Date).AddDays(-7)
} | Remove-Item
```

## 🔍 排查小旋风问题

### 步骤 1：启动服务

```powershell
cd seoapi-nodejs
node server.js
```

### 步骤 2：在小旋风中测试

点击"测试"按钮

### 步骤 3：查看控制台日志

在 PowerShell 窗口中查看实时输出：

```
========================================
[请求 a1b2c3d4e5f6g7h8] 收到改写请求
[请求 a1b2c3d4e5f6g7h8] 用户: admin
[请求 a1b2c3d4e5f6g7h8] 客户端 IP: ::1
[请求 a1b2c3d4e5f6g7h8] User-Agent: XiaoXuanFeng/1.0
[请求 a1b2c3d4e5f6g7h8] 请求体参数: {"text_length":500,"mode":"seo_fast",...}
[请求 a1b2c3d4e5f6g7h8] 解析后参数: 文本长度=500, 模式=seo_fast, 模型=claude-sonnet-4-5-20250929
[请求 a1b2c3d4e5f6g7h8] ✓ 参数验证通过
[请求 a1b2c3d4e5f6g7h8] 🚀 开始调用 Claude API...
[请求 a1b2c3d4e5f6g7h8] ✓ Claude API 调用成功，耗时: 3.25秒
[请求 a1b2c3d4e5f6g7h8] ✅ 响应已发送
========================================
```

### 步骤 4：分析日志

重点查看：
- **请求参数** - text_length 是否大于 0
- **错误标识** - 是否有 ❌ 标记
- **错误位置** - 在哪个环节失败

### 步骤 5：复制日志

1. 在 PowerShell 中选中日志文本
2. 右键复制
3. 粘贴到文本编辑器分析

## 💡 Windows 特有技巧

### 技巧 1：使用 PowerShell ISE

```powershell
# 打开 PowerShell ISE
powershell_ise.exe

# 在脚本窗格中运行
cd seoapi-nodejs
node server.js
```

**优点：**
- 可以编辑和运行脚本
- 更好的文本选择和复制

### 技巧 2：使用 VS Code 终端

1. 在 VS Code 中打开项目
2. 按 `` Ctrl + ` `` 打开终端
3. 运行 `node server.js`
4. 日志会在 VS Code 终端中显示

**优点：**
- 集成开发环境
- 可以同时编辑代码和查看日志
- 支持搜索和过滤

### 技巧 3：使用 ConEmu 或 Cmder

这些是增强的终端工具，提供更好的体验：

- **ConEmu**: https://conemu.github.io/
- **Cmder**: https://cmder.net/

**优点：**
- 更好的显示效果
- 支持多标签页
- 更强大的搜索功能

### 技巧 4：创建启动脚本

**创建 `start-with-logs.bat`：**

```batch
@echo off
echo 启动 SEO API 服务...
echo 日志将保存到 logs.txt
echo 按 Ctrl+C 停止服务
echo.

node server.js > logs.txt 2>&1
```

**双击运行即可启动服务并保存日志**

### 技巧 5：创建日志查看脚本

**创建 `view-logs.ps1`：**

```powershell
# 实时查看日志
Get-Content logs.txt -Wait -Tail 50
```

**运行：**
```powershell
.\view-logs.ps1
```

## 🎯 推荐配置

### 开发环境推荐配置

**方案 1：简单直接**
```powershell
# 直接在 PowerShell 中运行
node server.js
```

**方案 2：保存日志**
```powershell
# 保存日志到文件
node server.js > logs.txt 2>&1

# 在另一个窗口实时查看
Get-Content logs.txt -Wait -Tail 50
```

**方案 3：使用 VS Code**
1. 在 VS Code 中打开项目
2. 按 `` Ctrl + ` `` 打开终端
3. 运行 `node server.js`

**方案 4：使用 PM2（推荐）**
```powershell
pm2 start server.js --name seoapi
pm2 logs seoapi
```

## 📋 常用命令速查

### PowerShell

```powershell
# 启动服务
node server.js

# 启动并保存日志
node server.js > logs.txt 2>&1

# 查看日志
Get-Content logs.txt

# 实时查看日志
Get-Content logs.txt -Wait -Tail 50

# 搜索日志
Get-Content logs.txt | Select-String "错误"

# 统计日志
(Get-Content logs.txt | Select-String "成功").Count
```

### PM2

```powershell
# 启动
pm2 start server.js --name seoapi

# 查看日志
pm2 logs seoapi

# 查看状态
pm2 status

# 重启
pm2 restart seoapi

# 停止
pm2 stop seoapi
```

## 🎉 总结

**Windows 开发环境推荐方案：**

1. **最简单** - 直接在 PowerShell 中运行 `node server.js`
2. **最方便** - 使用 VS Code 终端
3. **最专业** - 使用 PM2 管理

**查看日志：**
- 开发时：直接看控制台输出
- 排查问题：保存到文件后搜索分析
- 生产环境：使用 PM2

现在你可以在 Windows 上轻松查看和分析日志了！🚀
