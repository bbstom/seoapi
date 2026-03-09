# OpenAI 兼容接口修复说明

## 问题描述

使用 OpenAI 兼容接口（如 fucaixie.xyz）时，Web 界面显示的统计信息不正确：
- 耗时显示为 `-s`
- 相似度显示正常
- 输入 Tokens 显示为 `-`
- 输出 Tokens 显示为 `-`

## 问题原因

OpenAI 兼容接口返回的 token 使用情况字段名称与 Anthropic 不同：

### Anthropic 格式
```json
{
  "usage": {
    "input_tokens": 100,
    "output_tokens": 150
  }
}
```

### OpenAI 格式
```json
{
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 150
  }
}
```

## 解决方案

### 1. 改进响应转换代码

在 `callOpenAICompatible` 函数中，添加了对两种字段名称的支持：

```javascript
usage: {
    input_tokens: response.usage?.prompt_tokens || response.usage?.input_tokens || 0,
    output_tokens: response.usage?.completion_tokens || response.usage?.output_tokens || 0
}
```

这样可以兼容：
- OpenAI 标准格式：`prompt_tokens` / `completion_tokens`
- Anthropic 格式：`input_tokens` / `output_tokens`
- 缺失数据：返回 0

### 2. 改进日志输出

添加了更详细的日志，帮助调试：

```javascript
// 打印 token 使用情况（兼容两种格式）
if (message.usage) {
    console.log(`[请求 ${requestId}] Token 使用: 输入=${message.usage.input_tokens || 0}, 输出=${message.usage.output_tokens || 0}`);
} else {
    console.log(`[请求 ${requestId}] ⚠️ 警告: 未返回 token 使用信息`);
}
```

### 3. 改进错误处理

添加了默认值，避免显示 `undefined`：

```javascript
content: [
    { text: response.choices[0].message.content || '' }
],
model: response.model || model,
```

## 测试方法

### 1. 重启服务

```bash
# Windows
start.bat

# Linux
./start.sh
```

### 2. 配置 OpenAI 兼容接口

在 Web 界面中配置：
```
Claude Base URL: https://fucaixie.xyz/v1
Claude API Key: sk-xxxxx
默认模型: claude-opus-4-6
```

### 3. 测试改写

在 Web 界面中输入测试文本，点击"改写"按钮。

### 4. 检查统计信息

改写完成后，应该能看到：
- ✅ 耗时：显示具体秒数（如 `3.25s`）
- ✅ 相似度：显示百分比（如 `52.8%`）
- ✅ 输入 Tokens：显示数字（如 `245`）
- ✅ 输出 Tokens：显示数字（如 `189`）

### 5. 查看服务器日志

服务器日志应该显示：
```
[请求 xxx] ✓ API 调用成功，耗时: 3.25秒
[请求 xxx] 响应内容长度: 189 字符
[请求 xxx] Token 使用: 输入=245, 输出=189
```

## 常见问题

### Q1: 为什么统计信息还是显示 `-`？

A: 可能原因：
1. 服务没有重启
2. API 服务商没有返回 usage 信息
3. 浏览器缓存

解决方法：
1. 重启服务
2. 清除浏览器缓存（Ctrl+F5）
3. 查看服务器日志确认

### Q2: 不同 API 服务商返回的 token 数量不一样？

A: 是的，这是正常的：
- 不同服务商的计算方式可能略有不同
- 中文 token 计算方式可能不同
- 这不影响功能，只是统计数据

### Q3: 为什么有时候显示 0？

A: 可能原因：
1. API 服务商没有返回 usage 信息
2. 请求失败但返回了部分数据
3. 模型不支持 token 统计

这不影响改写功能，只是统计数据不准确。

### Q4: 如何验证修复是否生效？

A: 检查服务器日志：
```
[请求 xxx] Token 使用: 输入=245, 输出=189
```

如果看到具体数字（不是 0），说明修复生效。

## 技术细节

### OpenAI 兼容接口响应格式

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude-opus-4-6",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "改写后的文本..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 245,
    "completion_tokens": 189,
    "total_tokens": 434
  }
}
```

### 转换为 Anthropic 格式

```javascript
{
  content: [
    { text: "改写后的文本..." }
  ],
  model: "claude-opus-4-6",
  usage: {
    input_tokens: 245,
    output_tokens: 189
  }
}
```

### 前端显示

前端从 `_meta` 字段读取统计信息：

```javascript
{
  "errcode": "0",
  "errmsg": "",
  "data": "改写后的文本...",
  "_meta": {
    "mode": "seo_fast",
    "model": "claude-opus-4-6",
    "duration": 3.25,
    "usage": {
      "input_tokens": 245,
      "output_tokens": 189
    }
  }
}
```

## 更新日志

- 2026-03-08: 修复 OpenAI 兼容接口 token 统计显示问题
- 2026-03-08: 添加对两种字段名称的兼容支持
- 2026-03-08: 改进日志输出和错误处理

## 相关文档

- [模型名称对照表.md](./模型名称对照表.md) - 模型配置说明
- [API中转说明.md](./API中转说明.md) - API 配置说明
- [README.md](./README.md) - 系统主文档
