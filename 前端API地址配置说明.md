# 前端 API 地址配置说明

## 📋 配置方式

前端调用后端 API 的地址可以通过环境变量自定义。

---

## 🔧 配置步骤

### 1. 创建环境变量文件

```bash
cd frontend
cp .env.example .env
```

### 2. 编辑 .env 文件

```bash
nano .env
```

### 3. 设置 API 地址

根据你的部署方式选择配置：

#### 场景1：前后端同域名部署（推荐）

```env
# 留空，使用相对路径
VITE_API_BASE_URL=
```

**示例：**
- 前端：https://yourdomain.com
- 后端：https://yourdomain.com/api
- 配置：留空即可

#### 场景2：前后端分离部署

```env
# 填写完整的后端地址
VITE_API_BASE_URL=https://api.yourdomain.com
```

**示例：**
- 前端：https://web.yourdomain.com
- 后端：https://api.yourdomain.com
- 配置：`VITE_API_BASE_URL=https://api.yourdomain.com`

#### 场景3：开发环境

```env
# 留空，使用 Vite 代理
VITE_API_BASE_URL=
```

Vite 会自动将 `/api` 请求代理到 `http://localhost:8000`

---

## 🚀 应用配置

### 开发环境

```bash
cd frontend
npm run dev
```

配置会自动生效，无需重启。

### 生产环境

```bash
cd frontend

# 1. 设置环境变量
nano .env

# 2. 重新构建
npm run build

# 3. 前端文件会输出到 ../public 目录
```

---

## 📝 配置示例

### 示例1：宝塔面板部署（同域名）

```env
# .env 文件
VITE_API_BASE_URL=
```

**Nginx 配置：**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # 前端静态文件
    location / {
        root /www/wwwroot/seoapi/public;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 示例2：前后端分离部署

```env
# .env 文件
VITE_API_BASE_URL=https://api.yourdomain.com
```

**前端 Nginx 配置：**
```nginx
server {
    listen 80;
    server_name web.yourdomain.com;
    
    location / {
        root /www/wwwroot/seoapi-frontend;
        try_files $uri $uri/ /index.html;
    }
}
```

**后端 Nginx 配置：**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 示例3：使用子目录

```env
# .env 文件
VITE_API_BASE_URL=https://yourdomain.com/backend
```

**Nginx 配置：**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # 前端
    location / {
        root /www/wwwroot/seoapi/public;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端
    location /backend {
        rewrite ^/backend(.*)$ $1 break;
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔍 验证配置

### 1. 检查环境变量

```bash
cd frontend
cat .env
```

### 2. 检查构建输出

```bash
npm run build
```

查看构建日志，确认没有错误。

### 3. 测试 API 调用

打开浏览器控制台（F12），查看 Network 标签：
- 检查 API 请求的 URL 是否正确
- 检查请求是否成功返回

---

## ⚠️ 注意事项

### 1. 跨域问题

如果前后端分离部署，需要在后端配置 CORS：

**后端 server.js 中已配置：**
```javascript
app.use(cors({
  origin: '*',  // 生产环境建议指定具体域名
  credentials: true
}));
```

**生产环境建议：**
```javascript
app.use(cors({
  origin: 'https://web.yourdomain.com',  // 指定前端域名
  credentials: true
}));
```

### 2. HTTPS 配置

如果使用 HTTPS，确保：
- 前端使用 HTTPS
- 后端也使用 HTTPS
- 不要混用 HTTP 和 HTTPS

### 3. 环境变量优先级

```
.env.local > .env.production > .env.development > .env
```

### 4. 重新构建

修改 `.env` 文件后，必须重新构建：
```bash
npm run build
```

---

## 🛠️ 高级配置

### 使用代码配置（不推荐）

如果不想使用环境变量，可以直接修改 `src/config/api.js`：

```javascript
// src/config/api.js
const API_BASE_URL = 'https://api.yourdomain.com';

export function getApiUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  
  return path;
}
```

但这种方式不够灵活，不推荐使用。

---

## 📞 常见问题

### Q1: 修改了 .env 但没有生效？

**A:** 需要重新构建：
```bash
npm run build
```

### Q2: API 请求 404？

**A:** 检查：
1. 后端服务是否启动
2. API 地址是否正确
3. Nginx 配置是否正确

### Q3: 跨域错误？

**A:** 
1. 检查后端 CORS 配置
2. 确认前端域名在后端白名单中
3. 检查是否混用 HTTP 和 HTTPS

### Q4: 开发环境可以，生产环境不行？

**A:** 
1. 确认生产环境的 .env 配置
2. 确认重新构建了前端
3. 检查 Nginx 配置

---

## 📚 相关文档

- [生产环境部署指南.md](./生产环境部署指南.md)
- [反向代理配置说明.md](./反向代理配置说明.md)
- [前后端对接说明.md](./前后端对接说明.md)

---

**最后更新**: 2026-03-12

