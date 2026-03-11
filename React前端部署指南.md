# React 前端部署指南

## 项目结构

```
seoapi-nodejs/
├── frontend/                 # React 前端项目
│   ├── src/
│   │   ├── App.jsx          # 主应用组件
│   │   ├── main.jsx         # 入口文件
│   │   └── index.css        # 全局样式
│   ├── index.html           # HTML 模板
│   ├── package.json         # 前端依赖
│   ├── vite.config.js       # Vite 配置
│   ├── tailwind.config.js   # Tailwind 配置
│   └── postcss.config.js    # PostCSS 配置
├── public/                  # 构建后的静态文件（Express 提供）
├── server/                  # 后端代码（不变）
├── server.js               # Express 服务器（不变）
└── deploy-frontend.bat     # Windows 部署脚本
```

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 开发模式

**方式一：同时运行前后端（推荐）**

```bash
# 终端 1：运行后端
npm run dev

# 终端 2：运行前端开发服务器
cd frontend
npm run dev
```

前端开发服务器会在 `http://localhost:3000` 运行，API 请求会自动代理到后端 `http://localhost:8000`。

**方式二：只运行前端**

```bash
cd frontend
npm run dev
```

### 3. 生产部署

**Windows 系统（双击运行）**：
```bash
deploy-frontend.bat
```

**Linux/Mac 系统**：
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

**手动部署**：
```bash
# 1. 进入前端目录
cd frontend

# 2. 构建前端
npm run build

# 3. 返回根目录
cd ..

# 4. 重启服务
pm2 restart seoapi
```

## 构建配置

### Vite 配置 (vite.config.js)

```javascript
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',        // 构建输出到 public 目录
    emptyOutDir: true,          // 清空输出目录
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
```

### Tailwind 配置 (tailwind.config.js)

```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        }
      }
    },
  },
  plugins: [],
}
```

## 技术栈

- **React 18** - UI 框架
- **Vite** - 构建工具
- **Tailwind CSS** - 样式框架
- **Lucide React** - 图标库
- **Axios** - HTTP 客户端

## 开发指南

### 添加新页面

1. 在 `App.jsx` 中创建新的页面组件：

```jsx
const NewPage = () => (
  <div className="max-w-6xl mx-auto animate-in">
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="font-bold text-slate-800 mb-4">新页面</h3>
      <p className="text-slate-500">页面内容</p>
    </div>
  </div>
);
```

2. 在菜单项中添加：

```jsx
const menuItems = [
  // ...
  { id: 'newpage', name: '新页面', icon: YourIcon },
];
```

3. 在主内容区域添加路由：

```jsx
{activeTab === 'newpage' && <NewPage />}
```

### API 调用示例

```jsx
import axios from 'axios';

const API_BASE = '/api';

// GET 请求
const fetchData = async () => {
  try {
    const response = await axios.get(`${API_BASE}/endpoint`);
    console.log(response.data);
  } catch (error) {
    console.error('请求失败:', error);
  }
};

// POST 请求
const postData = async (data) => {
  try {
    const response = await axios.post(`${API_BASE}/endpoint`, data);
    console.log(response.data);
  } catch (error) {
    console.error('请求失败:', error);
  }
};
```

### Tailwind 样式示例

```jsx
// 卡片
<div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-6">
  内容
</div>

// 按钮
<button className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white px-6 py-3 rounded-2xl font-bold hover:shadow-lg transition-all">
  点击
</button>

// 输入框
<input className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none" />
```

## 性能优化

### 代码分割

Vite 自动进行代码分割，将 vendor 和 icons 分离：

```javascript
manualChunks: {
  vendor: ['react', 'react-dom'],
  icons: ['lucide-react']
}
```

### 懒加载

对于大型组件，可以使用 React.lazy：

```jsx
const HeavyComponent = React.lazy(() => import('./HeavyComponent'));

<Suspense fallback={<div>加载中...</div>}>
  <HeavyComponent />
</Suspense>
```

### 图片优化

使用 WebP 格式和懒加载：

```jsx
<img 
  src="image.webp" 
  loading="lazy" 
  alt="描述"
  className="w-full h-auto"
/>
```

## 常见问题

### Q1: 构建后页面空白

**原因**：可能是路径问题或 API 调用失败

**解决**：
1. 检查浏览器控制台错误
2. 确认后端服务正常运行
3. 检查 API 路径是否正确

### Q2: 样式不生效

**原因**：Tailwind 未正确配置

**解决**：
1. 确认 `tailwind.config.js` 的 content 路径正确
2. 重新构建：`npm run build`
3. 清除浏览器缓存

### Q3: API 请求 404

**原因**：代理配置或后端路由问题

**解决**：
1. 检查 `vite.config.js` 的 proxy 配置
2. 确认后端路由正确
3. 查看后端日志

### Q4: 开发模式下热更新不工作

**原因**：Vite 配置问题

**解决**：
1. 重启开发服务器
2. 检查文件是否在 `src/` 目录下
3. 清除 `node_modules/.vite` 缓存

## 部署检查清单

- [ ] 前端依赖已安装 (`npm install`)
- [ ] 构建成功 (`npm run build`)
- [ ] `public/` 目录有构建文件
- [ ] 后端服务正常运行
- [ ] 浏览器缓存已清除 (Ctrl+F5)
- [ ] 登录功能正常
- [ ] API 调用正常
- [ ] 样式显示正常

## 浏览器兼容性

- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+

## 更新日志

### v1.0.0 (2026-03-10)
- ✅ 初始版本
- ✅ React + Tailwind CSS 架构
- ✅ 文本改写功能
- ✅ 响应式设计
- ✅ 现代化 UI

## 技术支持

如遇问题，请检查：
1. Node.js 版本 >= 16
2. npm 版本 >= 8
3. 后端服务正常运行
4. 网络连接正常

## 下一步计划

- [ ] 完善数据看板功能
- [ ] 实现令牌管理
- [ ] 添加系统配置界面
- [ ] 实现改写模式管理
- [ ] 完善个人中心
- [ ] 添加 API 文档页面
