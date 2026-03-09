/**
 * SEO API - Claude AI 文本改写服务
 * Node.js + Express 版本
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const logger = require('./lib/logger');
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
                apiType: 'auto', // API 类型：auto/openai/anthropic/gemini/cohere/qwen/wenxin
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

/**
 * 智能分段函数（带上下文重叠）
 * 按段落分割文本，避免截断句子，并保留上下文
 * @param {string} text - 要分割的文本
 * @param {number} chunkSize - 每段的目标大小
 * @param {number} overlapSize - 上下文重叠大小（默认 200 字符）
 * @returns {Array<Object>} 分段后的对象数组，包含 text 和 context
 */
function smartSplitText(text, chunkSize, overlapSize = 200) {
    const chunks = [];
    
    // 首先按段落分割（双换行）
    const paragraphs = text.split(/\n\n+/);
    
    let currentChunk = '';
    let previousContext = ''; // 保存前一段的结尾作为上下文
    
    for (const paragraph of paragraphs) {
        // 如果当前段落本身就超过 chunkSize，需要按句子分割
        if (paragraph.length > chunkSize) {
            // 先保存当前累积的内容
            if (currentChunk) {
                chunks.push({
                    text: currentChunk.trim(),
                    previousContext: previousContext,
                    nextContext: paragraph.substring(0, overlapSize) // 下一段的开头作为后文
                });
                previousContext = currentChunk.slice(-overlapSize); // 保存当前段的结尾
                currentChunk = '';
            }
            
            // 按句子分割长段落
            const sentences = paragraph.split(/([。！？.!?]+)/);
            let sentenceChunk = '';
            
            for (let i = 0; i < sentences.length; i += 2) {
                const sentence = sentences[i] + (sentences[i + 1] || '');
                
                if (sentenceChunk.length + sentence.length > chunkSize) {
                    if (sentenceChunk) {
                        const nextSentence = sentences[i + 2] ? sentences[i + 2].substring(0, overlapSize) : '';
                        chunks.push({
                            text: sentenceChunk.trim(),
                            previousContext: previousContext,
                            nextContext: nextSentence
                        });
                        previousContext = sentenceChunk.slice(-overlapSize);
                    }
                    sentenceChunk = sentence;
                } else {
                    sentenceChunk += sentence;
                }
            }
            
            if (sentenceChunk) {
                currentChunk = sentenceChunk;
            }
        } else {
            // 检查添加这个段落是否会超过 chunkSize
            if (currentChunk.length + paragraph.length + 2 > chunkSize) {
                // 超过了，保存当前 chunk，开始新的
                if (currentChunk) {
                    chunks.push({
                        text: currentChunk.trim(),
                        previousContext: previousContext,
                        nextContext: paragraph.substring(0, overlapSize)
                    });
                    previousContext = currentChunk.slice(-overlapSize);
                }
                currentChunk = paragraph;
            } else {
                // 没超过，添加到当前 chunk
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }
    }
    
    // 保存最后一个 chunk
    if (currentChunk) {
        chunks.push({
            text: currentChunk.trim(),
            previousContext: previousContext,
            nextContext: '' // 最后一段没有后文
        });
    }
    
    return chunks;
}

// 检测 API 类型（Anthropic 或 OpenAI 兼容）
// ========== AI 接口适配器 ==========

/**
 * 智能探测 API 类型
 * 通过实际调用 API 来判断格式，适用于国内中转平台
 * @param {string} baseURL - API Base URL
 * @param {string} apiKey - API Key
 * @returns {Promise<string>} API 类型
 */
async function probeAPIType(baseURL, apiKey) {
    console.log(`[API 探测] 开始探测 API 类型: ${baseURL}`);
    
    // 探测策略：尝试 OpenAI 格式（最常见）
    try {
        // 确保 baseURL 包含 /v1
        let testURL = baseURL;
        if (!testURL.endsWith('/v1') && !testURL.includes('/v1/')) {
            testURL = testURL.replace(/\/$/, '') + '/v1';
        }
        
        const url = new URL(`${testURL}/models`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        return new Promise((resolve) => {
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000 // 5秒超时
            };
            
            const req = httpModule.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        
                        // 判断响应格式
                        if (response.object === 'list' && response.data) {
                            // OpenAI 格式特征
                            console.log(`[API 探测] 识别为 OpenAI 格式（响应包含 object: 'list'）`);
                            resolve('openai');
                        } else if (response.models || response.model) {
                            // 可能是其他格式，但也兼容 OpenAI
                            console.log(`[API 探测] 识别为 OpenAI 兼容格式`);
                            resolve('openai');
                        } else {
                            // 无法确定，使用默认
                            console.log(`[API 探测] 无法确定格式，使用默认 OpenAI 格式`);
                            resolve('openai');
                        }
                    } catch (error) {
                        // JSON 解析失败，可能不是 OpenAI 格式
                        console.log(`[API 探测] 响应解析失败，使用默认 OpenAI 格式`);
                        resolve('openai');
                    }
                });
            });
            
            req.on('error', () => {
                // 请求失败，使用默认格式
                console.log(`[API 探测] 请求失败，使用默认 OpenAI 格式`);
                resolve('openai');
            });
            
            req.on('timeout', () => {
                req.destroy();
                console.log(`[API 探测] 请求超时，使用默认 OpenAI 格式`);
                resolve('openai');
            });
            
            req.end();
        });
        
    } catch (error) {
        console.log(`[API 探测] 探测异常，使用默认 OpenAI 格式`);
        return 'openai';
    }
}

