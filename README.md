# SEO API - Claude AI 文本改写服务

基于 Node.js + Express + Claude AI 的智能文本改写服务，支持多种改写模式，兼容小旋风伪原创 API。

> 🚨 **遇到问题？** 查看 [小旋风问题诊断卡.txt](./小旋风问题诊断卡.txt) 快速诊断

## 📋 系统要求

- **Node.js**: 18.0.0 或更高版本
  - ✅ Node.js 24.14 - 完全支持，推荐使用
  - ✅ Node.js 22.x LTS - 完全支持，生产环境推荐
  - ✅ Node.js 20.x - 完全支持
  - ✅ Node.js 18.x - 最低要求版本
- **npm**: 8.0.0 或更高版本
- **操作系统**: Windows / Linux / macOS

> 💡 推荐使用 Node.js 24.14 或 22.x LTS 以获得最佳性能和稳定性

## ✨ 主要特性

- ✅ **多种改写模式** - 标准、创意、正式、简化、翻译等13+种模式
- ✅ **反 AI 检测** - 专门优化的仿人类写作模式
- ✅ **用户认证系统** - 每个用户独立的 API Key 和 Claude API Key
- ✅ **Web 管理界面** - 可视化配置和管理
- ✅ **默认配置** - Web 后台设置默认模型和改写模式
- ✅ **小旋风兼容** - 完全兼容小旋风伪原创 API 格式
- ✅ **自定义模式** - 通过 Web 界面自定义改写提示词
- ✅ **多用户管理** - 管理员可以创建和管理多个用户
- ✅ **跨平台支持** - Windows 和 Linux 都可运行

## 🚀 快速开始

### 0. 检查 Node.js 版本

```bash
node --version
# 应该显示 v18.0.0 或更高版本
# 推荐: v24.14.x 或 v22.x.x
```

如果版本过低，请先升级 Node.js：
- 官方下载：https://nodejs.org/
- 使用 nvm：`nvm install 24.14`

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量（可选）

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件（可选，也可以在 Web 界面配置）：

```env
PORT=8000
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_BASE_URL=https://api.api123.icu
```

**注意：** 系统默认使用 `https://api.api123.icu` 作为 Claude API 的中转地址，无需修改。

### 3. 启动服务

**Windows:**
```bash
start.bat
```

**Linux:**
```bash
./start.sh
```

**手动启动:**
```bash
node server.js
```

### 4. 访问 Web 界面

打开浏览器访问：`http://localhost:8000`

**默认管理员账号：**
```
用户名: admin
密码: admin123
```

**重要：** 首次登录后请立即修改密码！

## ⚠️ 重要提示：小旋风长文本问题

如果你遇到：
- ✅ 短文本改写成功
- ❌ 长文本改写失败（服务器显示成功，小旋风显示失败）

**原因：** 小旋风对响应体有大小限制（约 1300-1500 字符）

**解决方案：**
1. ⭐ **在小旋风采集规则中限制文本长度为 800 字符**（最简单有效）
2. 在 post 格式中添加 `compact=1` 参数压缩输出
3. 使用分段改写处理超长文章

详细说明：[README-长文本问题.md](./README-长文本问题.md)

## 📖 详细文档

### 快速入门
- [快速开始.md](./快速开始.md) - 新手入门指南
- [认证系统说明.md](./认证系统说明.md) - 用户认证和 API Key 管理
- [小旋风配置教程.md](./小旋风配置教程.md) - 小旋风集成配置

### 故障排查
- [README-长文本问题.md](./README-长文本问题.md) - 长文本改写失败解决方案 ⭐
- [小旋风长文本快速修复.txt](./小旋风长文本快速修复.txt) - 快速参考卡片
- [小旋风长文本问题解决方案.md](./小旋风长文本问题解决方案.md) - 完整技术文档
- [Linux部署教程.md](./Linux部署教程.md) - Linux 服务器部署
- [Web配置说明.md](./Web配置说明.md) - Web 界面使用说明
- [如何自定义改写模式.md](./如何自定义改写模式.md) - 自定义改写模式
- [AI检测说明.md](./AI检测说明.md) - AI 检测风险和应对

## 🔐 认证系统

### API Key 认证

每个用户都有独立的 API Key，用于 API 调用认证。

**三种认证方式：**

1. **Header 认证（推荐）**
```bash
curl -X POST http://localhost:8000/api/rewrite \
  -H "Authorization: sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"txt":"测试文本","mode":"humanlike"}'
```

2. **请求体认证**
```bash
curl -X POST http://localhost:8000/api/rewrite \
  -H "Content-Type: application/json" \
  -d '{"txt":"测试文本","mode":"humanlike","api_key":"sk_your_api_key"}'
```

3. **URL 参数认证**
```bash
curl -X POST "http://localhost:8000/api/rewrite?api_key=sk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{"txt":"测试文本","mode":"humanlike"}'
```

### 获取 API Key

1. 登录 Web 界面
2. 进入"配置"标签页
3. 查看"你的 API Key"区域
4. 点击"复制"按钮

