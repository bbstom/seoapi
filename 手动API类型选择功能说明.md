# 手动 API 类型选择功能说明

## 功能概述

系统现在支持手动指定 API 类型，解决了"API 链接不是已识别平台，但使用这些平台的 API 接口规则"的问题。

## 问题背景

用户提出的问题：
> "如果 api 链接不是这几个平台的，但是使用的是这几个平台的 api 接口规则，是否可以正常识别"

**场景示例：**
- 你有一个自定义域名的 API 代理：`https://my-custom-api.example.com`
- 这个 API 使用的是 OpenAI 的接口格式
- 但系统无法通过 URL 自动识别，因为域名不在识别列表中

## 解决方案

### 1. 自动识别（默认）

系统会根据 URL 特征自动识别 API 类型：

```javascript
// 自动识别逻辑
- 包含 'anthropic.com' → Anthropic Claude
- 包含 'openai.com' 或 '/v1' → OpenAI
- 包含 'gemini' → Google Gemini
- 包含 'qwen' → 通义千问
- 其他 → OpenAI（默认）
```

### 2. 手动指定（新功能）

如果自动识别不准确，可以手动指定 API 类型：

**支持的类型：**
- `auto` - 自动识别（默认）
- `openai` - OpenAI 格式
- `anthropic` - Anthropic Claude 格式
- `gemini` - Google Gemini 格式
- `cohere` - Cohere 格式
- `qwen` - 阿里云通义千问格式
- `wenxin` - 百度文心一言格式
- `azure-openai` - Azure OpenAI 格式

## 使用方法

### Web 界面配置

1. 登录系统
2. 进入"配置"页面
3. 填写配置：
   - **API 地址**：`https://my-custom-api.example.com`
   - **API 类型**：从下拉菜单选择（例如：OpenAI 格式）
   - **API Key**：`sk-...`
4. 点击"保存 API 配置"

### API 配置

通过 API 设置：

```bash
# 设置 API 类型
curl -X POST http://localhost:8000/api/users/api-type \
  -H "Content-Type: application/json" \
  -H "X-Session-Token: YOUR_SESSION_TOKEN" \
  -d '{"apiType": "openai"}'
```

## 工作原理

### 识别优先级

```
手动指定 > 自动识别
```

### 代码实现

```javascript
function detectAPIType(baseURL, manualType = 'auto') {
    // 1. 如果手动指定了类型且不是 auto，直接返回
    if (manualType && manualType !== 'auto') {
        console.log(`[API 识别] 使用手动指定类型: ${manualType}`);
        return manualType;
    }
    
    // 2. 自动识别
    const url = baseURL.toLowerCase();
    
    if (url.includes('anthropic.com')) return 'anthropic';
    if (url.includes('gemini')) return 'gemini';
    // ... 其他识别规则
    
    // 3. 默认使用 OpenAI 格式
    return 'openai';
}
```

### 调用流程

```
用户请求
  ↓
获取用户配置（baseURL, apiType）
  ↓
detectAPIType(baseURL, apiType)
  ↓
manualType !== 'auto' ?
  ├─ 是 → 使用手动指定类型
  └─ 否 → 自动识别
  ↓
callAI() 使用对应的 API 格式
```

## 使用场景

### 场景 1：自定义代理服务

**问题：**
- API 地址：`https://my-proxy.example.com`
- 使用 OpenAI 格式
- 自动识别失败（识别为 OpenAI 但不确定）

**解决：**
```
API 地址: https://my-proxy.example.com
API 类型: OpenAI 格式（手动指定）
API Key: sk-...
```

### 场景 2：企业内部服务

**问题：**
- API 地址：`https://internal-ai.company.com`
- 使用 Claude 格式
- 自动识别失败（默认为 OpenAI）

**解决：**
```
API 地址: https://internal-ai.company.com
API 类型: Anthropic Claude（手动指定）
API Key: sk-ant-...
```

### 场景 3：小众中转服务

**问题：**
- API 地址：`https://unknown-service.com`
- 使用 OpenAI 格式
- 自动识别不准确

**解决：**
```
API 地址: https://unknown-service.com
API 类型: OpenAI 格式（手动指定）
API Key: sk-...
```

## 测试验证

运行测试脚本：

```bash
node test-api-type-selection.js
```

