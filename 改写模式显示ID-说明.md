# 改写模式显示模式ID - 说明文档

## 问题背景

用户在数据看板中看到模式显示为 `seo_original`，但在改写模式管理页面中看不到这个ID，无法对应是哪个模式。

## 解决方案

在改写模式管理页面的每个模式卡片中，显示模式ID。

## 修改内容

### 前端修改
- ✅ `frontend/src/pages/ModesPage.jsx`：
  - 在模式名称旁边添加模式ID显示（灰色代码标签）
  - 更新说明文字，解释模式ID的用途

## 显示效果

### 修改前
```
┌─────────────────────────────────────┐
│ 标准改写  ⭐ 反AI检测              │
│ 适用于SEO文章的标准改写...          │
└─────────────────────────────────────┘
```

### 修改后
```
┌─────────────────────────────────────┐
│ 标准改写  seo_original  ⭐ 反AI检测│
│ 适用于SEO文章的标准改写...          │
└─────────────────────────────────────┘
```

## 用途说明

模式ID的作用：
1. **API调用**：在调用API时使用模式ID（如 `mode=seo_original`）
2. **数据看板**：活动记录中显示的模式就是这个ID
3. **配置文件**：在 `config/rewrite-modes.js` 中定义

## 部署步骤

```bash
# 重新构建前端
cd /www/wwwroot/api.vpno.eu.org/seoapi/frontend
npm run build
```

## 验证方法

1. 访问 https://api.vpno.eu.org/
2. 进入"改写模式"页面
3. 查看每个模式卡片，应该能看到模式ID
4. 对比数据看板中的模式列，现在可以清楚对应了

## 示例对应关系

| 模式名称 | 模式ID | 说明 |
|---------|--------|------|
| 标准改写 | seo_original | SEO文章标准改写 |
| 深度改写 | deep_rewrite | 深度语义改写 |
| 创意改写 | creative | 创意性改写 |

## 相关文件

- `frontend/src/pages/ModesPage.jsx` - 改写模式管理页面
- `config/rewrite-modes.js` - 模式配置文件
- `frontend/src/pages/DashboardPage.jsx` - 数据看板（显示模式ID）