### 配置 Claude API Key

每个用户需要配置自己的 Claude API Key：

1. 登录 Web 界面
2. 进入"配置"标签页
3. 在"Claude API Key"输入框输入你的 API Key
4. 点击"保存 Claude API Key"

## 📝 API 接口

### 文本改写接口

**POST** `/api/rewrite`

**请求参数：**

```json
{
  "txt": "要改写的文本内容",
  "mode": "humanlike",
  "model": "claude-3-sonnet-20240229",
  "sim": 1
}
```

**参数说明：**

- `txt` - 要改写的文本（必填）
- `mode` - 改写模式（可选，默认 standard）
- `model` - Claude 模型（可选，默认 claude-3-sonnet-20240229）
- `sim` - 是否返回相似度（可选，1=返回，0=不返回）

**返回格式（5118 兼容）：**

```json
{
  "errcode": "0",
  "errmsg": "",
  "data": "改写后的文本内容",
  "like": "0.5521",
  "_meta": {
    "mode": "humanlike",
    "model": "claude-3-sonnet-20240229",
    "duration": 2.5,
    "usage": {
      "input_tokens": 100,
      "output_tokens": 150
    }
  }
}
```

### 改写模式列表

| 模式 ID | 名称 | 说明 | 反 AI 检测 |
|---------|------|------|-----------|
| standard | 标准改写 | 保持原意，改变表达 | ❌ |
| humanlike | 仿人类写作 | 降低 AI 检测风险 | ✅ |
| mixed | 混合改写 | 多种技巧结合 | ✅ |
| deep | 深度重写 | 完全重构内容 | ✅ |
| creative | 创意改写 | 更生动有趣的表达 | ❌ |
| formal | 正式改写 | 商务/学术风格 | ❌ |
| simple | 简化改写 | 通俗易懂 | ❌ |
| translate_cn | 翻译改写 | 通过翻译达到改写效果 | ❌ |
| seo | SEO 优化 | 适合搜索引擎优化 | ❌ |
| storytelling | 故事化 | 叙事风格 | ❌ |
| xiaohongshu | 小红书风格 | 适合小红书平台 | ❌ |
| wechat | 微信公众号 | 适合微信推文 | ❌ |
| news | 新闻报道 | 新闻风格 | ❌ |

**更多模式可以通过 Web 界面自定义添加！**

### 支持的模型

| 模型 ID | 名称 | 价格（输入/输出） | 说明 |
|---------|------|------------------|------|
| claude-haiku-4-5-20251001 | Claude Haiku 4.5 | $10/$50 per M | 最快速，成本最低 |
| claude-sonnet-4-5-20250929 | Claude Sonnet 4.5 | $10/$50 per M | 平衡性能和成本（推荐）⭐ |
| claude-sonnet-4-5-20250929-thinking | Claude Sonnet 4.5 Thinking | $10/$50 per M | 思考模式，更深入分析 |
| claude-sonnet-4-6 | Claude Sonnet 4.6 | $10/$50 per M | 最新 Sonnet 版本 |
| claude-opus-4-5 | Claude Opus 4.5 | $10/$50 per M | 强大性能 |
| claude-opus-4-5-20251101-thinking | Claude Opus 4.5 Thinking | $10/$50 per M | 思考模式，最强分析 |
| claude-opus-4-6 | Claude Opus 4.6 | $10/$50 per M | 顶级性能 |

**推荐使用 Claude Sonnet 4.5**，性能和成本平衡最佳。

**Thinking 模式说明**：带 "Thinking" 后缀的模型会进行更深入的思考和分析，适合复杂的改写任务，但响应时间会稍长。

## 🔧 小旋风配置

### 配置示例

```
API名称: Claude AI 伪原创
API地址: http://your-server:8000/api/rewrite
post格式: txt={word}&mode=humanlike&sim=1
Authorization: sk_your_api_key_here
成功标志: errcode=0
返回错误的字段: errmsg
伪原创后的内容字段: data
```

**重要：**
1. 在 Authorization 字段填入你的 API Key
2. `{word}` 是小旋风的变量，不要修改
3. 可以修改 `mode` 参数选择不同的改写模式

详细配置请参考：[小旋风配置教程.md](./小旋风配置教程.md)

## 🎨 自定义改写模式

### 通过 Web 界面

1. 登录 Web 界面
2. 进入"模式管理"标签页
3. 点击"+ 添加新模式"
4. 填写模式信息和改写指令
5. 保存并测试

### 通过配置文件

编辑 `config/rewrite-modes.js` 文件：

```javascript
module.exports = {
    my_custom_mode: {
        name: '我的自定义模式',
        description: '这是我的自定义改写模式',
        antiAI: false,
        builtin: false,
        prompt: '请将以下文本改写成...'
    }
};
```

详细说明请参考：[如何自定义改写模式.md](./如何自定义改写模式.md)

## 👥 多用户管理

### 管理员功能

管理员可以：

- ✅ 创建新用户
- ✅ 查看所有用户
- ✅ 删除用户（不能删除 admin）
- ✅ 查看用户的 API Key

