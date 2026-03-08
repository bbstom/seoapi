/**
 * SEO API - Claude AI 文本改写服务
 * Node.js + Express 版本
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 加载改写模式配置
const rewriteModesConfig = require('./config/rewrite-modes');

const app = express();
const PORT = process.env.PORT || 8000;

// 配置 trust proxy（根据环境自动调整）
// 生产环境：信任 1 层代理（Nginx）
// 开发环境：信任本地代理
if (process.env.NODE_ENV === 'production') {
    // 生产环境：只信任 1 层代理（更安全）
    app.set('trust proxy', 1);
    console.log('Trust proxy: 1 (生产环境)');
} else {
    // 开发环境：信任本地代理
    app.set('trust proxy', 'loopback');
    console.log('Trust proxy: loopback (开发环境)');
}

// 速率限制配置
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 最多5次尝试
    message: { success: false, error: '登录尝试次数过多，请15分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1分钟
    max: 60, // 最多60次请求
    message: { errcode: '100102', errmsg: '请求频率过高，请稍后再试', data: '' },
    standardHeaders: true,
    legacyHeaders: false,
});

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 修复双斜杠问题（兼容小旋风）
app.use((req, res, next) => {
    if (req.url.startsWith('//')) {
        req.url = req.url.substring(1);
    }
    next();
});

// 静态文件
app.use(express.static('public'));

// 用户数据文件路径
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'data', 'sessions.json');

// 确保数据目录存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

// 初始化用户数据
function initUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        const defaultUsers = {
            admin: {
                username: 'admin',
                password: hashPasswordSync('admin123'),
                apiKey: generateApiKey(),
                role: 'admin',
                createdAt: new Date().toISOString(),
                claudeApiKey: process.env.CLAUDE_API_KEY || '',
                claudeBaseURL: process.env.CLAUDE_BASE_URL || 'https://api.api123.icu',
                defaultModel: 'claude-sonnet-4-5-20250929',
                defaultMode: 'humanlike'
            }
        };
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        console.log('默认管理员账号已创建：');
        console.log('用户名: admin');
        console.log('密码: admin123');
        console.log('API Key:', defaultUsers.admin.apiKey);
    }
}

// 初始化会话数据
function initSessions() {
    if (!fs.existsSync(SESSIONS_FILE)) {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify({}, null, 2));
    }
}

// 读取用户数据
function getUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (error) {
        return {};
    }
}

// 保存用户数据
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// 读取会话数据
function getSessions() {
    try {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    } catch (error) {
        return {};
    }
}

// 保存会话数据
function saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// 密码哈希（使用 bcrypt，更安全）
function hashPasswordSync(password) {
    return bcrypt.hashSync(password, 10);
}

async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// 生成 API Key
function generateApiKey() {
    return 'sk_' + crypto.randomBytes(32).toString('hex');
}

// 生成会话 Token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 验证 API Key 中间件
function verifyApiKey(req, res, next) {
    // 支持多种认证方式（兼容 5118 格式）
    let apiKey = null;
    
    // 方式 1: Authorization header
    if (req.headers['authorization']) {
        apiKey = req.headers['authorization'];
    }
    // 方式 2: apikey header (5118 格式)
    else if (req.headers['apikey']) {
        apiKey = req.headers['apikey'];
    }
    // 方式 3: 请求体中的 api_key
    else if (req.body.api_key) {
        apiKey = req.body.api_key;
    }
    // 方式 4: 请求体中的 apikey (5118 格式)
    else if (req.body.apikey) {
        apiKey = req.body.apikey;
    }
    // 方式 5: URL 参数
    else if (req.query.api_key) {
        apiKey = req.query.api_key;
    }
    else if (req.query.apikey) {
        apiKey = req.query.apikey;
    }
    
    if (!apiKey) {
        return res.json({
            errcode: '100202',
            errmsg: '请求缺少 apikey',
            data: ''
        });
    }
    
    const users = getUsers();
    const user = Object.values(users).find(u => u.apiKey === apiKey);
    
    if (!user) {
        return res.json({
            errcode: '100203',
            errmsg: '无效的 apikey',
            data: ''
        });
    }
    
    req.user = user;
    next();
}

// 验证会话 Token 中间件（用于 Web 界面）
function verifySession(req, res, next) {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '未登录'
        });
    }
    
    const sessions = getSessions();
    const session = sessions[token];
    
    if (!session || new Date(session.expiresAt) < new Date()) {
        return res.status(401).json({
            success: false,
            error: '会话已过期，请重新登录'
        });
    }
    
    const users = getUsers();
    req.user = users[session.username];
    next();
}

// 初始化
initUsers();
initSessions();

// 全局配置
let config = {
    apiKey: process.env.CLAUDE_API_KEY || '',
    baseURL: process.env.CLAUDE_BASE_URL || 'https://api.api123.icu'
};

// 从配置文件构建改写提示词映射
const REWRITE_PROMPTS = {};
for (const [key, value] of Object.entries(rewriteModesConfig)) {
    REWRITE_PROMPTS[key] = value.prompt;
}

// 获取 Claude 客户端
function getClaudeClient(apiKey) {
    const key = apiKey || config.apiKey;
    if (!key) {
        throw new Error('未配置 API Key');
    }
    
    return new Anthropic({
        apiKey: key,
        baseURL: config.baseURL !== 'https://api.anthropic.com' ? config.baseURL : undefined
    });
}

// 路由：首页
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <html>
                <body>
                    <h1>SEO API 服务运行中</h1>
                    <p>API 文档: <a href="/api/docs">/api/docs</a></p>
                    <p>健康检查: <a href="/health">/health</a></p>
                </body>
            </html>
        `);
    }
});

// ========== 认证相关路由 ==========

// 路由：登录（添加速率限制）
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.json({
                success: false,
                error: '请输入用户名和密码'
            });
        }
        
        const users = getUsers();
        const user = users[username];
        
        if (!user) {
            return res.json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        
        // 使用 bcrypt 验证密码
        const isValid = await verifyPassword(password, user.password);
        
        if (!isValid) {
            return res.json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        
        // 创建会话
        const token = generateSessionToken();
        const sessions = getSessions();
        sessions[token] = {
            username: username,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天过期
        };
        saveSessions(sessions);
        
        console.log(`用户 ${username} 登录成功`);
        
        res.json({
            success: true,
            token: token,
            user: {
                username: user.username,
                role: user.role,
                apiKey: user.apiKey
            }
        });
        
    } catch (error) {
        console.error('登录失败:', error);
        res.json({
            success: false,
            error: '登录失败'
        });
    }
});

// 路由：登出
app.post('/api/auth/logout', verifySession, (req, res) => {
    try {
        const token = req.headers['x-session-token'];
        const sessions = getSessions();
        delete sessions[token];
        saveSessions(sessions);
        
        res.json({
            success: true,
            message: '已登出'
        });
    } catch (error) {
        res.json({
            success: false,
            error: '登出失败'
        });
    }
});

// 路由：获取当前用户信息
app.get('/api/auth/me', verifySession, (req, res) => {
    res.json({
        success: true,
        user: {
            username: req.user.username,
            role: req.user.role,
            apiKey: req.user.apiKey,
            claudeApiKey: req.user.claudeApiKey ? '已配置' : '未配置',
            claudeBaseURL: req.user.claudeBaseURL || 'https://api.api123.icu',
            defaultModel: req.user.defaultModel || 'claude-sonnet-4-5-20250929',
            defaultMode: req.user.defaultMode || 'humanlike'
        }
    });
});

// 路由：修改密码
app.post('/api/auth/change-password', verifySession, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        if (!oldPassword || !newPassword) {
            return res.json({
                success: false,
                error: '请输入旧密码和新密码'
            });
        }
        
        if (newPassword.length < 6) {
            return res.json({
                success: false,
                error: '新密码长度至少6位'
            });
        }
        
        const users = getUsers();
        const user = users[req.user.username];
        
        // 使用 bcrypt 验证旧密码
        const isValid = await verifyPassword(oldPassword, user.password);
        
        if (!isValid) {
            return res.json({
                success: false,
                error: '旧密码错误'
            });
        }
        
        // 使用 bcrypt 哈希新密码
        user.password = await hashPassword(newPassword);
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 修改密码成功`);
        
        res.json({
            success: true,
            message: '密码修改成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '修改密码失败'
        });
    }
});

// ========== 用户管理路由（需要管理员权限）==========

// 路由：获取所有用户（管理员）
app.get('/api/users', verifySession, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }
    
    const users = getUsers();
    const userList = Object.values(users).map(u => ({
        username: u.username,
        role: u.role,
        apiKey: u.apiKey,
        createdAt: u.createdAt,
        claudeApiKey: u.claudeApiKey ? '已配置' : '未配置'
    }));
    
    res.json({
        success: true,
        users: userList
    });
});

// 路由：创建用户（管理员）
app.post('/api/users', verifySession, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }
    
    try {
        const { username, password, claudeApiKey } = req.body;
        
        if (!username || !password) {
            return res.json({
                success: false,
                error: '请输入用户名和密码'
            });
        }
        
        const users = getUsers();
        
        if (users[username]) {
            return res.json({
                success: false,
                error: '用户名已存在'
            });
        }
        
        const apiKey = generateApiKey();
        users[username] = {
            username: username,
            password: await hashPassword(password),
            apiKey: apiKey,
            role: 'user',
            createdAt: new Date().toISOString(),
            claudeApiKey: claudeApiKey || '',
            claudeBaseURL: 'https://api.api123.icu'
        };
        
        saveUsers(users);
        
        console.log(`管理员 ${req.user.username} 创建用户 ${username}`);
        
        res.json({
            success: true,
            message: '用户创建成功',
            user: {
                username: username,
                apiKey: apiKey
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '创建用户失败'
        });
    }
});

// 路由：删除用户（管理员）
app.delete('/api/users/:username', verifySession, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }
    
    try {
        const username = req.params.username;
        
        if (username === 'admin') {
            return res.json({
                success: false,
                error: '不能删除管理员账号'
            });
        }
        
        const users = getUsers();
        
        if (!users[username]) {
            return res.json({
                success: false,
                error: '用户不存在'
            });
        }
        
        delete users[username];
        saveUsers(users);
        
        console.log(`管理员 ${req.user.username} 删除用户 ${username}`);
        
        res.json({
            success: true,
            message: '用户删除成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '删除用户失败'
        });
    }
});

// 路由：更新用户 Claude API Key
app.post('/api/users/claude-key', verifySession, (req, res) => {
    try {
        const { claudeApiKey } = req.body;
        
        if (!claudeApiKey) {
            return res.json({
                success: false,
                error: '请输入 Claude API Key'
            });
        }
        
        const users = getUsers();
        users[req.user.username].claudeApiKey = claudeApiKey;
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 更新 Claude API Key`);
        
        res.json({
            success: true,
            message: 'Claude API Key 更新成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '更新失败'
        });
    }
});

// 路由：更新用户 Claude Base URL
app.post('/api/users/claude-baseurl', verifySession, (req, res) => {
    try {
        const { claudeBaseURL } = req.body;
        
        if (!claudeBaseURL) {
            return res.json({
                success: false,
                error: '请输入 Claude API 地址'
            });
        }
        
        // 验证 URL 格式
        try {
            new URL(claudeBaseURL);
        } catch (e) {
            return res.json({
                success: false,
                error: 'URL 格式不正确'
            });
        }
        
        const users = getUsers();
        users[req.user.username].claudeBaseURL = claudeBaseURL;
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 更新 Claude Base URL: ${claudeBaseURL}`);
        
        res.json({
            success: true,
            message: 'Claude API 地址更新成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '更新失败'
        });
    }
});

// 路由：更新用户默认模型和模式
app.post('/api/users/defaults', verifySession, (req, res) => {
    try {
        const { defaultModel, defaultMode } = req.body;
        
        const users = getUsers();
        
        if (defaultModel) {
            users[req.user.username].defaultModel = defaultModel;
        }
        
        if (defaultMode) {
            users[req.user.username].defaultMode = defaultMode;
        }
        
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 更新默认配置 - 模型: ${defaultModel}, 模式: ${defaultMode}`);
        
        res.json({
            success: true,
            message: '默认配置更新成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '更新失败'
        });
    }
});

// 路由：重新生成 API Key
app.post('/api/users/regenerate-key', verifySession, (req, res) => {
    try {
        const users = getUsers();
        const newApiKey = generateApiKey();
        users[req.user.username].apiKey = newApiKey;
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 重新生成 API Key`);
        
        res.json({
            success: true,
            apiKey: newApiKey,
            message: 'API Key 已重新生成'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '生成失败'
        });
    }
});

// 路由：健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        api_key_configured: !!config.apiKey
    });
});

// 路由：文本改写（兼容 5118 格式和标准格式）- 需要 API Key + 速率限制
app.post('/api/rewrite', apiLimiter, verifyApiKey, async (req, res) => {
    const requestId = crypto.randomBytes(8).toString('hex'); // 生成请求 ID
    const startTime = Date.now();
    
    try {
        // 记录详细的请求信息
        console.log('========================================');
        console.log(`[请求 ${requestId}] 收到改写请求`);
        console.log(`[请求 ${requestId}] 用户: ${req.user.username}`);
        console.log(`[请求 ${requestId}] 客户端 IP: ${req.ip}`);
        console.log(`[请求 ${requestId}] User-Agent: ${req.headers['user-agent'] || 'Unknown'}`);
        console.log(`[请求 ${requestId}] Content-Type: ${req.headers['content-type']}`);
        console.log(`[请求 ${requestId}] 请求头:`, JSON.stringify({
            'authorization': req.headers['authorization'] ? '***' : 'None',
            'apikey': req.headers['apikey'] ? '***' : 'None',
            'x-forwarded-for': req.headers['x-forwarded-for'] || 'None',
            'x-real-ip': req.headers['x-real-ip'] || 'None'
        }));
        console.log(`[请求 ${requestId}] 请求体参数:`, JSON.stringify({
            text_length: (req.body.text || req.body.txt || '').length,
            mode: req.body.mode || 'default',
            model: req.body.model || 'default',
            sim: req.body.sim
        }));
        
        // 兼容多种参数格式，使用用户配置的默认值
        const text = req.body.text || req.body.txt || '';
        const mode = req.body.mode || req.user.defaultMode || 'humanlike';
        const model = req.body.model || req.user.defaultModel || 'claude-sonnet-4-5-20250929';
        const returnSimilarity = req.body.sim === 1 || req.body.sim === '1';
        
        console.log(`[请求 ${requestId}] 解析后参数: 文本长度=${text.length}, 模式=${mode}, 模型=${model}, 返回相似度=${returnSimilarity}`);
        
        if (!text || !text.trim()) {
            console.log(`[请求 ${requestId}] ❌ 错误: 文本为空`);
            // 5118 格式错误返回
            return res.json({
                errcode: '200201',
                errmsg: '传进参数为空',
                data: ''
            });
        }
        
        if (text.length > 5000) {
            console.log(`[请求 ${requestId}] ❌ 错误: 文本长度超限 (${text.length} > 5000)`);
            return res.json({
                errcode: '200500',
                errmsg: '内容长度不能超过5000个字符',
                data: ''
            });
        }
        
        console.log(`[请求 ${requestId}] ✓ 参数验证通过`);
        console.log(`[请求 ${requestId}] 文本预览: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
        
        // 使用用户的 Claude API Key
        if (!req.user.claudeApiKey) {
            console.log(`[请求 ${requestId}] ❌ 错误: 用户未配置 Claude API Key`);
            return res.json({
                errcode: '100203',
                errmsg: '用户未配置 Claude API Key',
                data: ''
            });
        }
        
        console.log(`[请求 ${requestId}] ✓ Claude API Key 已配置`);
        
        // 使用用户配置的 Base URL，如果没有则使用默认值
        const baseURL = req.user.claudeBaseURL || 'https://api.api123.icu';
        console.log(`[请求 ${requestId}] Claude API 地址: ${baseURL}`);
        
        const client = new Anthropic({
            apiKey: req.user.claudeApiKey,
            baseURL: baseURL
        });
        
        // 构建提示词
        const prompt = `${REWRITE_PROMPTS[mode] || REWRITE_PROMPTS.standard}\n\n原文：\n${text}\n\n改写后的文本：`;
        console.log(`[请求 ${requestId}] 提示词长度: ${prompt.length} 字符`);
        
        // 调用 Claude API
        console.log(`[请求 ${requestId}] 🚀 开始调用 Claude API...`);
        const apiStartTime = Date.now();
        const message = await client.messages.create({
            model: model,
            max_tokens: 4096,
            messages: [
                { role: 'user', content: prompt }
            ]
        });
        
        const apiDuration = (Date.now() - apiStartTime) / 1000;
        console.log(`[请求 ${requestId}] ✓ Claude API 调用成功，耗时: ${apiDuration.toFixed(2)}秒`);
        
        const duration = (Date.now() - startTime) / 1000;
        
        // 安全地提取响应文本
        let rewrittenText = '';
        if (message && message.content && Array.isArray(message.content) && message.content.length > 0) {
            rewrittenText = message.content[0].text || '';
        }
        
        console.log(`[请求 ${requestId}] 响应内容长度: ${rewrittenText.length} 字符`);
        console.log(`[请求 ${requestId}] Token 使用: 输入=${message.usage.input_tokens}, 输出=${message.usage.output_tokens}`);
        
        if (!rewrittenText) {
            console.log(`[请求 ${requestId}] ❌ 错误: API 返回内容为空`);
            throw new Error('API 返回内容为空');
        }
        
        // 清理响应文本，移除可能导致问题的字符
        // 移除 BOM 和其他不可见字符
        const originalLength = rewrittenText.length;
        rewrittenText = rewrittenText.replace(/^\uFEFF/, '').trim();
        if (originalLength !== rewrittenText.length) {
            console.log(`[请求 ${requestId}] ⚠️ 清理了特殊字符，长度从 ${originalLength} 变为 ${rewrittenText.length}`);
        }
        
        console.log(`[请求 ${requestId}] ✓ 改写完成 - 总耗时: ${duration.toFixed(2)}秒, 输出长度: ${rewrittenText.length}`);
        console.log(`[请求 ${requestId}] 输出预览: ${rewrittenText.substring(0, 100)}${rewrittenText.length > 100 ? '...' : ''}`);
        
        // 计算相似度（简单模拟，实际可以用更复杂的算法）
        const similarity = returnSimilarity ? calculateSimilarity(text, rewrittenText) : null;
        
        // 返回 5118 兼容格式
        const response = {
            errcode: '0',
            errmsg: '',
            data: rewrittenText
        };
        
        // 只有当 similarity 不为 null 时才添加 like 字段
        // 避免小旋风无法解析 null 值
        if (similarity !== null) {
            response.like = similarity;
        }
        
        // 只在开发环境或明确请求时返回元数据
        if (process.env.NODE_ENV === 'development' || req.query.debug === '1') {
            response._meta = {
                mode: mode,
                model: model,
                duration: duration,
                usage: {
                    input_tokens: message.usage.input_tokens,
                    output_tokens: message.usage.output_tokens
                }
            };
        }
        
        console.log(`[请求 ${requestId}] 📤 准备返回响应`);
        console.log(`[请求 ${requestId}] 响应格式:`, JSON.stringify({
            errcode: response.errcode,
            errmsg: response.errmsg,
            data_length: response.data.length,
            like: response.like,
            has_meta: !!response._meta
        }));
        console.log(`[请求 ${requestId}] HTTP 状态码: 200`);
        console.log(`[请求 ${requestId}] Content-Type: application/json`);
        
        // 输出完整的响应体（用于调试小旋风问题）
        const responseStr = JSON.stringify(response);
        console.log(`[请求 ${requestId}] 完整响应体长度: ${responseStr.length} 字符`);
        console.log(`[请求 ${requestId}] 完整响应体:`, responseStr.substring(0, 500));
        if (responseStr.length > 500) {
            console.log(`[请求 ${requestId}] ... (响应体太长，已截断)`);
        }
        
        res.json(response);
        
        console.log(`[请求 ${requestId}] ✅ 响应已发送`);
        console.log('========================================');
        
    } catch (error) {
        console.log(`[请求 ${requestId}] ❌ 发生错误`);
        console.error(`[请求 ${requestId}] 错误类型: ${error.constructor.name}`);
        console.error(`[请求 ${requestId}] 错误消息: ${error.message}`);
        console.error(`[请求 ${requestId}] 错误状态码: ${error.status || 'N/A'}`);
        console.error(`[请求 ${requestId}] 错误详情:`, error);
        
        let errcode = '100301';
        let errmsg = error.message || '改写失败';
        
        if (error.status === 401 || error.message.includes('authentication') || error.message.includes('API key')) {
            errcode = '100203';
            errmsg = 'Claude API Key 无效或未授权';
            console.log(`[请求 ${requestId}] 🔑 认证失败`);
        } else if (error.status === 429 || error.message.includes('rate')) {
            errcode = '100102';
            errmsg = '服务每秒调用量超限，请稍后重试';
            console.log(`[请求 ${requestId}] ⏱️ 速率限制`);
        } else if (error.status === 503 || error.message.includes('model_not_found')) {
            errcode = '100301';
            errmsg = '所选模型不可用，请尝试其他模型（推荐使用 Claude 3 Sonnet）';
            console.log(`[请求 ${requestId}] 🚫 模型不可用`);
        } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            errcode = '100301';
            errmsg = '请求超时，请检查网络连接';
            console.log(`[请求 ${requestId}] ⏰ 请求超时`);
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            errcode = '100301';
            errmsg = '无法连接到 API 服务器，请检查 Base URL 配置';
            console.log(`[请求 ${requestId}] 🔌 连接失败`);
        }
        
        console.log(`[请求 ${requestId}] 📤 返回错误响应: errcode=${errcode}, errmsg=${errmsg}`);
        
        // 5118 格式错误返回
        const errorResponse = {
            errcode: errcode,
            errmsg: errmsg,
            data: '',
            _debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                stack: error.stack
            } : undefined
        };
        
        res.json(errorResponse);
        
        console.log(`[请求 ${requestId}] ❌ 错误响应已发送`);
        console.log('========================================');
    }
});

// 简单的相似度计算（Jaccard 相似度）
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(''));
    const words2 = new Set(text2.split(''));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    const similarity = intersection.size / union.size;
    return similarity.toFixed(4);
}

// 路由：更新配置
app.post('/api/config', async (req, res) => {
    try {
        const { api_key } = req.body;
        
        if (!api_key || !api_key.trim()) {
            return res.status(400).json({
                success: false,
                error: '请输入 API Key'
            });
        }
        
        // 验证 API Key 格式
        if (!api_key.startsWith('sk-ant-')) {
            return res.status(400).json({
                success: false,
                error: 'API Key 格式不正确'
            });
        }
        
        config.apiKey = api_key;
        console.log('API Key 配置成功');
        
        res.json({
            success: true,
            message: 'API Key 配置成功'
        });
        
    } catch (error) {
        console.error('配置失败:', error.message);
        res.status(400).json({
            success: false,
            error: `配置失败: ${error.message}`
        });
    }
});

// 路由：获取配置
app.get('/api/config', (req, res) => {
    res.json({
        api_key_configured: !!config.apiKey,
        api_key_preview: config.apiKey ? config.apiKey.substring(0, 10) + '...' : '',
        base_url: config.baseURL
    });
});

// 路由：获取支持的模型
app.get('/api/models', (req, res) => {
    res.json({
        models: [
            {
                id: 'claude-haiku-4-5-20251001',
                name: 'Claude Haiku 4.5',
                context: '200K',
                description: '最快速，成本最低'
            },
            {
                id: 'claude-sonnet-4-5-20250929',
                name: 'Claude Sonnet 4.5',
                context: '200K',
                description: '平衡性能和成本（推荐）'
            },
            {
                id: 'claude-sonnet-4-5-20250929-thinking',
                name: 'Claude Sonnet 4.5 Thinking',
                context: '200K',
                description: '思考模式，更深入分析'
            },
            {
                id: 'claude-sonnet-4-6',
                name: 'Claude Sonnet 4.6',
                context: '200K',
                description: '最新 Sonnet 版本'
            },
            {
                id: 'claude-opus-4-5',
                name: 'Claude Opus 4.5',
                context: '200K',
                description: '强大性能'
            },
            {
                id: 'claude-opus-4-5-20251101-thinking',
                name: 'Claude Opus 4.5 Thinking',
                context: '200K',
                description: '思考模式，最强分析'
            },
            {
                id: 'claude-opus-4-6',
                name: 'Claude Opus 4.6',
                context: '200K',
                description: '顶级性能'
            }
        ]
    });
});

// 路由：获取改写模式列表
app.get('/api/modes', (req, res) => {
    const modes = Object.entries(rewriteModesConfig).map(([key, value]) => ({
        id: key,
        name: value.name,
        description: value.description,
        antiAI: value.antiAI || false,
        builtin: value.builtin !== false, // 默认都是内置的
        prompt: value.prompt
    }));
    
    res.json({
        modes: modes,
        total: modes.length
    });
});

// 路由：获取单个模式详情
app.get('/api/modes/:id', (req, res) => {
    const modeId = req.params.id;
    const mode = rewriteModesConfig[modeId];
    
    if (!mode) {
        return res.status(404).json({
            success: false,
            error: '模式不存在'
        });
    }
    
    res.json({
        id: modeId,
        name: mode.name,
        description: mode.description,
        antiAI: mode.antiAI || false,
        builtin: mode.builtin !== false,
        prompt: mode.prompt
    });
});

// 路由：保存/更新模式
app.post('/api/modes', (req, res) => {
    try {
        const { id, name, description, antiAI, prompt } = req.body;
        
        if (!id || !name || !prompt) {
            return res.json({
                success: false,
                error: '请填写所有必填项'
            });
        }
        
        // 验证 ID 格式
        if (!/^[a-z_]+$/.test(id)) {
            return res.json({
                success: false,
                error: '模式 ID 只能包含小写字母和下划线'
            });
        }
        
        // 更新内存中的配置
        rewriteModesConfig[id] = {
            name: name,
            description: description || '',
            antiAI: antiAI || false,
            builtin: false, // 用户添加的标记为非内置
            prompt: prompt
        };
        
        // 更新 REWRITE_PROMPTS
        REWRITE_PROMPTS[id] = prompt;
        
        // 保存到文件
        const configPath = path.join(__dirname, 'config', 'rewrite-modes.js');
        const configContent = `/**
 * 改写模式配置文件
 * 你可以在这里自定义所有改写模式的提示词
 */