**测试结果：**
```
✅ 测试 1: 自动识别 - api123.icu → openai
✅ 测试 2: 自动识别 - fucaixie.xyz → openai
✅ 测试 3: 自动识别 - anthropic.com → anthropic
✅ 测试 4: 手动指定 - 非标准 URL 使用 OpenAI 格式
✅ 测试 5: 手动指定 - 非标准 URL 使用 Anthropic 格式
✅ 测试 6: 自动识别 - 非标准 URL 默认 OpenAI
✅ 测试 7: 手动指定 - Gemini
✅ 测试 8: 手动指定 - 通义千问

测试完成: 8 通过, 0 失败
```

## 数据存储

用户配置中新增 `apiType` 字段：

```json
{
  "admin": {
    "username": "admin",
    "apiKey": "sk_...",
    "claudeApiKey": "sk-...",
    "claudeBaseURL": "https://my-custom-api.example.com",
    "apiType": "openai",  // 新增字段
    "defaultModel": "claude-sonnet-4-5-20250929",
    "defaultMode": "humanlike"
  }
}
```

**默认值：** `auto`（自动识别）

## 兼容性

### 现有用户

- 系统会自动为现有用户添加 `apiType: 'auto'` 字段
- 不影响现有功能，保持向后兼容

### API 端点

新增端点：
```
POST /api/users/api-type
```

现有端点不受影响。

## 常见问题

### Q1: 什么时候需要手动指定？

**A:** 当你的 API 地址不在自动识别列表中，但你知道它使用的是哪种 API 格式时。

### Q2: 手动指定会影响自动识别吗？

**A:** 不会。手动指定只对当前用户生效，其他用户仍然使用自动识别。

### Q3: 如何知道应该选择哪种类型？

**A:** 
1. 查看 API 提供商的文档
2. 如果是 OpenAI 兼容接口，选择"OpenAI 格式"
3. 如果不确定，先使用"自动识别"，查看日志中的识别结果

### Q4: 可以随时更改吗？

**A:** 可以。在配置页面随时更改，立即生效。

### Q5: 如何验证配置是否正确？

**A:** 
1. 保存配置后，在"配置状态"中查看当前设置
2. 进行一次文本改写测试
3. 查看服务器日志，确认 API 类型识别正确

## 技术细节

### 后端实现

**文件：** `server.js`

```javascript
// 1. 用户模型添加 apiType 字段
user.apiType = 'auto';

// 2. API 端点
app.post('/api/users/api-type', verifySession, (req, res) => {
    const { apiType } = req.body;
    // 验证并保存
});

// 3. 检测函数
function detectAPIType(baseURL, manualType = 'auto') {
    if (manualType && manualType !== 'auto') {
        return manualType;
    }
    // 自动识别逻辑
}

// 4. 调用时传入用户配置
const apiType = detectAPIType(baseURL, req.user.apiType || 'auto');
```

### 前端实现

**文件：** `public/index.html`

```javascript
// 1. API 类型选择器
<select id="api-type">
    <option value="auto">自动识别（推荐）</option>
    <option value="openai">OpenAI 格式</option>
    // ...
</select>

// 2. 保存配置
async function saveClaudeConfig() {
    const apiType = document.getElementById('api-type').value;
    
    await authFetch('/api/users/api-type', {
        method: 'POST',
        body: JSON.stringify({ apiType })
    });
}

// 3. 加载配置
async function loadConfig() {
    const data = await authFetch('/api/auth/me');
    document.getElementById('api-type').value = data.user.apiType;
}
```

## 更新日志

**版本：** 1.1.0  
**日期：** 2026-03-09

**新增功能：**
- ✅ 手动 API 类型选择
- ✅ API 类型配置端点
- ✅ 前端 API 类型选择器
- ✅ 自动为现有用户添加默认值
- ✅ 完整的测试覆盖

**文档更新：**
- ✅ AI接口兼容说明.md
- ✅ AI服务快速配置.md
- ✅ 手动API类型选择功能说明.md（本文档）

## 总结

手动 API 类型选择功能完美解决了"非标准 URL 使用标准 API 格式"的问题：

1. **灵活性**：支持任意域名的 API 服务
2. **兼容性**：不影响现有功能和用户
3. **易用性**：Web 界面简单配置
4. **可靠性**：完整的测试覆盖
5. **可扩展性**：易于添加新的 API 类型

用户现在可以使用任何 API 服务，只要它遵循已支持的 API 格式之一。
