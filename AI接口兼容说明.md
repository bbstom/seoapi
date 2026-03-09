# AI 接口兼容说明

## 支持的 AI 服务

系统已实现智能 AI 接口适配器，支持以下 AI 服务的自动识别和调用：

### 1. OpenAI 格式（最通用）
**支持服务：**
- OpenAI 官方 API
- Azure OpenAI
- 国内各大中转服务（api123.icu、fucaixie.xyz 等）
- ChatAnywhere、API2D、CloseAI 等第三方服务

**识别特征：**
- URL 包含 `/v1`
- URL 包含 `openai.com`、`fucaixie.xyz`、`api123.icu` 等域名

**API 格式：**
```json
POST /v1/chat/completions
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "..."}],
  "max_tokens": 4096
}
```

### 2. Anthropic Claude 官方
**支持服务：**
- Claude 官方 API

**识别特征：**
- URL 包含 `anthropic.com` 或 `claude`

**API 格式：**
```json
POST /v1/messages
{
  "model": "claude-3-sonnet-20240229",
  "messages": [{"role": "user", "content": "..."}],
  "max_tokens": 4096
}
```

### 3. Google Gemini
**支持服务：**
- Google Gemini API

**识别特征：**
- URL 包含 `generativelanguage.googleapis.com` 或 `gemini`

**API 格式：**
```json
POST /v1beta/models/{model}:generateContent?key={apiKey}
{
  "contents": [{"parts": [{"text": "..."}]}],
  "generationConfig": {"maxOutputTokens": 4096}
}
```

**配置示例：**
- Base URL: `https://generativelanguage.googleapis.com`
- API Key: 你的 Google API Key
- Model: `gemini-pro`、`gemini-1.5-pro` 等

### 4. Cohere
**支持服务：**
- Cohere AI API

**识别特征：**
- URL 包含 `cohere.ai` 或 `cohere.com`

**API 格式：**
```json
POST /v1/chat
{
  "model": "command",
  "message": "...",
  "max_tokens": 4096
}
```

**配置示例：**
- Base URL: `https://api.cohere.ai`
- API Key: 你的 Cohere API Key
- Model: `command`、`command-light` 等

### 5. 阿里云通义千问
**支持服务：**
- 阿里云通义千问 API

**识别特征：**
- URL 包含 `dashscope.aliyuncs.com` 或 `qwen`

**API 格式：**
```json
POST /api/v1/services/aigc/text-generation/generation
{
  "model": "qwen-turbo",
  "input": {"messages": [{"role": "user", "content": "..."}]},
  "parameters": {"max_tokens": 4096}
}
```

**配置示例：**
- Base URL: `https://dashscope.aliyuncs.com`
- API Key: 你的阿里云 API Key
- Model: `qwen-turbo`、`qwen-plus`、`qwen-max` 等

### 6. 百度文心一言
**支持服务：**
- 百度文心一言 API

**识别特征：**
- URL 包含 `aip.baidubce.com` 或 `wenxin`

**API 格式：**
```json
POST /rpc/2.0/ai_custom/v1/wenxinworkshop/chat/{model}?access_token={token}
{
  "messages": [{"role": "user", "content": "..."}],
  "max_output_tokens": 4096
}
```

**配置示例：**
- Base URL: `https://aip.baidubce.com`
- API Key: 你的百度 Access Token
- Model: `completions`、`eb-instant` 等

## 自动识别机制

系统会根据 Base URL 自动识别 AI 服务类型：

1. **URL 特征匹配**：检查 URL 中的关键词（如 `anthropic`、`gemini`、`cohere` 等）
2. **路径特征匹配**：检查 URL 路径（如 `/v1`）
3. **域名匹配**：检查常见的 AI 服务域名
4. **默认策略**：如果无法识别，默认使用 OpenAI 格式（最通用）

## 手动指定 API 类型

如果你的 API 链接不是来自已识别的平台，但使用的是这些平台的 API 接口规则，可以手动指定 API 类型：

### 使用场景