module.exports = ${JSON.stringify(rewriteModesConfig, null, 4).replace(/"([^"]+)":/g, '$1:')};
`;
        
        fs.writeFileSync(configPath, configContent, 'utf8');
        
        console.log(`模式 "${id}" 已保存`);
        
        res.json({
            success: true,
            message: '保存成功'
        });
        
    } catch (error) {
        console.error('保存模式失败:', error);
        res.json({
            success: false,
            error: '保存失败: ' + error.message
        });
    }
});

// 路由：删除模式
app.delete('/api/modes/:id', (req, res) => {
    try {
        const modeId = req.params.id;
        
        if (!rewriteModesConfig[modeId]) {
            return res.json({
                success: false,
                error: '模式不存在'
            });
        }
        
        // 不允许删除内置模式
        if (rewriteModesConfig[modeId].builtin !== false) {
            return res.json({
                success: false,
                error: '不能删除内置模式'
            });
        }
        
        // 从内存中删除
        delete rewriteModesConfig[modeId];
        delete REWRITE_PROMPTS[modeId];
        
        // 保存到文件
        const configPath = path.join(__dirname, 'config', 'rewrite-modes.js');
        const configContent = `/**
 * 改写模式配置文件
 * 你可以在这里自定义所有改写模式的提示词
 */

