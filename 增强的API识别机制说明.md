# 增强的 API 识别机制说明

## 概述

系统现在采用**多层识别策略**，即使使用的 URL 不是已知平台，也能准确识别 API 格式。特别针对国内中转平台进行了优化。

## 识别策略（4 层）

### 第 1 层：手动指定（最高优先级）

如果用户手动指定了 API 类型，直接使用指定的类型，不再进行自动识别。

```javascript
manualType !== 'auto' → 使用手动指定类型
```

### 第 2 层：URL 特征识别（官方服务）

通过 URL 中的关键词快速识别官方服务：

| URL 特征 | 识别为 |
|---------|--------|
| `anthropic.com` | Anthropic Claude 官方 |
| `api.openai.com` | OpenAI 官方 |
| `generativelanguage.googleapis.com` | Google Gemini |
| `dashscope.aliyuncs.com` | 阿里云通义千问 |
| `aip.baidubce.com` | 百度文心一言 |
| `cohere.ai` / `cohere.com` | Cohere |
| `azure.com` / `openai.azure` | Azure OpenAI |

### 第 3 层：已知中转平台识别

识别常见的国内外中转平台（10+ 个）：

**支持的中转平台：**
- `fucaixie.xyz` - 国内中转
- `api123.icu` - 国内中转
- `chatanywhere` - ChatAnywhere
- `api2d` - API2D
- `closeai` - CloseAI
- `openai-proxy` - OpenAI Proxy
- `openai-sb` - OpenAI SB
- `api-gpt` - API GPT
- `gpt-api` - GPT API
- `claude-api` - Claude API
- `ai-proxy` - AI Proxy

**识别逻辑：**
```javascript
if (knownProxyDomains.some(domain => url.includes(domain))) {
    return 'openai';  // 中转平台通常使用 OpenAI 格式
}
```

### 第 4 层：路径特征识别

通过 URL 路径判断 API 格式：

| 路径特征 | 识别为 |
|---------|--------|
| `/v1/chat/completions` | OpenAI 格式 |
| `/v1/models` | OpenAI 格式 |
| 包含 `/v1` | OpenAI 格式 |

### 第 5 层：默认策略

如果以上所有方法都无法识别，使用默认的 OpenAI 格式。

**原因：**
- OpenAI 格式是最通用的 API 格式
- 国内大部分中转平台都使用 OpenAI 格式
- 兼容性最好

## 智能探测（可选）

系统还支持通过实际调用 API 来探测格式（目前作为备用方案）：

```javascript
async function probeAPIType(baseURL, apiKey) {
    // 尝试调用 /v1/models 端点
    // 根据响应格式判断 API 类型
}
```

**探测逻辑：**
1. 调用 `GET /v1/models` 端点
2. 分析响应格式：
   - 包含 `object: 'list'` → OpenAI 格式
   - 包含 `models` 或 `model` → OpenAI 兼容
   - 其他 → 默认 OpenAI 格式
3. 超时 5 秒自动使用默认格式

## 使用场景

### 场景 1：已知中转平台

```
URL: https://api123.icu/v1
识别: 第 3 层 - 已知中转平台
结果: openai ✅
```

### 场景 2：未知中转平台（包含 /v1）

```
URL: https://my-custom-proxy.com/v1
识别: 第 4 层 - 路径特征
结果: openai ✅
```

### 场景 3：完全未知的 URL

```
URL: https://random-api.example.com
识别: 第 5 层 - 默认策略
结果: openai ✅（国内中转平台通用）
```

### 场景 4：官方服务

```
URL: https://api.anthropic.com
识别: 第 2 层 - URL 特征
结果: anthropic ✅
```

### 场景 5：手动指定

```
URL: https://my-proxy.com
手动: anthropic
识别: 第 1 层 - 手动指定
结果: anthropic ✅
```

## 优势

### 1. 高准确率
- 多层识别策略，覆盖各种场景
- 针对国内中转平台优化
- 默认策略兼容性最好

### 2. 自动适配
- 无需手动配置（大多数情况）
- 自动识别常见中转平台
- 路径特征自动判断

### 3. 灵活性
- 支持手动指定（最高优先级）
- 支持智能探测（可选）
- 易于扩展新平台

### 4. 国内友好
- 支持 10+ 个常见中转平台
- 默认使用 OpenAI 格式（通用）
- 适配国内网络环境

## 识别流程图

