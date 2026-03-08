# Linux 服务器部署教程

## 📋 系统要求

- Linux 系统（Ubuntu/CentOS/Debian 等）
- **Node.js 18.0.0 或更高版本**
  - ✅ Node.js 24.14 - 完全支持，推荐使用
  - ✅ Node.js 22.x LTS - 完全支持，生产环境推荐
  - ✅ Node.js 20.x - 完全支持
  - ✅ Node.js 18.x - 最低要求版本
- 至少 512MB 内存
- 有 root 或 sudo 权限

> 💡 推荐使用 Node.js 24.14 或 22.x LTS 以获得最佳性能

## 🚀 快速部署（3 步完成）

### 步骤 1: 安装 Node.js

#### 方法 1: 安装 Node.js 24.x（推荐）

**Ubuntu/Debian 系统：**

```bash
# 更新包管理器
sudo apt update

# 安装 Node.js 24.x
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应该显示 v24.x.x
npm --version
```

**CentOS/RHEL 系统：**

```bash
# 安装 Node.js 24.x
curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version  # 应该显示 v24.x.x
npm --version
```

#### 方法 2: 安装 Node.js 22.x LTS（生产环境推荐）

**Ubuntu/Debian 系统：**

```bash
# 更新包管理器
sudo apt update

# 安装 Node.js 22.x LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version  # 应该显示 v22.x.x
npm --version
```

**CentOS/RHEL 系统：**

```bash
# 安装 Node.js 22.x LTS
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version  # 应该显示 v22.x.x
npm --version
```

#### 方法 3: 使用 nvm 管理多版本（开发环境推荐）

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重新加载配置
source ~/.bashrc  # 或 source ~/.zshrc

# 安装 Node.js 24.14
nvm install 24.14

# 设置为默认版本
nvm alias default 24.14

# 验证安装
node --version  # 应该显示 v24.14.x
npm --version
```

#### 方法 4: 安装 Node.js 18.x（最低要求）

**Ubuntu/Debian 系统：**

```bash
# 更新包管理器
sudo apt update

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

**CentOS/RHEL 系统：**

```bash
# 安装 Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 步骤 2: 上传项目文件

#### 方法 1: 使用 FTP/SFTP 工具

使用 FileZilla、WinSCP 等工具上传整个 `seoapi-nodejs` 文件夹到服务器

推荐路径：`/home/your-user/seoapi-nodejs`

#### 方法 2: 使用 Git（推荐）

```bash
# 如果项目在 Git 仓库
cd /home/your-user
git clone your-repo-url seoapi-nodejs
cd seoapi-nodejs
```

#### 方法 3: 使用 scp 命令

```bash
# 在本地电脑执行（Windows 用 Git Bash）
scp -r seoapi-nodejs your-user@your-server-ip:/home/your-user/
```

### 步骤 3: 启动服务

```bash
# 进入项目目录
cd /home/your-user/seoapi-nodejs

# 安装依赖
npm install

# 添加执行权限
chmod +x start.sh stop.sh

# 启动服务
./start.sh
```

## ✅ 启动成功

看到以下输出表示成功：

```
========================================
  SEO API - Claude AI 文本改写服务
========================================

服务地址: http://localhost:8000
API 文档: http://localhost:8000/api/docs
Web 界面: http://localhost:8000

按 Ctrl+C 停止服务
========================================

API Key 状态: ✗ 未配置
```

## 🔧 配置 API Key

### 方法 1: Web 界面配置（推荐）

1. 在浏览器访问：`http://服务器IP:8000`
2. 点击"配置"标签
3. 输入 Claude API Key
4. 点击"保存配置"

### 方法 2: 环境变量配置

```bash
# 编辑 .env 文件
nano .env

# 添加以下内容
CLAUDE_API_KEY=sk-ant-your-api-key-here
PORT=8000

# 保存并退出（Ctrl+X, Y, Enter）

# 重启服务
./stop.sh
./start.sh
```

## 🌐 外网访问配置

### 1. 开放防火墙端口

#### Ubuntu/Debian (UFW)

```bash
# 开放 8000 端口
sudo ufw allow 8000

# 查看状态
sudo ufw status
```

#### CentOS/RHEL (firewalld)

```bash
# 开放 8000 端口
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-ports
```

### 2. 云服务器安全组

如果使用阿里云/腾讯云/AWS 等，需要在控制台添加安全组规则：

```
类型: 自定义 TCP
端口: 8000
来源: 0.0.0.0/0 (允许所有 IP)
```

### 3. 测试外网访问

```bash
# 在本地电脑浏览器访问
http://你的服务器公网IP:8000
```

## 🔄 后台运行（重要！）

### 方法 1: 使用 PM2（强烈推荐）

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务
pm2 start server.js --name seoapi

# 查看状态
pm2 status

# 查看日志
pm2 logs seoapi

# 停止服务
pm2 stop seoapi

# 重启服务
pm2 restart seoapi

# 开机自启
pm2 startup
pm2 save
```

**PM2 常用命令：**

```bash
pm2 list              # 查看所有进程
pm2 logs seoapi       # 查看日志
pm2 logs seoapi --lines 100  # 查看最近100行
pm2 monit             # 实时监控
pm2 restart seoapi    # 重启
pm2 stop seoapi       # 停止
pm2 delete seoapi     # 删除
```

### 方法 2: 使用 nohup

```bash
# 后台启动
nohup node server.js > seoapi.log 2>&1 &

# 查看日志
tail -f seoapi.log

# 停止服务
ps aux | grep node
kill -9 进程ID
```

### 方法 3: 使用 systemd（推荐生产环境）

```bash
# 创建服务文件
sudo nano /etc/systemd/system/seoapi.service
```

添加以下内容：

```ini
[Unit]
Description=SEO API Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/home/your-user/seoapi-nodejs
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
# 重载配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start seoapi