/**
 * 检测 API 类型（增强版）
 * 支持：OpenAI、Anthropic、Gemini、Cohere、通义千问、文心一言
 * @param {string} baseURL - API Base URL
 * @param {string} manualType - 手动指定的类型（可选）
 * @param {string} apiKey - API Key（用于智能探测）
 * @returns {Promise<string>|string} API 类型
 */
function detectAPIType(baseURL, manualType = 'auto', apiKey = null) {
    // 如果手动指定了类型且不是 auto，直接返回
    if (manualType && manualType !== 'auto') {
        console.log(`[API 识别] 使用手动指定类型: ${manualType}`);
        return manualType;
    }
    
    // 自动识别
    const url = baseURL.toLowerCase();
    
    // 第一步：URL 特征识别（快速判断官方服务）
    
    // Anthropic Claude 官方
    if (url.includes('anthropic.com')) {
        console.log(`[API 识别] URL 特征识别: Anthropic Claude 官方`);
        return 'anthropic';
    }
    
    // Google Gemini
    if (url.includes('generativelanguage.googleapis.com')) {
        console.log(`[API 识别] URL 特征识别: Google Gemini`);
        return 'gemini';
    }
    
    // Cohere
    if (url.includes('cohere.ai') || url.includes('cohere.com')) {
        console.log(`[API 识别] URL 特征识别: Cohere`);
        return 'cohere';
    }
    
    // 阿里云通义千问
    if (url.includes('dashscope.aliyuncs.com')) {
        console.log(`[API 识别] URL 特征识别: 阿里云通义千问`);
        return 'qwen';
    }
    
    // 百度文心一言
    if (url.includes('aip.baidubce.com')) {
        console.log(`[API 识别] URL 特征识别: 百度文心一言`);
        return 'wenxin';
    }
    
    // Azure OpenAI
    if (url.includes('azure.com') || url.includes('openai.azure')) {
        console.log(`[API 识别] URL 特征识别: Azure OpenAI`);
        return 'azure-openai';
    }
    
    // OpenAI 官方
    if (url.includes('api.openai.com')) {
        console.log(`[API 识别] URL 特征识别: OpenAI 官方`);
        return 'openai';
    }
    
    // 第二步：常见中转平台识别
    const knownProxyDomains = [
        'fucaixie.xyz', 
        'api123.icu',
        'chatanywhere',
        'api2d',
        'closeai',
        'openai-proxy',
        'openai-sb',
        'api-gpt',
        'gpt-api',
        'claude-api',
        'ai-proxy'
    ];
    
    if (knownProxyDomains.some(domain => url.includes(domain))) {
        console.log(`[API 识别] 已知中转平台，使用 OpenAI 格式`);
        return 'openai';
    }
    
    // 第三步：路径特征识别
    if (url.includes('/v1/chat/completions') || url.includes('/v1/models')) {
        console.log(`[API 识别] 路径特征识别: OpenAI 格式（包含 /v1 路径）`);
        return 'openai';
    }
    
    // 第四步：智能探测（异步）
    // 如果提供了 apiKey，尝试智能探测
    if (apiKey) {
        console.log(`[API 识别] URL 特征无法识别，将使用智能探测`);
        // 返回 Promise，由调用方处理
        return probeAPIType(baseURL, apiKey);
    }
    
    // 默认使用 OpenAI 格式（最通用，国内中转平台大多使用此格式）
    console.log(`[API 识别] 无法识别 URL: ${baseURL}，使用默认 OpenAI 格式（国内中转平台通用）`);
    return 'openai';
}

