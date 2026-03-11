# SEO API Frontend

基于 React + Tailwind CSS 的现代化前端界面。

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建文件会输出到 `../public/` 目录。

## 技术栈

- **React 18** - UI 框架
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **Axios** - HTTP 客户端

## 项目结构

```
src/
├── App.jsx          # 主应用组件
├── main.jsx         # 入口文件
└── index.css        # 全局样式
```

## 开发指南

### 添加新页面

1. 在 `App.jsx` 中创建新组件
2. 添加到菜单项
3. 添加路由逻辑

### API 调用

```jsx
import axios from 'axios';

const response = await axios.get('/api/endpoint');
```

### 样式

使用 Tailwind CSS 类名：

```jsx
<div className="bg-white rounded-3xl shadow-xl p-6">
  内容
</div>
```

## 构建配置

- 输出目录：`../public/`
- 开发端口：3000
- API 代理：`/api` → `http://localhost:8000`

## 浏览器支持

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+