1. **自定义代理服务**：你搭建了自己的 API 代理，使用 OpenAI 格式但域名不在识别列表中
2. **企业内部服务**：公司内部的 AI 服务，使用标准 API 格式但域名特殊
3. **第三方中转**：使用小众中转服务，自动识别不准确

### 配置方法

在 Web 界面的"配置"页面：

1. **API 地址**：填入你的 API Base URL（例如：`https://my-custom-api.example.com`）
2. **API 类型**：从下拉菜单选择正确的类型
   - **自动识别（推荐）**：让系统自动判断
   - **OpenAI 格式**：适用于大多数中转服务
   - **Anthropic Claude**：Claude 官方格式
   - **Google Gemini**：Gemini API 格式
   - **Cohere**：Cohere API 格式
   - **阿里云通义千问**：通义千问格式
   - **百度文心一言**：文心一言格式
   - **Azure OpenAI**：Azure OpenAI 格式
3. **API Key**：填入对应的 API Key
4. 点击"保存 API 配置"

### 示例

**场景 1：自定义代理使用 OpenAI 格式**
```
API 地址: https://my-proxy.example.com
API 类型: OpenAI 格式
API Key: sk-...
```

**场景 2：企业内部 Claude 服务**
```
API 地址: https://internal-ai.company.com
API 类型: Anthropic Claude
API Key: sk-ant-...
```

**场景 3：自动识别失败时**
```
API 地址: https://unknown-service.com
API 类型: OpenAI 格式（手动指定）
API Key: sk-...
```

### 优先级

手动指定的 API 类型优先级高于自动识别：
- 如果设置为"自动识别"，系统会根据 URL 判断
- 如果手动指定了类型，系统会直接使用指定的类型，不再进行自动识别

## 使用方法

### 在 Web 界面配置

1. 登录系统
2. 进入"配置"页面
3. 填写 Claude API 配置：
   - **Claude API 地址**：填入你的 AI 服务 Base URL
   - **Claude API Key**：填入对应的 API Key
4. 保存配置

### 配置示例

**使用 OpenAI：**
```
Base URL: https://api.openai.com/v1
API Key: sk-...
Model: gpt-4
```

**使用 Claude 官方：**
```
Base URL: https://api.anthropic.com
API Key: sk-ant-...
Model: claude-3-sonnet-20240229
```

**使用 Google Gemini：**
```
Base URL: https://generativelanguage.googleapis.com
API Key: AIza...
Model: gemini-pro
```

**使用通义千问：**
```
Base URL: https://dashscope.aliyuncs.com
API Key: sk-...
Model: qwen-turbo
```

**使用文心一言：**
```
Base URL: https://aip.baidubce.com
API Key: 24.xxx... (access_token)
Model: completions
```

## 响应格式统一

所有 AI 服务的响应都会被转换为统一格式：

```json
{
  "content": [
    {"text": "改写后的文本"}
  ],
  "model": "使用的模型",
  "usage": {
    "input_tokens": 100,
    "output_tokens": 200
  }
}
```

这样确保了无论使用哪个 AI 服务，系统都能正常工作。

## 注意事项

1. **API Key 格式**：不同服务的 API Key 格式不同，请确保填写正确
2. **模型名称**：不同服务支持的模型名称不同，请参考各服务的文档
3. **Base URL**：必须填写完整的 Base URL，包括协议（https://）
4. **超时设置**：所有请求默认超时时间为 60 秒
5. **错误处理**：如果调用失败，系统会返回详细的错误信息

## 测试建议

1. 先使用 OpenAI 格式的中转服务测试（最稳定）
2. 确认系统能正常工作后，再尝试其他 AI 服务
3. 查看服务器日志，确认 API 类型识别是否正确
4. 如有问题，检查 Base URL 和 API Key 是否正确

## 扩展性

如需支持更多 AI 服务，可以在 `server.js` 中添加：

1. 在 `detectAPIType()` 函数中添加识别规则
2. 创建对应的调用函数（如 `callXXX()`）
3. 在 `callAI()` 函数中添加 case 分支

系统设计为高度可扩展，添加新的 AI 服务非常简单。
