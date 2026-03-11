# SEO API 文本改写系统 - 生产部署

## 📖 项目简介

这是一个基于 Node.js + React 的智能文本改写系统，支持多种改写模式、多 AI 节点管理、负载均衡、故障转移等企业级功能。

### 核心功能

- ✅ 多种改写模式（人性化、SEO深度、SEO标准等）
- ✅ 多 AI 节点管理（支持 OpenAI、Claude、国内中转平台）
- ✅ 智能负载均衡（7种策略：轮询、随机、最少连接等）
- ✅ 自动故障转移（节点失败自动切换）
- ✅ 令牌管理（支持固定节点和负载均衡模式）
- ✅ 数据看板（请求日志、统计分析、过滤导出）
- ✅ 监控仪表盘（节点健康、性能统计）
- ✅ 用户认证（会话管理、权限控制）

---

## 🚀 快速开始（3步部署）

### 第1步：环境准备

```bash
# 安装 Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 MySQL 8.0
sudo apt install -y mysql-server

# 安装 PM2
sudo npm install -g pm2
```

### 第2步：配置和初始化

```bash
# 克隆代码
cd /var/www
git clone <your-repo> seoapi
cd seoapi

# 安装依赖
npm install --production

# 配置环境变量
cp .env.example .env
nano .env  # 修改数据库密码和会话密钥

# 初始化数据库
node scripts/init-database.js
```

### 第3步：启动服务

```bash
# 启动服务
pm2 start server.js --name seoapi

# 设置开机自启
pm2 startup
pm2 save

# 访问系统
# http://your-server:8000
# 默认账号: admin / admin123
```

---

## 📚 完整文档

### 部署相关
- [生产环境部署指南.md](./生产环境部署指南.md) - 完整的生产部署步骤 ⭐
- [运维快速参考.md](./运维快速参考.md) - 日常运维手册 ⭐
- [数据库部署指南.md](./数据库部署指南.md) - 数据库配置说明
- [Linux部署教程.md](./Linux部署教程.md) - Linux 系统部署
- [React前端部署指南.md](./React前端部署指南.md) - 前端构建和部署

### 功能使用
- [README.md](./README.md) - 项目总览
- [快速开始.md](./快速开始.md) - 快速上手指南
- [AI服务快速配置.md](./AI服务快速配置.md) - AI 节点配置
- [文本改写功能使用指南.md](./文本改写功能使用指南.md) - 改写功能说明
- [负载均衡和故障转移-使用指南.md](./负载均衡和故障转移-使用指南.md) - 负载均衡配置

### 配置说明
- [环境配置说明.md](./环境配置说明.md) - 环境变量配置
- [安全配置说明.md](./安全配置说明.md) - 安全加固
- [反向代理配置说明.md](./反向代理配置说明.md) - Nginx 配置
- [Web配置说明.md](./Web配置说明.md) - Web 界面配置

### API 兼容性
- [AI接口兼容说明.md](./AI接口兼容说明.md) - 支持的 AI 接口
- [5118格式说明.md](./5118格式说明.md) - 5118 格式兼容
- [compact参数使用指南.md](./compact参数使用指南.md) - 紧凑模式
- [iflow配置使用指南.md](./iflow配置使用指南.md) - iflow 平台配置

### 高级功能
- [令牌节点配置功能完成.md](./令牌节点配置功能完成.md) - 令牌管理
- [故障转移功能说明.md](./故障转移功能说明.md) - 故障转移机制
- [AI节点管理系统-README.md](./AI节点管理系统-README.md) - 节点管理

### 系统维护
- [系统改进建议.md](./系统改进建议.md) - 系统评估和改进建议 ⭐
- [完善工作总结.md](./完善工作总结.md) - 功能完善总结

---

## 🔧 维护脚本

### 数据库初始化
```bash
node scripts/init-database.js
```
创建所有数据库表和默认管理员账号。

### 项目清理
```bash
node scripts/cleanup-project.js
```
删除开发过程中的测试文件和临时文档，保留核心功能和文档。

### 数据库备份
```bash
# 手动备份
mysqldump -u seoapi_user -p seoapi | gzip > backup_$(date +%Y%m%d).sql.gz

# 自动备份（添加到 crontab）
0 2 * * * /var/www/seoapi/scripts/backup-database.sh
```

---

## 📊 系统架构

### 技术栈
- **后端**: Node.js 22.x + Express
- **前端**: React 18 + Vite + TailwindCSS
- **数据库**: MySQL 8.0
- **进程管理**: PM2
- **反向代理**: Nginx（可选）

