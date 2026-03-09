# AI 服务快速配置指南

## 🚀 支持的 AI 服务一览

| AI 服务 | 自动识别 | 推荐指数 | 配置难度 |
|---------|---------|---------|---------|
| OpenAI 中转 | ✅ | ⭐⭐⭐⭐⭐ | 简单 |
| Claude 官方 | ✅ | ⭐⭐⭐⭐⭐ | 简单 |
| Google Gemini | ✅ | ⭐⭐⭐⭐ | 中等 |
| 通义千问 | ✅ | ⭐⭐⭐⭐ | 中等 |
| 文心一言 | ✅ | ⭐⭐⭐ | 较难 |
| Cohere | ✅ | ⭐⭐⭐ | 中等 |

## 📝 快速配置

### 1. OpenAI 格式（推荐）

**适用于：** OpenAI、国内中转、Azure OpenAI

```
Base URL: https://api.openai.com/v1
或: https://api123.icu/v1
或: https://fucaixie.xyz/v1

API Key: sk-...

Model: 
- gpt-4
- gpt-3.5-turbo
- claude-sonnet-4-5-20250929 (中转)
```

**优点：**
- 最通用的格式
- 国内中转服务多
- 配置简单

### 2. Claude 官方

```
Base URL: https://api.anthropic.com

API Key: sk-ant-...

Model:
- claude-3-sonnet-20240229
- claude-3-opus-20240229
- claude-3-haiku-20240307
```

**优点：**
- 官方服务，稳定
- 支持最新模型

### 3. Google Gemini

```
Base URL: https://generativelanguage.googleapis.com

API Key: AIza...

Model:
- gemini-pro
- gemini-1.5-pro
- gemini-1.5-flash
```

**优点：**
- Google 官方
- 免费额度较高

**注意：**
- 需要 Google Cloud 账号
- 可能需要科学上网

### 4. 阿里云通义千问

```
Base URL: https://dashscope.aliyuncs.com

API Key: sk-...

Model:
- qwen-turbo (最快)
- qwen-plus (平衡)
- qwen-max (最强)
```

**优点：**
- 国内服务，速度快
- 中文理解好

**注意：**
- 需要阿里云账号
- 需要开通 DashScope 服务

### 5. 百度文心一言

```
Base URL: https://aip.baidubce.com

API Key: 24.xxx... (access_token)

Model:
- completions
- eb-instant
```

**优点：**
- 国内服务
- 中文能力强

**注意：**
- API Key 是 access_token，不是 API Key
- 需要先获取 access_token

### 6. Cohere

```
Base URL: https://api.cohere.ai

API Key: ...

Model:
- command
- command-light
```

**优点：**
- 专注于文本生成
- API 简单

## 🔍 自动识别规则

系统会根据 Base URL 自动识别 AI 服务类型：

| URL 特征 | 识别为 |
|---------|--------|
| 包含 `anthropic.com` 或 `claude` | Anthropic Claude |
| 包含 `generativelanguage.googleapis.com` 或 `gemini` | Google Gemini |
| 包含 `cohere.ai` 或 `cohere.com` | Cohere |
| 包含 `dashscope.aliyuncs.com` 或 `qwen` | 通义千问 |
| 包含 `aip.baidubce.com` 或 `wenxin` | 文心一言 |
| 包含 `/v1` 或 `openai` 相关域名 | OpenAI 格式 |
| 其他 | OpenAI 格式（默认） |

## 🎯 手动指定 API 类型

**适用场景：**
- 自定义代理服务（域名不在识别列表中）
- 企业内部 AI 服务
- 自动识别不准确时

**配置方法：**

1. 进入"配置"页面
2. 填写 API 地址（例如：`https://my-custom-api.example.com`）
3. 在"API 类型"下拉菜单选择正确的类型：
   - 自动识别（推荐）
   - OpenAI 格式
   - Anthropic Claude
   - Google Gemini
   - Cohere
   - 阿里云通义千问
   - 百度文心一言
   - Azure OpenAI
4. 填写 API Key
5. 点击"保存 API 配置"

**示例：**

```
场景：使用自定义代理，API 格式为 OpenAI

API 地址: https://my-proxy.example.com
API 类型: OpenAI 格式（手动指定）
API Key: sk-...
Model: gpt-4
```

**优先级：** 手动指定 > 自动识别

## ⚙️ 配置步骤

1. **登录系统**
   - 访问 http://localhost:8000
   - 使用管理员账号登录

2. **进入配置页面**
   - 点击左侧菜单"配置"

3. **填写 API 配置**
   - Claude API 地址：填入 Base URL
   - Claude API Key：填入对应的 API Key
   - 点击"保存 Claude 配置"

4. **设置默认模型**
   - 选择默认模型
   - 选择默认改写模式
   - 点击"保存默认配置"

5. **测试**
   - 进入"文本改写"页面
   - 输入测试文本
   - 点击"开始改写"

## 🔧 常见问题

### Q: 如何知道系统识别的是哪种 AI 服务？
A: 查看服务器日志，会显示 `API 类型: xxx`

### Q: 可以同时配置多个 AI 服务吗？
A: 目前每个用户只能配置一个 AI 服务，但可以随时切换

### Q: 如果识别错误怎么办？
A: 检查 Base URL 是否正确，确保包含服务的特征关键词

### Q: 支持自定义 AI 服务吗？
A: 如果是 OpenAI 格式的服务，可以直接使用。其他格式需要修改代码

### Q: 哪个 AI 服务最适合文本改写？
A: 推荐使用 Claude 或 GPT-4，效果最好

## 📊 性能对比

| AI 服务 | 速度 | 质量 | 成本 | 中文能力 |
|---------|------|------|------|---------|
| GPT-4 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 高 | ⭐⭐⭐⭐ |
| Claude | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 中 | ⭐⭐⭐⭐⭐ |
| Gemini | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 低 | ⭐⭐⭐ |
| 通义千问 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ |
| 文心一言 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 低 | ⭐⭐⭐⭐⭐ |

## 💡 推荐配置

**最佳性价比：**
```
通义千问 qwen-plus + OpenAI 中转 Claude
```

**最佳质量：**
```
Claude Opus 官方 或 GPT-4
```

**最快速度：**
```
通义千问 qwen-turbo 或 Gemini Flash
```

**国内用户：**
```
通义千问 或 文心一言（无需科学上网）
```

## 🎯 使用建议

1. **短文本（<500字）**：使用快速模型（Haiku、Turbo、Flash）
2. **长文本（>1000字）**：使用标准模型（Sonnet、Plus、Pro）
3. **高质量要求**：使用顶级模型（Opus、GPT-4、Max）
4. **批量处理**：使用成本低的模型（Gemini、通义千问）

## 📞 技术支持

如有问题，请查看：
- `AI接口兼容说明.md` - 详细的技术文档
- 服务器日志 - 查看实时调用情况
- 测试文件 - `test-openai-compatible.js`