/**
 * 统一的 AI 调用接口
 * 自动适配不同的 AI 服务
 */
async function callAI(baseURL, apiKey, model, prompt, manualType = 'auto') {
    // 检测 API 类型（可能是异步的）
    let apiType = detectAPIType(baseURL, manualType, apiKey);
    
    // 如果返回的是 Promise，等待结果
    if (apiType instanceof Promise) {
        apiType = await apiType;
    }
    
    console.log(`[AI 调用] 使用 API 类型: ${apiType}`);
    
    switch (apiType) {
        case 'openai':
        case 'azure-openai':
            return await callOpenAICompatible(baseURL, apiKey, model, prompt);
        
        case 'anthropic':
            return await callAnthropic(baseURL, apiKey, model, prompt);
        
        case 'gemini':
            return await callGemini(baseURL, apiKey, model, prompt);
        
        case 'cohere':
            return await callCohere(baseURL, apiKey, model, prompt);
        
        case 'qwen':
            return await callQwen(baseURL, apiKey, model, prompt);
        
        case 'wenxin':
            return await callWenxin(baseURL, apiKey, model, prompt);
        
        case 'qwen':
            return await callQwen(baseURL, apiKey, model, prompt);
        
        case 'wenxin':
            return await callWenxin(baseURL, apiKey, model, prompt);
        
        default:
            // 默认尝试 OpenAI 格式
            return await callOpenAICompatible(baseURL, apiKey, model, prompt);
    }
}

/**
 * OpenAI 兼容接口调用
 * 支持：OpenAI、Azure OpenAI、大部分国内中转
 */