```
用户请求
  ↓
手动指定？
  ├─ 是 → 使用手动类型 ✅
  └─ 否 ↓
URL 特征匹配？（官方服务）
  ├─ 是 → 使用对应类型 ✅
  └─ 否 ↓
已知中转平台？
  ├─ 是 → OpenAI 格式 ✅
  └─ 否 ↓
路径特征匹配？（/v1）
  ├─ 是 → OpenAI 格式 ✅
  └─ 否 ↓
默认策略
  └─ OpenAI 格式 ✅（国内中转通用）
```

## 配置示例

### 示例 1：国内中转平台（自动识别）

```
API 地址: https://api123.icu/v1
API 类型: 自动识别
结果: ✅ 自动识别为 OpenAI 格式
```

### 示例 2：未知中转平台（自动识别）

```
API 地址: https://my-proxy.example.com/v1
API 类型: 自动识别
结果: ✅ 路径特征识别为 OpenAI 格式
```

### 示例 3：完全未知（自动识别）

```
API 地址: https://random-api.com
API 类型: 自动识别
结果: ✅ 默认使用 OpenAI 格式
```

### 示例 4：手动指定（覆盖自动识别）

```
API 地址: https://my-proxy.com
API 类型: Anthropic Claude（手动）
结果: ✅ 使用 Claude 格式
```

## 日志输出

系统会输出详细的识别日志，方便调试：

```
[API 识别] 已知中转平台，使用 OpenAI 格式
[API 识别] 路径特征识别: OpenAI 格式（包含 /v1 路径）
[API 识别] 无法识别 URL: xxx，使用默认 OpenAI 格式（国内中转平台通用）
[API 识别] 使用手动指定类型: openai
```

## 扩展性

### 添加新的中转平台

编辑 `server.js`，在 `knownProxyDomains` 数组中添加：

```javascript
const knownProxyDomains = [
    'fucaixie.xyz', 
    'api123.icu',
    // ... 现有平台
    'your-new-proxy.com'  // 添加新平台
];
```

### 添加新的 URL 特征

在 `detectAPIType()` 函数中添加：

```javascript
// 新的服务
if (url.includes('your-service.com')) {
    console.log(`[API 识别] URL 特征识别: Your Service`);
    return 'your-service';
}
```

## 测试

运行测试脚本验证识别机制：

```bash
node test-enhanced-api-detection.js
```

**测试覆盖：**
- ✅ OpenAI 官方
- ✅ Anthropic Claude 官方
- ✅ 已知中转平台（6 个）
- ✅ 未知中转平台（路径特征）
- ✅ 完全未知的 URL
- ✅ 国内中转平台
- ✅ Google Gemini
- ✅ 通义千问
- ✅ 手动指定覆盖

## 常见问题

### Q1: 为什么默认使用 OpenAI 格式？

**A:** 因为：
1. OpenAI 格式是最通用的 API 格式
2. 国内大部分中转平台都使用 OpenAI 格式
3. 兼容性最好，成功率最高

### Q2: 如果识别错误怎么办？

**A:** 使用手动指定功能：
1. 进入"配置"页面
2. 选择正确的 API 类型
3. 保存配置

### Q3: 如何知道系统识别的是什么类型？

**A:** 查看服务器日志，找到 `[API 识别]` 开头的日志。

### Q4: 可以添加更多中转平台吗？

**A:** 可以，编辑 `server.js` 中的 `knownProxyDomains` 数组。

### Q5: 智能探测什么时候会用到？

**A:** 目前作为备用方案，当提供了 API Key 且无法通过其他方式识别时使用。

## 性能优化

### 识别速度

- **第 1 层（手动）**: 即时（0ms）
- **第 2 层（URL）**: 极快（<1ms）
- **第 3 层（中转）**: 极快（<1ms）
- **第 4 层（路径）**: 极快（<1ms）
- **第 5 层（默认）**: 即时（0ms）
- **智能探测**: 较慢（5s 超时）

### 优化建议

1. 优先使用手动指定（最快）
2. 使用已知中转平台（自动识别快）
3. 避免依赖智能探测（较慢）

## 总结

增强的 API 识别机制通过**多层识别策略**，完美解决了国内中转平台的识别问题：

✅ **自动识别** - 无需手动配置  
✅ **高准确率** - 多层策略覆盖各种场景  
✅ **国内友好** - 支持 10+ 个中转平台  
✅ **兼容性好** - 默认 OpenAI 格式通用  
✅ **易扩展** - 轻松添加新平台  

---

**版本：** 1.2.0  
**更新时间：** 2026-03-09  
**状态：** ✅ 已完成并测试