### 目录结构
```
seoapi-nodejs/
├── server.js              # 后端主文件
├── package.json           # 依赖配置
├── .env                   # 环境变量
├── lib/                   # 核心库
│   ├── logger.js         # 日志系统
│   ├── loadBalancer.js   # 负载均衡
│   └── statsCollector.js # 统计收集
├── scripts/              # 维护脚本
│   ├── init-database.js  # 数据库初始化
│   └── cleanup-project.js # 项目清理
├── frontend/             # React 前端
│   ├── src/
│   │   ├── pages/       # 页面组件
│   │   └── components/  # 通用组件
│   └── dist/            # 构建输出
└── docs/                # 文档（各种 .md 文件）
```

---

## 🔒 安全建议

### 必须修改的配置
1. ✅ 修改 `.env` 中的 `SESSION_SECRET`
2. ✅ 修改数据库密码
3. ✅ 首次登录后修改管理员密码
4. ✅ 配置防火墙规则
5. ✅ 启用 HTTPS（推荐使用 Let's Encrypt）

### 安全加固
```bash
# 配置防火墙
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 限制数据库访问
# 编辑 /etc/mysql/mysql.conf.d/mysqld.cnf
bind-address = 127.0.0.1

# 设置文件权限
chmod 600 .env
chmod 755 logs
```

---

## 📈 性能优化

### Node.js 优化
```bash
# 使用集群模式
pm2 start server.js --name seoapi -i max
```

### MySQL 优化
```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
query_cache_size = 64M
```

### Nginx 优化
```nginx
# 启用 gzip 压缩
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# 缓存静态文件
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
}
```

---

## 🐛 故障排查

### 服务无法启动
```bash
# 查看日志
pm2 logs seoapi --lines 200

# 检查端口占用
sudo netstat -tlnp | grep 8000

# 手动启动测试
node server.js
```

### 数据库连接失败
```bash
# 测试连接
mysql -u seoapi_user -p -h localhost seoapi

# 检查 MySQL 状态
sudo systemctl status mysql

# 查看错误日志
sudo tail -f /var/log/mysql/error.log
```

### Nginx 502 错误
```bash
# 检查 Node.js 服务
pm2 status

# 测试 Nginx 配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 📞 技术支持

### 日志位置
- **应用日志**: `pm2 logs seoapi`
- **Nginx 日志**: `/var/log/nginx/`
- **MySQL 日志**: `/var/log/mysql/`
- **系统日志**: `./logs/`

### 常见问题
1. **改写失败** - 检查 AI 节点配置和 API Key
2. **统计数据为空** - 确保已调用改写接口
3. **登录失败** - 检查数据库连接和用户表
4. **节点健康检测失败** - 检查网络连接和 API 地址

### 获取帮助
- 查看 [系统改进建议.md](./系统改进建议.md) 了解系统状态
- 查看 [生产环境部署指南.md](./生产环境部署指南.md) 获取详细步骤
- 查看各功能模块的专项文档

---

## ✅ 部署检查清单

### 部署前
- [ ] 修改所有密码和密钥
- [ ] 配置数据库连接
- [ ] 运行清理脚本
- [ ] 测试本地环境

### 部署中
- [ ] 上传代码
- [ ] 安装依赖
- [ ] 初始化数据库
- [ ] 配置 PM2
- [ ] 配置 Nginx

### 部署后
- [ ] 修改默认密码
- [ ] 配置防火墙
- [ ] 设置数据库备份
- [ ] 配置日志轮转
- [ ] 测试所有功能
- [ ] 配置 HTTPS
- [ ] 设置监控告警

---

## 🎯 系统状态

**当前版本**: v1.0  
**完成度**: 95%  
**核心功能**: 全部完成  
**生产就绪**: ✅ 是

### 已完成功能
- ✅ 文本改写系统
- ✅ API 节点管理
- ✅ 负载均衡与故障转移
- ✅ 令牌管理
- ✅ 数据看板
- ✅ 监控仪表盘
- ✅ 用户认证

### 建议改进（可选）
- 📊 监控仪表板可视化（图表）
- 📋 故障转移历史页面
- ⚙️ 告警管理界面
- 🧪 测试覆盖
- 📱 移动端优化

详见 [系统改进建议.md](./系统改进建议.md)

---

## 📝 更新日志

### 2026-03-12
- ✅ 修复监控仪表盘统计数据问题
- ✅ 修复改写接口变量作用域问题
- ✅ 创建生产环境部署指南
- ✅ 创建数据库初始化脚本
- ✅ 创建项目清理脚本
- ✅ 整理系统文档

### 历史更新
- 数据看板过滤功能修复
- 前端术语统一（使用文档 → 用户指南）
- 故障转移策略文档更新
- 负载均衡功能完善

---

**部署完成后，访问 `http://your-server:8000` 开始使用！**

**默认账号**: admin / admin123（请立即修改）