module.exports = ${JSON.stringify(rewriteModesConfig, null, 4).replace(/"([^"]+)":/g, '$1:')};
`;
        
        fs.writeFileSync(configPath, configContent, 'utf8');
        
        console.log(`模式 "${modeId}" 已删除`);
        
        res.json({
            success: true,
            message: '删除成功'
        });
        
    } catch (error) {
        console.error('删除模式失败:', error);
        res.json({
            success: false,
            error: '删除失败: ' + error.message
        });
    }
});

// 路由：API 文档
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'SEO API - Claude AI 文本改写服务',
        version: '1.0.0',
        endpoints: {
            'POST /api/rewrite': {
                description: '文本改写接口',
                parameters: {
                    text: '要改写的文本（必填）',
                    mode: '改写模式（可选，默认 standard）',
                    model: 'Claude 模型（可选，默认 claude-3-sonnet-20240229）',
                    api_key: 'API Key（可选，如果已全局配置）'
                },
                modes: ['standard', 'creative', 'formal', 'simple', 'translate_cn']
            },
            'GET /health': {
                description: '健康检查'
            },
            'POST /api/config': {
                description: '更新 API 配置'
            },
            'GET /api/config': {
                description: '获取当前配置'
            },
            'GET /api/models': {
                description: '获取支持的模型列表'
            }
        }
    });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  SEO API - Claude AI 文本改写服务');
    console.log('========================================');
    console.log('');
    console.log(`服务地址: http://localhost:${PORT}`);
    console.log(`API 文档: http://localhost:${PORT}/api/docs`);
    console.log(`Web 界面: http://localhost:${PORT}`);
    console.log('');
    console.log('按 Ctrl+C 停止服务');
    console.log('========================================');
    console.log('');
    console.log(`API Key 状态: ${config.apiKey ? '✓ 已配置' : '✗ 未配置'}`);
    console.log('');
});

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});