async function callOpenAICompatible(baseURL, apiKey, model, prompt) {
    return new Promise((resolve, reject) => {
        // 确保 baseURL 包含 /v1
        let apiURL = baseURL;
        if (!apiURL.endsWith('/v1') && !apiURL.includes('/v1/')) {
            apiURL = apiURL.replace(/\/$/, '') + '/v1';
        }
        
        const postData = JSON.stringify({
            model: model,
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 4096,
            temperature: 0.7
        });
        
        const url = new URL(`${apiURL}/chat/completions`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 180000  // 180 秒超时（长文本需要更多时间）
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const response = JSON.parse(data);
                        
                        // 转换为统一格式
                        const result = {
                            content: [
                                { text: response.choices[0].message.content || '' }
                            ],
                            model: response.model || model,
                            usage: {
                                input_tokens: response.usage?.prompt_tokens || response.usage?.input_tokens || 0,
                                output_tokens: response.usage?.completion_tokens || response.usage?.output_tokens || 0
                            }
                        };
                        
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Anthropic Claude 官方接口调用
 */
async function callAnthropic(baseURL, apiKey, model, prompt) {
    const client = new Anthropic({
        apiKey: apiKey,
        baseURL: baseURL !== 'https://api.anthropic.com' ? baseURL : undefined
    });
    
    const response = await client.messages.create({
        model: model,
        max_tokens: 4096,
        messages: [
            { role: 'user', content: prompt }
        ]
    });
    
    return response;
}

/**
 * Google Gemini 接口调用
 */
async function callGemini(baseURL, apiKey, model, prompt) {
    return new Promise((resolve, reject) => {
        // Gemini API 格式
        const apiURL = baseURL.includes('generativelanguage.googleapis.com') 
            ? baseURL 
            : 'https://generativelanguage.googleapis.com';
        
        const postData = JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                maxOutputTokens: 4096,
                temperature: 0.7
            }
        });
        
        const url = new URL(`${apiURL}/v1beta/models/${model}:generateContent?key=${apiKey}`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const response = JSON.parse(data);
                        
                        // 转换为统一格式
                        const result = {
                            content: [
                                { text: response.candidates[0].content.parts[0].text || '' }
                            ],
                            model: model,
                            usage: {
                                input_tokens: response.usageMetadata?.promptTokenCount || 0,
                                output_tokens: response.usageMetadata?.candidatesTokenCount || 0
                            }
                        };
                        
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * Cohere 接口调用
 */
async function callCohere(baseURL, apiKey, model, prompt) {
    return new Promise((resolve, reject) => {
        const apiURL = baseURL.includes('cohere') ? baseURL : 'https://api.cohere.ai';
        
        const postData = JSON.stringify({
            model: model,
            message: prompt,
            max_tokens: 4096,
            temperature: 0.7
        });
        
        const url = new URL(`${apiURL}/v1/chat`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const response = JSON.parse(data);
                        
                        // 转换为统一格式
                        const result = {
                            content: [
                                { text: response.text || '' }
                            ],
                            model: model,
                            usage: {
                                input_tokens: response.meta?.tokens?.input_tokens || 0,
                                output_tokens: response.meta?.tokens?.output_tokens || 0
                            }
                        };
                        
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * 阿里云通义千问接口调用
 */
async function callQwen(baseURL, apiKey, model, prompt) {
    return new Promise((resolve, reject) => {
        const apiURL = baseURL.includes('dashscope') ? baseURL : 'https://dashscope.aliyuncs.com';
        
        const postData = JSON.stringify({
            model: model,
            input: {
                messages: [
                    { role: 'user', content: prompt }
                ]
            },
            parameters: {
                max_tokens: 4096
            }
        });
        
        const url = new URL(`${apiURL}/api/v1/services/aigc/text-generation/generation`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const response = JSON.parse(data);
                        
                        // 转换为统一格式
                        const result = {
                            content: [
                                { text: response.output?.text || '' }
                            ],
                            model: model,
                            usage: {
                                input_tokens: response.usage?.input_tokens || 0,
                                output_tokens: response.usage?.output_tokens || 0
                            }
                        };
                        
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.write(postData);
        req.end();
    });
}

/**
 * 百度文心一言接口调用
 */
async function callWenxin(baseURL, apiKey, model, prompt) {
    return new Promise((resolve, reject) => {
        const apiURL = baseURL.includes('baidubce') ? baseURL : 'https://aip.baidubce.com';
        
        const postData = JSON.stringify({
            messages: [
                { role: 'user', content: prompt }
            ],
            max_output_tokens: 4096
        });
        
        const url = new URL(`${apiURL}/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/${model}?access_token=${apiKey}`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 60000
        };
        
        const req = httpModule.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const response = JSON.parse(data);
                        
                        // 转换为统一格式
                        const result = {
                            content: [
                                { text: response.result || '' }
                            ],
                            model: model,
                            usage: {
                                input_tokens: response.usage?.prompt_tokens || 0,
                                output_tokens: response.usage?.completion_tokens || 0
                            }
                        };
                        
                        resolve(result);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (error) {
                    reject(new Error(`解析响应失败: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });
        
        req.write(postData);
        req.end();
    });
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

// 路由：首页（自动跳转）
app.get('/', (req, res) => {
    // 检查是否有会话 token
    const token = req.cookies?.sessionToken || req.headers['x-session-token'];
    
    if (token) {
        const sessions = getSessions();
        const session = sessions[token];
        
        if (session && new Date(session.expiresAt) > new Date()) {
            // 已登录，跳转到主界面
            return res.redirect('/index.html');
        }
    }
    
    // 未登录，跳转到登录页
    res.redirect('/login.html');
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
            claudeApiKey: req.user.claudeApiKey || '',
            claudeBaseURL: req.user.claudeBaseURL || 'https://api.api123.icu',
            apiType: req.user.apiType || 'auto',
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

// 路由：设置 API 类型
app.post('/api/users/api-type', verifySession, (req, res) => {
    try {
        const { apiType } = req.body;
        
        const validTypes = ['auto', 'openai', 'anthropic', 'gemini', 'cohere', 'qwen', 'wenxin', 'azure-openai'];
        
        if (!apiType || !validTypes.includes(apiType)) {
            return res.json({
                success: false,
                error: '无效的 API 类型'
            });
        }
        
        const users = getUsers();
        users[req.user.username].apiType = apiType;
        saveUsers(users);
        
        console.log(`用户 ${req.user.username} 设置 API 类型: ${apiType}`);
        
        res.json({
            success: true,
            message: 'API 类型设置成功'
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '设置失败'
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

// 路由：文本改写（兼容 5118 格式和标准格式）- 需要 API Key（无速率限制）
app.post('/api/rewrite', verifyApiKey, async (req, res) => {
    const requestId = crypto.randomBytes(8).toString('hex'); // 生成请求 ID
    const startTime = Date.now();
    
    // 在外部定义变量，以便在 catch 块中使用
    let baseURL = '';
    let apiType = '';
    let model = '';
    let mode = '';
    let text = '';
    
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
        text = req.body.text || req.body.txt || '';
        mode = req.body.mode || req.user.defaultMode || 'humanlike';
        model = req.body.model || req.user.defaultModel || 'claude-sonnet-4-5-20250929';
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
        
        console.log(`[请求 ${requestId}] ✓ 参数验证通过`);
        console.log(`[请求 ${requestId}] 文本长度: ${text.length} 字符`);
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
        baseURL = req.user.claudeBaseURL || 'https://api.api123.icu';
        console.log(`[请求 ${requestId}] Claude API 地址: ${baseURL}`);
        
        // 检测 API 类型
        apiType = detectAPIType(baseURL, req.user.apiType || 'auto');
        console.log(`[请求 ${requestId}] API 类型: ${apiType}${req.user.apiType && req.user.apiType !== 'auto' ? ' (手动指定)' : ' (自动识别)'}`);
        
        // 检查是否需要分段处理（超过 2000 字符）
        const CHUNK_SIZE = 1800; // 每段 1800 字符（安全值）
        const needsChunking = text.length > 2000;
        
        let rewrittenText = '';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const apiStartTime = Date.now();
        
        if (needsChunking) {
            console.log(`[请求 ${requestId}] 📊 检测到超长文本: ${text.length} 字符`);
            console.log(`[请求 ${requestId}] 🔄 启用分段处理模式（带上下文重叠），每段 ${CHUNK_SIZE} 字符`);
            
            // 智能分段（带上下文）
            const chunks = smartSplitText(text, CHUNK_SIZE, 200);
            console.log(`[请求 ${requestId}] 📝 分为 ${chunks.length} 段处理`);
            
            const rewrittenChunks = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                console.log(`[请求 ${requestId}] 🚀 处理第 ${i + 1}/${chunks.length} 段 (${chunk.text.length} 字符)...`);
                
                // 构建带上下文的提示词
                let contextPrompt = REWRITE_PROMPTS[mode] || REWRITE_PROMPTS.standard;
                
                // 添加上下文信息
                if (chunk.previousContext || chunk.nextContext) {
                    contextPrompt += '\n\n【重要提示】这是一篇长文章的一部分，请注意保持与前后文的连贯性：';
                    
                    if (chunk.previousContext) {
                        contextPrompt += `\n\n前文参考（仅供理解上下文，不要改写）：\n"...${chunk.previousContext}"`;
                    }
                    
                    if (chunk.nextContext) {
                        contextPrompt += `\n\n后文参考（仅供理解上下文，不要改写）：\n"${chunk.nextContext}..."`;
                    }
                }
                
                const prompt = `${contextPrompt}\n\n原文：\n${chunk.text}\n\n改写后的文本：`;
                
                const chunkStartTime = Date.now();
                const message = await callAI(baseURL, req.user.claudeApiKey, model, prompt, req.user.apiType || 'auto');
                const chunkDuration = (Date.now() - chunkStartTime) / 1000;
                
                // 提取改写结果
                let chunkRewritten = '';
                if (message && message.content && Array.isArray(message.content) && message.content.length > 0) {
                    chunkRewritten = message.content[0].text || '';
                }
                
                rewrittenChunks.push(chunkRewritten);
                
                // 累计 token 使用
                if (message.usage) {
                    totalInputTokens += message.usage.input_tokens || 0;
                    totalOutputTokens += message.usage.output_tokens || 0;
                }
                
                console.log(`[请求 ${requestId}] ✓ 第 ${i + 1} 段完成，耗时: ${chunkDuration.toFixed(2)}秒，输出: ${chunkRewritten.length} 字符`);
            }
            
            // 合并所有段落
            rewrittenText = rewrittenChunks.join('\n\n');
            
            const apiDuration = (Date.now() - apiStartTime) / 1000;
            console.log(`[请求 ${requestId}] ✓ 分段处理完成，总耗时: ${apiDuration.toFixed(2)}秒`);
            console.log(`[请求 ${requestId}] 📊 总 Token 使用: 输入=${totalInputTokens}, 输出=${totalOutputTokens}`);
            
        } else {
            // 正常处理（不分段）
            console.log(`[请求 ${requestId}] 📝 文本长度正常，使用标准处理模式`);
            
            // 构建提示词
            const prompt = `${REWRITE_PROMPTS[mode] || REWRITE_PROMPTS.standard}\n\n原文：\n${text}\n\n改写后的文本：`;
            console.log(`[请求 ${requestId}] 提示词长度: ${prompt.length} 字符`);
            
            // 调用 AI（使用统一接口，自动适配）
            console.log(`[请求 ${requestId}] 🚀 开始调用 AI...`);
            
            const message = await callAI(baseURL, req.user.claudeApiKey, model, prompt, req.user.apiType || 'auto');
            
            const apiDuration = (Date.now() - apiStartTime) / 1000;
            console.log(`[请求 ${requestId}] ✓ AI 调用成功，耗时: ${apiDuration.toFixed(2)}秒`);
            
            // 安全地提取响应文本
            if (message && message.content && Array.isArray(message.content) && message.content.length > 0) {
                rewrittenText = message.content[0].text || '';
            }
            
            console.log(`[请求 ${requestId}] 响应内容长度: ${rewrittenText.length} 字符`);
            
            // 打印 token 使用情况
            if (message.usage) {
                totalInputTokens = message.usage.input_tokens || 0;
                totalOutputTokens = message.usage.output_tokens || 0;
                console.log(`[请求 ${requestId}] Token 使用: 输入=${totalInputTokens}, 输出=${totalOutputTokens}`);
            } else {
                console.log(`[请求 ${requestId}] ⚠️ 警告: 未返回 token 使用信息`);
            }
        }
        
        const duration = (Date.now() - startTime) / 1000;
        if (!rewrittenText) {
            console.log(`[请求 ${requestId}] ❌ 错误: API 返回内容为空`);
            throw new Error('API 返回内容为空');
        }
        
        // 清理响应文本，移除可能导致问题的字符
        // 移除 BOM 和其他不可见字符
        const originalLength = rewrittenText.length;
        rewrittenText = rewrittenText.replace(/^\uFEFF/, '').trim();
        
        // 如果请求参数包含 compact=1，压缩文本（移除多余空格和换行）
        // 这可以减小响应体积，适用于有大小限制的客户端（如小旋风）
        if (req.body.compact === '1' || req.body.compact === 1) {
            // 移除多余的空格和换行
            rewrittenText = rewrittenText
                .replace(/\s+/g, ' ')  // 多个空格替换为单个空格
                .replace(/\n+/g, '')   // 移除换行
                .trim();
            console.log(`[请求 ${requestId}] 🗜️ 文本已压缩，长度从 ${originalLength} 变为 ${rewrittenText.length}`);
        } else if (originalLength !== rewrittenText.length) {
            console.log(`[请求 ${requestId}] ⚠️ 清理了特殊字符，长度从 ${originalLength} 变为 ${rewrittenText.length}`);
        }
        
        // 检查响应体大小，如果超过 1200 字符，给出警告
        // 小旋风可能对响应体大小有限制（约 1300-1500 字符）
        if (rewrittenText.length > 1200) {
            console.log(`[请求 ${requestId}] ⚠️ 警告: 响应文本较长 (${rewrittenText.length} 字符)`);
            console.log(`[请求 ${requestId}] 💡 建议: 在小旋风中限制采集文本长度为 800-1000 字符`);
            console.log(`[请求 ${requestId}] 💡 或在 post 格式中添加 compact=1 参数压缩输出`);
        }
        
        console.log(`[请求 ${requestId}] ✓ 改写完成 - 总耗时: ${duration.toFixed(2)}秒, 输出长度: ${rewrittenText.length}`);
        console.log(`[请求 ${requestId}] 输出预览: ${rewrittenText.substring(0, 100)}${rewrittenText.length > 100 ? '...' : ''}`);
        
        // 记录成功的 API 调用
        logger.logAPICall({
            requestId: requestId,
            username: req.user.username,
            status: 'success',
            baseURL: baseURL,
            apiType: apiType,
            model: model,
            mode: mode,
            inputLength: text.length,
            outputLength: rewrittenText.length,
            duration: duration,
            apiDuration: (Date.now() - apiStartTime) / 1000,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            clientIP: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
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
        
        // 始终返回元数据（用于 Web 界面显示）
        response._meta = {
            mode: mode,
            model: model,
            duration: duration,
            usage: {
                input_tokens: totalInputTokens,
                output_tokens: totalOutputTokens
            }
        };
        
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
        
        // 记录失败的 API 调用
        logger.logAPICall({
            requestId: requestId,
            username: req.user.username,
            status: 'error',
            baseURL: baseURL || req.user.claudeBaseURL || 'unknown',
            apiType: apiType || 'unknown',
            model: model || 'unknown',
            mode: mode || 'unknown',
            inputLength: text?.length || 0,
            outputLength: 0,
            duration: (Date.now() - startTime) / 1000,
            apiDuration: 0,
            inputTokens: 0,
            outputTokens: 0,
            errorCode: errcode,
            errorMessage: errmsg,
            clientIP: req.ip,
            userAgent: req.headers['user-agent'] || 'Unknown'
        });
        
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

// 路由：获取统计数据（需要登录）
app.get('/api/stats', verifySession, (req, res) => {
    try {
        const stats = logger.getStats();
        
        if (!stats) {
            return res.json({
                success: true,
                stats: {
                    total: { calls: 0, success: 0, error: 0, totalTokens: 0, totalDuration: 0 },
                    byUser: {},
                    byModel: {},
                    byMode: {},
                    byBaseURL: {},
                    byDate: {}
                }
            });
        }
        
        // 如果不是管理员，只返回自己的统计
        if (req.user.role !== 'admin') {
            const userStats = stats.byUser[req.user.username] || {
                calls: 0,
                success: 0,
                error: 0,
                totalTokens: 0,
                totalDuration: 0
            };
            
            return res.json({
                success: true,
                stats: {
                    user: userStats,
                    lastUpdated: stats.lastUpdated
                }
            });
        }
        
        // 管理员返回完整统计
        res.json({
            success: true,
            stats: stats
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '获取统计数据失败'
        });
    }
});

// 路由：获取用户日志（需要登录）
app.get('/api/logs', verifySession, (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const username = req.user.role === 'admin' && req.query.username 
            ? req.query.username 
            : req.user.username;
        
        const logs = logger.getUserLogs(username, limit);
        
        res.json({
            success: true,
            logs: logs,
            total: logs.length
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '获取日志失败'
        });
    }
});

// 路由：清理旧日志（仅管理员）
app.post('/api/logs/clean', verifySession, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }
    
    try {
        const daysToKeep = parseInt(req.body.daysToKeep) || 30;
        logger.cleanOldLogs(daysToKeep);
        
        res.json({
            success: true,
            message: `已清理 ${daysToKeep} 天前的日志`
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: '清理日志失败'
        });
    }
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