# 查看状态
sudo systemctl status seoapi

# 开机自启
sudo systemctl enable seoapi

# 查看日志
sudo journalctl -u seoapi -f
```

**systemd 常用命令：**

```bash
sudo systemctl start seoapi    # 启动
sudo systemctl stop seoapi     # 停止
sudo systemctl restart seoapi  # 重启
sudo systemctl status seoapi   # 状态
sudo journalctl -u seoapi -f   # 日志
```

## 🔒 使用 Nginx 反向代理（可选）

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置 Nginx

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/seoapi
```

添加以下内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/seoapi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# CentOS/RHEL
sudo nginx -t
sudo systemctl restart nginx
```

现在可以通过 `http://your-domain.com` 访问（不需要端口号）

## 📊 监控和维护

### 查看服务状态

```bash
# PM2
pm2 status

# systemd
sudo systemctl status seoapi

# 手动检查
curl http://localhost:8000/health
```

### 查看日志

```bash
# PM2
pm2 logs seoapi --lines 100

# systemd
sudo journalctl -u seoapi -n 100

# nohup
tail -f seoapi.log
```

### 查看资源占用

```bash
# 查看内存和 CPU
pm2 monit

# 或使用 top
top
# 按 Shift+M 按内存排序
# 按 Shift+P 按 CPU 排序
```

## 🔄 更新服务

### 更新代码

```bash
# 停止服务
pm2 stop seoapi
# 或
sudo systemctl stop seoapi

# 更新代码（如果使用 Git）
git pull

# 或重新上传文件

# 安装新依赖（如果有）
npm install

# 启动服务
pm2 start seoapi
# 或
sudo systemctl start seoapi
```

### 更新 Node.js

```bash
# 查看当前版本
node --version

# 更新到最新 LTS 版本
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# 重启服务
pm2 restart seoapi
```

## 🐛 故障排查

### 问题 1: 端口被占用

```bash
# 查看端口占用
sudo lsof -i :8000
# 或
sudo netstat -tulpn | grep 8000

# 杀死进程
sudo kill -9 进程ID

# 或修改端口
nano .env
# 修改 PORT=8001
```

### 问题 2: 权限问题

```bash
# 确保文件有执行权限
chmod +x start.sh stop.sh

# 确保目录权限正确
sudo chown -R your-user:your-user /home/your-user/seoapi-nodejs
```

### 问题 3: Node.js 未找到

```bash
# 查找 Node.js 路径
which node

# 如果找不到，添加到 PATH
echo 'export PATH=$PATH:/usr/bin' >> ~/.bashrc
source ~/.bashrc
```

### 问题 4: 依赖安装失败

```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### 问题 5: 服务无法访问

```bash
# 检查服务是否运行
pm2 status
# 或
sudo systemctl status seoapi

# 检查防火墙
sudo ufw status
# 或
sudo firewall-cmd --list-ports

# 检查端口监听
sudo netstat -tulpn | grep 8000

# 测试本地访问
curl http://localhost:8000/health
```

## 📝 完整部署脚本

创建一个自动部署脚本：

```bash
# 创建脚本
nano deploy.sh
```

添加以下内容：

```bash
#!/bin/bash

echo "========================================="
echo "  SEO API 自动部署脚本"
echo "========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "安装 PM2..."
    sudo npm install -g pm2
fi

# 安装依赖
echo "安装依赖..."
npm install

# 配置文件
if [ ! -f .env ]; then
    echo "创建配置文件..."
    cp .env.example .env
    echo "请编辑 .env 文件配置 API Key"
fi

# 开放防火墙
echo "配置防火墙..."
sudo ufw allow 8000 2>/dev/null || true

# 启动服务
echo "启动服务..."
pm2 start server.js --name seoapi
pm2 save
pm2 startup

echo "========================================="
echo "  部署完成！"
echo "========================================="
echo "访问地址: http://$(hostname -I | awk '{print $1}'):8000"
echo ""
echo "常用命令:"
echo "  pm2 status        - 查看状态"
echo "  pm2 logs seoapi   - 查看日志"
echo "  pm2 restart seoapi - 重启服务"
echo "========================================="
```

使用脚本：

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🎯 推荐配置

### 小型项目（1-100 次/天）

```bash
# 使用 PM2
pm2 start server.js --name seoapi
```

### 中型项目（100-1000 次/天）

```bash
# 使用 PM2 + Nginx
pm2 start server.js --name seoapi -i 2  # 2个进程
# 配置 Nginx 反向代理
```

### 大型项目（1000+ 次/天）

```bash
# 使用 PM2 集群模式 + Nginx
pm2 start server.js --name seoapi -i max  # 最大进程数
# 配置 Nginx 负载均衡
```

## 📞 快速命令参考

```bash
# 启动服务
./start.sh                    # 前台运行
pm2 start server.js --name seoapi  # 后台运行

# 停止服务
./stop.sh                     # 停止前台
pm2 stop seoapi              # 停止后台

# 查看状态
pm2 status                   # PM2 状态
curl http://localhost:8000/health  # 健康检查

# 查看日志
pm2 logs seoapi              # 实时日志
pm2 logs seoapi --lines 100  # 最近100行

# 重启服务
pm2 restart seoapi           # 重启

# 开机自启
pm2 startup                  # 生成启动脚本
pm2 save                     # 保存当前进程列表
```

## 🎉 部署完成

现在你可以：

✅ 通过 `http://服务器IP:8000` 访问 Web 界面
✅ 配置 Claude API Key
✅ 在小旋风中配置 API 地址
✅ 开始使用伪原创服务

**下一步：** 参考 [小旋风配置教程.md](./小旋风配置教程.md) 配置小旋风
