# 🚀 立即部署 - 令牌负载均衡模型多选功能

## ✅ 已完成
- 数据库迁移：`allowed_models` 字段已添加
- 后端代码：已更新 `tokenManager.js`
- 前端代码：已更新 `TokensPage.jsx`

## 📋 需要执行的命令

### 1️⃣ 重新构建前端（必须）
```bash
cd /www/wwwroot/api.vpno.eu.org/seoapi/frontend
npm run build
```

### 2️⃣ 重启后端服务（必须）
```bash
pm2 restart seoapi
```

### 3️⃣ 查看日志（可选）
```bash
pm2 logs seoapi --lines 50
```

## 🧪 测试步骤

1. 访问 https://api.vpno.eu.org/
2. 登录 → 令牌管理
3. 点击某个令牌的"配置节点"⚙️
4. 选择"负载均衡"
5. 勾选多个 API 节点
6. 查看"允许使用的模型"列表（自动加载）
7. 勾选多个模型
8. 选择默认模型
9. 保存
10. 刷新页面验证配置保留

## ⚠️ 注意事项

- 如果模型列表为空，需要先在"API 管理"中测试连接获取模型
- 构建前端时不会删除 `.user.ini` 文件
- 重启服务后约 2-3 秒可用

## 📄 详细文档

查看 `令牌负载均衡模型多选-部署指南.md` 了解完整功能说明
