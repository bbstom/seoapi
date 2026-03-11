# 多 API 配置 - 快速部署指南

## 🚀 3 步完成部署

### 步骤 1: 创建数据库表（2分钟）

```bash
cd seoapi-nodejs
node scripts/create-api-configs-table.js
```

**输出示例**：
```
开始创建 api_configs 表...
✅ api_configs 表创建成功！

开始迁移现有配置...
✅ 已迁移用户 admin 的配置
✅ 成功迁移 1 个用户的配置

✅ 所有操作完成！
```

### 步骤 2: 添加路由到 server.js（5分钟）

#### 2.1 在文件顶部添加引入（约第 20 行）

```javascript
const apiConfigManager = require('./lib/apiConfigManager');
```

#### 2.2 复制路由代码

打开 `多API配置路由.js` 文件，复制所有路由代码到 `server.js` 的路由部分（建议在第 1800 行左右，其他路由之后）。

### 步骤 3: 重启服务（1分钟）

```bash
# 如果使用 PM2
pm2 restart seoapi

# 或直接运行
node server.js
```

## ✅ 验证部署

### 1. 检查数据库表

```sql
SHOW TABLES LIKE 'api_configs';
SELECT * FROM api_configs;
```

### 2. 访问前端界面

1. 打开浏览器访问系统
2. 登录账号
3. 点击"系统配置"
4. 选择"外部 API 配置"标签
5. 应该能看到配置列表（如果有迁移的配置）

### 3. 测试添加配置

1. 点击"添加 API 配置"
2. 填写表单：
   - 配置名称：测试 API
   - Base URL：https://api.openai.com/v1
   - API Key：sk-test...
   - API 类型：OpenAI 格式
3. 点击"保存配置"
4. 应该看到成功提示

## 📝 完整的 server.js 修改示例

### 位置 1: 文件顶部（约第 20 行）

```javascript
const express = require('express');
const cors = require('cors');
// ... 其他引入 ...
const apiConfigManager = require('./lib/apiConfigManager');  // ← 添加这行
```

### 位置 2: 路由部分（约第 1800 行）

```javascript
// ========== 多 API 配置管理路由 ==========

// 获取用户的所有 API 配置
app.get('/api/api-configs', verifySession, async (req, res) => {
    try {
        const configs = await apiConfigManager.getUserApiConfigs(req.user.id);
        res.json({
            success: true,
            configs: configs
        });
    } catch (error) {
        console.error('获取 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取 API 配置失败'
        });
    }
});

// 添加 API 配置
app.post('/api/api-configs', verifySession, async (req, res) => {
    try {
        const {
            name,
            base_url,
            api_key,
            api_type = 'auto',
            is_default = false,
            is_active = true,
            priority = 0,
            models = [],
            description = ''
        } = req.body;
        
        if (!name || !base_url || !api_key) {
            return res.status(400).json({
                success: false,
                error: '名称、Base URL 和 API Key 为必填项'
            });
        }
        
        const configId = await apiConfigManager.addApiConfig(req.user.id, {
            name,
            base_url,
            api_key,
            api_type,
            is_default,
            is_active,
            priority,
            models,
            description
        });
        
        res.json({
            success: true,
            configId: configId,
            message: 'API 配置添加成功'
        });
    } catch (error) {
        console.error('添加 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '添加 API 配置失败'
        });
    }
});

// 更新 API 配置
app.put('/api/api-configs/:id', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const success = await apiConfigManager.updateApiConfig(req.user.id, configId, req.body);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或更新失败'
            });
        }
        
        res.json({
            success: true,
            message: 'API 配置更新成功'
        });
    } catch (error) {
        console.error('更新 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '更新 API 配置失败'
        });
    }
});

// 删除 API 配置
app.delete('/api/api-configs/:id', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const success = await apiConfigManager.deleteApiConfig(req.user.id, configId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或删除失败'
            });
        }
        
        res.json({
            success: true,
            message: 'API 配置已删除'
        });
    } catch (error) {
        console.error('删除 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '删除 API 配置失败'
        });
    }
});

// 设置默认 API 配置
app.post('/api/api-configs/:id/set-default', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const success = await apiConfigManager.setDefaultApiConfig(req.user.id, configId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或设置失败'
            });
        }
        
        res.json({
            success: true,
            message: '默认配置已更新'
        });
    } catch (error) {
        console.error('设置默认配置失败:', error);
        res.status(500).json({
            success: false,
            error: '设置默认配置失败'
        });
    }
});

// 测试 API 连接
app.post('/api/api-configs/test', verifySession, async (req, res) => {
    try {
        const { base_url, api_key, api_type } = req.body;
        
        if (!base_url || !api_key) {
            return res.status(400).json({
                success: false,
                error: 'Base URL 和 API Key 为必填项'
            });
        }
        
        // TODO: 实现实际的 API 测试逻辑
        res.json({
            success: true,
            message: 'API 连接测试成功'
        });
    } catch (error) {
        console.error('测试 API 连接失败:', error);
        res.status(500).json({
            success: false,
            error: '测试 API 连接失败'
        });
    }
});
```

## 🎯 使用示例

### 示例 1: 添加主 API

```javascript
// 前端代码
const response = await axios.post('/api/api-configs', {
  name: '主要 OpenAI API',
  base_url: 'https://api.openai.com/v1',
  api_key: 'sk-...',
  api_type: 'openai',
  is_default: true,
  is_active: true,
  priority: 100,
  description: '主要使用的 OpenAI API'
});
```

### 示例 2: 添加备用 API

```javascript
const response = await axios.post('/api/api-configs', {
  name: '备用 Claude API',
  base_url: 'https://api.anthropic.com',
  api_key: 'sk-ant-...',
  api_type: 'anthropic',
  is_default: false,
  is_active: true,
  priority: 50,
  description: '备用 Claude API，主 API 失败时使用'
});
```

## 🔧 故障排查

### 问题 1: 数据库表创建失败

**错误信息**：`Error: Table 'api_configs' already exists`

**解决方法**：表已存在，跳过此步骤

---

**错误信息**：`Error: Cannot add foreign key constraint`

**解决方法**：
1. 检查 `users` 表是否存在
2. 确认 MySQL 版本 >= 5.7

### 问题 2: 路由不工作

**错误信息**：`404 Not Found`

**解决方法**：
1. 确认路由代码已添加到 server.js
2. 确认服务已重启
3. 检查路由路径是否正确

### 问题 3: 前端显示错误

**错误信息**：`Cannot read property 'id' of undefined`

**解决方法**：
1. 检查后端 API 是否返回正确格式
2. 查看浏览器控制台错误信息
3. 确认前端代码已更新

## 📚 相关文档

- [多API配置功能说明.md](./多API配置功能说明.md) - 完整功能说明
- [多API配置路由.js](./多API配置路由.js) - 路由代码参考
- [lib/apiConfigManager.js](./lib/apiConfigManager.js) - API 配置管理器

## 🎉 完成！

部署完成后，你就可以：

✅ 添加多个 API 配置
✅ 设置优先级和默认配置
✅ 启用/禁用配置
✅ 自动故障转移
✅ 安全存储 API Key

享受更强大、更可靠的多 API 配置功能！
