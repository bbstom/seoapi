# 修复记录：allowed_models 字段映射缺失

## 问题描述

用户反馈：
- "保存成功后，重新刷新，配置显示为空"
- 令牌的负载均衡模型多选功能保存后，刷新页面配置丢失

## 根本原因

前端 `TokensPage.jsx` 的 `loadTokens()` 方法中，**缺少 `allowed_models` 字段的映射**。

后端 `tokenManager.js` 已经正确返回了 `allowedModels` 字段，但前端在映射时遗漏了这个字段，导致：
1. 保存时可以正常保存到数据库
2. 刷新页面时，前端无法读取已保存的 `allowed_models` 数据
3. 用户看到配置为空

## 修复内容

### 修改文件：`seoapi-nodejs/frontend/src/pages/TokensPage.jsx`

**修改前（第 28-43 行）：**
```javascript
const mappedTokens = (response.data.tokens || []).map(t => ({
  id: t.id,
  name: t.name || '未命名令牌',
  token: t.apiKey || t.api_key || '',
  created_at: t.createdAt || t.created_at,
  last_used: t.lastUsedAt || t.last_used_at,
  usage_count: t.usageCount || t.usage_count || 0,
  status: t.status || 'active',
  node_strategy: t.nodeStrategy || t.node_strategy || 'load_balance',
  load_balance_strategy: t.loadBalanceStrategy || t.load_balance_strategy || 'round_robin',
  load_balance_nodes: t.loadBalanceNodes || t.load_balance_nodes || [],
  default_model: t.defaultModel || t.default_model || '',  // ❌ 缺少 allowed_models
  fixed_node_id: t.fixedNodeId || t.fixed_node_id || null,
  fixed_model: t.fixedModel || t.fixed_model || ''
}));
```

**修改后：**
```javascript
const mappedTokens = (response.data.tokens || []).map(t => ({
  id: t.id,
  name: t.name || '未命名令牌',
  token: t.apiKey || t.api_key || '',
  created_at: t.createdAt || t.created_at,
  last_used: t.lastUsedAt || t.last_used_at,
  usage_count: t.usageCount || t.usage_count || 0,
  status: t.status || 'active',
  node_strategy: t.nodeStrategy || t.node_strategy || 'load_balance',
  load_balance_strategy: t.loadBalanceStrategy || t.load_balance_strategy || 'round_robin',
  load_balance_nodes: t.loadBalanceNodes || t.load_balance_nodes || [],
  allowed_models: t.allowedModels || t.allowed_models || [],  // ✅ 添加此行
  default_model: t.defaultModel || t.default_model || '',
  fixed_node_id: t.fixedNodeId || t.fixed_node_id || null,
  fixed_model: t.fixedModel || t.fixed_model || ''
}));
```

## 数据流程

### 保存流程（正常）
1. 用户选择模型 → `editingConfig[tokenId].allowedModels = ["model1", "model2"]`
2. 点击保存 → `updateNodeConfig()` 发送到后端
3. 后端 `tokenManager.updateTokenNodeConfig()` 保存到数据库
4. 数据库 `allowed_models` 字段：`["model1", "model2"]` ✅

### 读取流程（修复前 - 有问题）
1. 刷新页面 → `loadTokens()` 从后端获取数据
2. 后端返回：`{ allowedModels: ["model1", "model2"] }`
3. 前端映射：**遗漏 `allowed_models` 字段** ❌
4. `token.allowed_models = undefined`
5. 用户看到配置为空 ❌

### 读取流程（修复后 - 正常）
1. 刷新页面 → `loadTokens()` 从后端获取数据
2. 后端返回：`{ allowedModels: ["model1", "model2"] }`
3. 前端映射：`allowed_models: t.allowedModels || t.allowed_models || []` ✅
4. `token.allowed_models = ["model1", "model2"]` ✅
5. 用户看到已保存的配置 ✅

## 验证方法

### 1. 数据库验证
```sql
SELECT id, name, allowed_models, default_model 
FROM api_keys 
WHERE allowed_models IS NOT NULL;
```

### 2. 后端 API 验证
```bash
curl -H "Authorization: Bearer <session_token>" \
  https://api.vpno.eu.org/api/tokens
```

查看返回的 JSON 中是否包含 `allowedModels` 字段。

### 3. 前端验证
1. 打开浏览器开发者工具（F12）
2. 进入"令牌管理"页面
3. 查看 Network 标签中的 `/api/tokens` 请求
4. 查看 Response 中的 `allowedModels` 字段
5. 在 Console 中输入：`console.log(tokens)` 查看 `allowed_models` 字段

## 相关修改

本次修复是 **TASK 6: 令牌负载均衡模型多选功能** 的最后一步：

1. ✅ 数据库添加 `allowed_models` 字段
2. ✅ 后端支持读取和保存 `allowed_models`
3. ✅ 前端 UI 支持模型多选
4. ✅ 前端映射 `allowed_models` 字段（本次修复）

## 部署要求

修复后需要重新构建前端：
```bash
cd /www/wwwroot/api.vpno.eu.org/seoapi/frontend
npm run build
pm2 restart seoapi
```

## 修复时间

2026-03-13
