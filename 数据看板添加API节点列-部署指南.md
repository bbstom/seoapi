# 数据看板添加API节点列 - 部署指南

## 功能说明

在数据看板的活动记录表格中添加"API节点"列，显示每次调用使用的API节点名称。

## 已完成的修改

### 1. 数据库修改
- ✅ 创建迁移脚本 `scripts/add-node-info-to-logs.js`
- 添加 `node_id` 字段（INT，关联 api_configs 表）
- 添加 `node_name` 字段（VARCHAR(100)，冗余存储节点名称）
- 添加 `node_id` 索引

### 2. 后端修改
- ✅ `lib/logger.js`：
  - `logAPICall()` 方法支持记录 `nodeId` 和 `nodeName`
  - INSERT 语句添加节点信息字段

### 3. 前端修改
- ✅ `frontend/src/pages/DashboardPage.jsx`：
  - 表头添加"API节点"列
  - 表格数据显示节点名称（紫色标签）
  - 导出CSV添加节点列
  - 空数据提示列数从9改为10

## 部署步骤

### 步骤 1：执行数据库迁移
```bash
cd /www/wwwroot/api.vpno.eu.org/seoapi
node scripts/add-node-info-to-logs.js
```

**预期输出：**
```
✓ node_id 字段添加成功
✓ node_id 索引添加成功
✓ node_name 字段添加成功
```

### 步骤 2：重启后端服务
```bash
pm2 restart seoapi
```

### 步骤 3：重新构建前端
```bash
cd frontend
npm run build
```

### 步骤 4：验证功能
1. 访问 https://api.vpno.eu.org/
2. 进行一次文本改写操作
3. 进入"数据看板"
4. 查看活动记录表格是否有"API节点"列
5. 新记录应该显示节点名称

## 注意事项

- 现有日志的节点信息为 `NULL`，显示为 `-`
- 只有新产生的日志才会记录节点信息
- 节点名称以紫色标签显示，与模型（蓝色）、模式（靛蓝色）区分

## 相关文件

- `scripts/add-node-info-to-logs.js` - 数据库迁移脚本
- `lib/logger.js` - 日志记录器
- `frontend/src/pages/DashboardPage.jsx` - 数据看板页面