### 创建新用户

1. 以管理员身份登录
2. 进入"用户管理"标签页
3. 点击"添加用户"
4. 填写用户名、密码、Claude API Key（可选）
5. 系统自动生成该用户的 API Key

### 用户权限

- **管理员（admin）** - 可以管理所有用户
- **普通用户（user）** - 只能使用改写功能和管理自己的配置

## 🔒 安全建议

### 1. 修改默认密码

```
首次登录后立即修改 admin 密码
```

### 2. 定期更换 API Key

```
如果 API Key 泄露，可以在配置页面重新生成
```

### 3. 使用 HTTPS

```
生产环境建议配置 HTTPS
参考 Linux部署教程.md 中的 Nginx 配置
```

### 4. 限制访问

```
可以在防火墙层面限制访问 IP
只允许信任的 IP 访问
```

### 5. 备份数据

```
定期备份 data 目录
包含用户信息和会话数据
```

## 🐛 常见问题

### Q1: 访问 localhost:8000 没有登录窗口？

**A:** 
1. 确认服务已启动：`Get-Process -Name node`（Windows）或 `ps aux | grep node`（Linux）
2. 清除浏览器缓存
3. 尝试访问：`http://localhost:8000/login.html`
4. 检查浏览器控制台是否有错误

### Q2: 登录后提示"会话已过期"？

**A:** 清除浏览器的 localStorage：
```javascript
// 在浏览器控制台执行
localStorage.clear();
location.reload();
```

### Q3: 改写时提示"用户未配置 Claude API Key"？

**A:** 在配置页面输入你的 Claude API Key

### Q4: 小旋风调用 API 失败？

**A:** 检查以下几点：
1. 确认 Authorization 字段填写了正确的 API Key
2. 确认 API 地址正确
3. 确认 post 格式为：`txt={word}&mode=humanlike&sim=1`
4. 确认成功标志为：`errcode=0`
5. 确认返回字段为：`data`

### Q5: 忘记密码怎么办？

**A:** 删除 `data/users.json` 文件，重启服务会重新创建默认管理员账号

### Q6: 如何停止服务？

**Windows:**
```bash
stop.bat
```

**Linux:**
```bash
./stop.sh
```

**手动停止:**
```bash
# Windows
Stop-Process -Name node -Force

# Linux
pkill node
```

## 📊 错误码说明

| 错误码 | 说明 | 解决方法 |
|--------|------|---------|
| 0 | 成功 | - |
| 100102 | 服务每秒调用量超限 | 降低请求频率 |
| 100202 | 请求缺少 apikey | 添加 API Key |
| 100203 | 无效的 apikey | 检查 API Key 是否正确 |
| 100203 | 用户未配置 Claude API Key | 在 Web 界面配置 Claude API Key |
| 100301 | 改写失败 | 检查网络和 Claude API Key |
| 200201 | 传进参数为空 | 检查请求参数 |
| 200500 | 内容长度超过5000字符 | 减少文本长度 |

## 🌐 部署到生产环境

### Linux 服务器部署

详细步骤请参考：[Linux部署教程.md](./Linux部署教程.md)

**简要步骤：**

1. 安装 Node.js
2. 上传代码到服务器
3. 安装依赖：`npm install`
4. 配置环境变量
5. 使用 PM2 管理进程
6. 配置 Nginx 反向代理
7. 配置 HTTPS（可选）

### 使用 PM2 管理

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name seoapi

# 查看状态
pm2 status

# 查看日志
pm2 logs seoapi

# 重启服务
pm2 restart seoapi

# 停止服务
pm2 stop seoapi
```

## 📁 项目结构

```
seoapi-nodejs/
├── server.js                    # 主服务器文件
├── package.json                 # 依赖配置
├── .env                         # 环境变量（需创建）
├── .env.example                 # 环境变量示例
├── config/
│   └── rewrite-modes.js         # 改写模式配置
├── data/
│   ├── users.json               # 用户数据
│   └── sessions.json            # 会话数据
├── public/
│   ├── index.html               # 主界面
│   └── login.html               # 登录页面
├── start.bat                    # Windows 启动脚本
├── start.sh                     # Linux 启动脚本
├── stop.bat                     # Windows 停止脚本
├── stop.sh                      # Linux 停止脚本
└── docs/
    ├── README.md                # 本文档
    ├── 快速开始.md
    ├── 认证系统说明.md
    ├── 小旋风配置教程.md
    ├── Linux部署教程.md
    ├── Web配置说明.md
    ├── 如何自定义改写模式.md
    └── AI检测说明.md
```

## 🤝 技术支持

如有问题，请查看详细文档或提交 Issue。

## 📄 许可证

MIT License

## 🎉 开始使用

现在你可以：

1. ✅ 启动服务
2. ✅ 访问 `http://localhost:8000` 登录
3. ✅ 配置 Claude API Key
4. ✅ 开始改写文本
5. ✅ 配置小旋风集成
6. ✅ 自定义改写模式

祝使用愉快！🚀
