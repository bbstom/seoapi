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
const { testConnection, initDatabase } = require('./lib/database');
const userManager = require('./lib/userManager');
const tokenManager = require('./lib/tokenManager');
const configManager = require('./lib/configManager');
const apiConfigManager = require('./lib/apiConfigManager');
const nodeSelector = require('./lib/nodeSelector');
const apiCallWrapper = require('./lib/apiCallWrapper');
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
// 速率限制配置
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: process.env.NODE_ENV === 'production' ? 5 : 100, // 生产环境5次，开发环境100次
    message: { success: false, error: '登录尝试次数过多，请15分钟后再试' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // 开发环境可以选择完全跳过限制
        return process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true';
    }
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

// 密码哈希（保留用于兼容性）
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

// 验证 API Key 中间件
async function verifyApiKey(req, res, next) {
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
    
    // 先尝试从 api_keys 表验证（新系统）
    let user = await tokenManager.verifyToken(apiKey);
    
    // 如果不存在，再尝试从 users 表验证（兼容旧系统）
    if (!user) {
        user = await userManager.getUserByApiKey(apiKey);
    }
    
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
async function verifySession(req, res, next) {
    const token = req.headers['x-session-token'] || req.cookies?.sessionToken;
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: '未登录'
        });
    }
    
    const session = await userManager.getSession(token);
    
    if (!session) {
        return res.status(401).json({
            success: false,
            error: '会话已过期，请重新登录'
        });
    }
    
    const user = await userManager.getUserByUsername(session.username);
    if (!user) {
        return res.status(401).json({
            success: false,
            error: '用户不存在'
        });
    }
    
    req.user = user;
    next();
}

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
app.get('/', async (req, res) => {
    // 检查是否有会话 token
    const token = req.cookies?.sessionToken || req.headers['x-session-token'];
    
    if (token) {
        const session = await userManager.getSession(token);
        
        if (session) {
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
        
        const user = await userManager.getUserByUsername(username);
        
        if (!user) {
            return res.json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        
        // 验证密码
        const isValid = await userManager.verifyPassword(username, password);
        
        if (!isValid) {
            return res.json({
                success: false,
                error: '用户名或密码错误'
            });
        }
        
        // 创建会话（7天过期）
        const session = await userManager.createSession(username, 24 * 7);
        
        if (!session) {
            return res.json({
                success: false,
                error: '创建会话失败'
            });
        }
        
        console.log(`用户 ${username} 登录成功`);
        
        res.json({
            success: true,
            token: session.token,
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
app.post('/api/auth/logout', verifySession, async (req, res) => {
    try {
        const token = req.headers['x-session-token'];
        await userManager.deleteSession(token);
        
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
            defaultMode: req.user.defaultMode || 'humanlike',
            defaultConfigId: req.user.defaultConfigId || null
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
        
        // 验证旧密码
        const isValid = await userManager.verifyPassword(req.user.username, oldPassword);
        
        if (!isValid) {
            return res.json({
                success: false,
                error: '旧密码错误'
            });
        }
        
        // 修改密码
        const success = await userManager.changePassword(req.user.username, newPassword);
        
        if (!success) {
            return res.json({
                success: false,
                error: '修改密码失败'
            });
        }
        
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
app.get('/api/users', verifySession, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: '权限不足'
        });
    }
    
    try {
        // 注意：这里需要在 userManager 中添加 getAllUsers 方法
        // 暂时返回空数组，后续可以扩展
        res.json({
            success: true,
            users: []
        });
    } catch (error) {
        res.json({
            success: false,
            error: '获取用户列表失败'
        });
    }
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
        
        // 检查用户是否已存在
        const existingUser = await userManager.getUserByUsername(username);
        if (existingUser) {
            return res.json({
                success: false,
                error: '用户名已存在'
            });
        }
        
        // 创建用户
        const newUser = await userManager.createUser({
            username,
            password,
            role: 'user',
            claudeApiKey: claudeApiKey || '',
            claudeBaseURL: 'https://api.api123.icu'
        });
        
        console.log(`管理员 ${req.user.username} 创建用户 ${username}`);
        
        res.json({
            success: true,
            message: '用户创建成功',
            user: {
                username: newUser.username,
                apiKey: newUser.apiKey
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
app.delete('/api/users/:username', verifySession, async (req, res) => {
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
        
        // 注意：需要在 userManager 中添加 deleteUser 方法
        // 暂时返回错误
        res.json({
            success: false,
            error: '删除用户功能暂未实现'
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

// 路由：更新用户 Claude API Key
app.post('/api/users/claude-key', verifySession, async (req, res) => {
    try {
        const { claudeApiKey } = req.body;
        
        if (!claudeApiKey) {
            return res.json({
                success: false,
                error: '请输入 Claude API Key'
            });
        }
        
        const success = await userManager.updateUser(req.user.username, { claudeApiKey });
        
        if (!success) {
            return res.json({
                success: false,
                error: '更新失败'
            });
        }
        
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
app.post('/api/users/claude-baseurl', verifySession, async (req, res) => {
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
        
        const success = await userManager.updateUser(req.user.username, { claudeBaseURL });
        
        if (!success) {
            return res.json({
                success: false,
                error: '更新失败'
            });
        }
        
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
app.post('/api/users/api-type', verifySession, async (req, res) => {
    try {
        const { apiType } = req.body;
        
        const validTypes = ['auto', 'openai', 'anthropic', 'gemini', 'cohere', 'qwen', 'wenxin', 'azure-openai'];
        
        if (!apiType || !validTypes.includes(apiType)) {
            return res.json({
                success: false,
                error: '无效的 API 类型'
            });
        }
        
        const success = await userManager.updateUser(req.user.username, { apiType });
        
        if (!success) {
            return res.json({
                success: false,
                error: '设置失败'
            });
        }
        
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
app.post('/api/users/defaults', verifySession, async (req, res) => {
    try {
        const { defaultApiConfig, defaultModel, defaultMode } = req.body;
        
        const updates = {};
        if (defaultApiConfig !== undefined) updates.defaultConfigId = defaultApiConfig ? parseInt(defaultApiConfig) : null;
        if (defaultModel) updates.defaultModel = defaultModel;
        if (defaultMode) updates.defaultMode = defaultMode;
        
        const success = await userManager.updateUser(req.user.username, updates);
        
        if (!success) {
            return res.json({
                success: false,
                error: '更新失败'
            });
        }
        
        // 同步 api_configs 表的 is_default 标记
        // 这是一个额外的保障，确保两个表的数据一致
        if (defaultApiConfig) {
            const user = await userManager.getUserByUsername(req.user.username);
            if (user && user.id) {
                try {
                    await apiConfigManager.setDefaultApiConfig(user.id, parseInt(defaultApiConfig));
                } catch (syncError) {
                    console.error('同步 is_default 标记失败:', syncError);
                    // 不影响主流程，只记录错误
                }
            }
        }
        
        console.log(`用户 ${req.user.username} 更新默认配置 - API: ${defaultApiConfig}, 模型: ${defaultModel}, 模式: ${defaultMode}`);
        
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

// 路由：获取用户设置
app.get('/api/user/settings', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            settings: {
                defaultConfigId: user.defaultConfigId || null,
                defaultModel: user.defaultModel || 'claude-sonnet-4-5-20250929',
                defaultMode: user.defaultMode || 'humanlike'
            }
        });
    } catch (error) {
        console.error('获取用户设置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取用户设置失败'
        });
    }
});

// 路由：更新用户设置
app.put('/api/user/settings', verifySession, async (req, res) => {
    try {
        const { defaultConfigId, defaultModel, defaultMode } = req.body;
        
        const updates = {};
        if (defaultConfigId !== undefined) updates.defaultConfigId = defaultConfigId;
        if (defaultModel) updates.defaultModel = defaultModel;
        if (defaultMode) updates.defaultMode = defaultMode;
        
        const success = await userManager.updateUser(req.user.username, updates);
        
        if (!success) {
            return res.json({
                success: false,
                error: '更新失败'
            });
        }
        
        console.log(`用户 ${req.user.username} 更新用户设置`);
        
        res.json({
            success: true,
            message: '用户设置更新成功'
        });
        
    } catch (error) {
        console.error('更新用户设置失败:', error);
        res.json({
            success: false,
            error: '更新失败'
        });
    }
});

// 路由：重新生成 API Key
app.post('/api/users/regenerate-key', verifySession, async (req, res) => {
    try {
        const newApiKey = await userManager.regenerateApiKey(req.user.username);
        
        if (!newApiKey) {
            return res.json({
                success: false,
                error: '生成失败'
            });
        }
        
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

// ========== 令牌管理路由 ==========

// 路由：获取用户的所有令牌
app.get('/api/tokens', verifySession, async (req, res) => {
    try {
        const tokens = await tokenManager.getUserTokens(req.user.username);
        const stats = await tokenManager.getTokenStats(req.user.username);
        
        res.json({
            success: true,
            tokens: tokens,
            stats: stats
        });
    } catch (error) {
        console.error('获取令牌列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取令牌列表失败'
        });
    }
});

// 路由：创建新令牌
app.post('/api/tokens', verifySession, async (req, res) => {
    try {
        const { name } = req.body;
        
        const result = await tokenManager.createToken(req.user.username, name);
        
        if (result.success) {
            console.log(`用户 ${req.user.username} 创建新令牌: ${name || '未命名'}`);
            res.json({
                success: true,
                apiKey: result.apiKey,
                name: result.name,
                message: '令牌创建成功'
            });
        } else {
            res.json({
                success: false,
                error: result.error || '创建令牌失败'
            });
        }
    } catch (error) {
        console.error('创建令牌失败:', error);
        res.status(500).json({
            success: false,
            error: '创建令牌失败'
        });
    }
});

// 路由：删除令牌
app.delete('/api/tokens/:id', verifySession, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        
        const success = await tokenManager.deleteToken(req.user.username, tokenId);
        
        if (success) {
            console.log(`用户 ${req.user.username} 删除令牌 ID: ${tokenId}`);
            res.json({
                success: true,
                message: '令牌删除成功'
            });
        } else {
            res.json({
                success: false,
                error: '令牌不存在或删除失败'
            });
        }
    } catch (error) {
        console.error('删除令牌失败:', error);
        res.status(500).json({
            success: false,
            error: '删除令牌失败'
        });
    }
});

// 路由：重新生成令牌
app.post('/api/tokens/:id/regenerate', verifySession, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        
        const result = await tokenManager.regenerateToken(req.user.username, tokenId);
        
        if (result.success) {
            console.log(`用户 ${req.user.username} 重新生成令牌 ID: ${tokenId}`);
            res.json({
                success: true,
                apiKey: result.apiKey,
                message: '令牌重新生成成功'
            });
        } else {
            res.json({
                success: false,
                error: result.error || '重新生成令牌失败'
            });
        }
    } catch (error) {
        console.error('重新生成令牌失败:', error);
        res.status(500).json({
            success: false,
            error: '重新生成令牌失败'
        });
    }
});

// 路由：更新令牌状态
app.put('/api/tokens/:id/status', verifySession, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const { status } = req.body;
        
        if (!['active', 'disabled'].includes(status)) {
            return res.json({
                success: false,
                error: '无效的状态值'
            });
        }
        
        const success = await tokenManager.updateTokenStatus(req.user.username, tokenId, status);
        
        if (success) {
            console.log(`用户 ${req.user.username} 更新令牌状态 ID: ${tokenId}, 状态: ${status}`);
            res.json({
                success: true,
                message: '令牌状态更新成功'
            });
        } else {
            res.json({
                success: false,
                error: '令牌不存在或更新失败'
            });
        }
    } catch (error) {
        console.error('更新令牌状态失败:', error);
        res.status(500).json({
            success: false,
            error: '更新令牌状态失败'
        });
    }
});

// 路由：更新令牌名称
app.put('/api/tokens/:id/name', verifySession, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const { name } = req.body;
        
        const success = await tokenManager.updateTokenName(req.user.username, tokenId, name);
        
        if (success) {
            console.log(`用户 ${req.user.username} 更新令牌名称 ID: ${tokenId}`);
            res.json({
                success: true,
                message: '令牌名称更新成功'
            });
        } else {
            res.json({
                success: false,
                error: '令牌不存在或更新失败'
            });
        }
    } catch (error) {
        console.error('更新令牌名称失败:', error);
        res.status(500).json({
            success: false,
            error: '更新令牌名称失败'
        });
    }
});

// 路由：更新令牌节点配置
app.put('/api/tokens/:id/node-config', verifySession, async (req, res) => {
    try {
        const tokenId = parseInt(req.params.id);
        const { 
            nodeStrategy, 
            loadBalanceStrategy,
            loadBalanceNodes,
            allowedModels,
            defaultModel,
            fixedNodeId, 
            fixedModel 
        } = req.body;
        
        // 验证参数
        if (!['load_balance', 'fixed'].includes(nodeStrategy)) {
            return res.json({
                success: false,
                error: '无效的节点策略'
            });
        }
        
        if (nodeStrategy === 'fixed' && !fixedNodeId) {
            return res.json({
                success: false,
                error: '固定节点模式必须指定节点ID'
            });
        }
        
        // 验证负载均衡策略
        const validStrategies = ['round_robin', 'weighted', 'least_connections', 'random'];
        if (loadBalanceStrategy && !validStrategies.includes(loadBalanceStrategy)) {
            return res.json({
                success: false,
                error: '无效的负载均衡策略'
            });
        }
        
        // 调试日志：查看接收到的数据
        console.log('[令牌配置] 接收到的数据:', {
            nodeStrategy,
            loadBalanceStrategy,
            loadBalanceNodes: loadBalanceNodes,
            loadBalanceNodesType: typeof loadBalanceNodes,
            allowedModels: allowedModels,
            allowedModelsType: typeof allowedModels,
            defaultModel
        });
        
        const config = {
            nodeStrategy,
            loadBalanceStrategy: nodeStrategy === 'load_balance' ? (loadBalanceStrategy || 'round_robin') : null,
            loadBalanceNodes: nodeStrategy === 'load_balance' ? loadBalanceNodes : null,
            allowedModels: allowedModels || null,
            defaultModel: defaultModel || null,
            fixedNodeId: nodeStrategy === 'fixed' ? fixedNodeId : null,
            fixedModel: nodeStrategy === 'fixed' ? fixedModel : null
        };
        
        console.log('[令牌配置] 准备保存的配置:', config);
        
        const success = await tokenManager.updateTokenNodeConfig(
            req.user.username, 
            tokenId, 
            config
        );
        
        if (success) {
            console.log(`用户 ${req.user.username} 更新令牌节点配置 ID: ${tokenId}, 策略: ${nodeStrategy}`);
            res.json({
                success: true,
                message: '节点配置更新成功'
            });
        } else {
            res.json({
                success: false,
                error: '令牌不存在或更新失败'
            });
        }
    } catch (error) {
        console.error('更新令牌节点配置失败:', error);
        res.status(500).json({
            success: false,
            error: '更新节点配置失败'
        });
    }
});

// ========== API 配置管理路由 ==========

// 路由：获取用户的所有 API 配置
app.get('/api/configs', verifySession, async (req, res) => {
    try {
        const configs = await configManager.getUserConfigs(req.user.username);
        
        // 转换字段名以保持兼容性
        const responseConfigs = configs.map(config => ({
            id: config.id,
            name: config.name,
            api_url: config.apiUrl,
            api_type: config.apiType,
            available_models: config.availableModels,
            is_default: config.isDefault,
            is_active: config.isActive,
            created_at: config.createdAt,
            updated_at: config.updatedAt
        }));
        
        res.json({
            success: true,
            configs: responseConfigs
        });
    } catch (error) {
        console.error('获取配置列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置列表失败'
        });
    }
});

// 路由：获取单个配置详情
app.get('/api/configs/:id', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const config = await configManager.getConfig(req.user.username, configId);
        
        if (config) {
            // 转换字段名以保持兼容性
            const responseConfig = {
                id: config.id,
                name: config.name,
                api_url: config.apiUrl,
                api_key: config.apiKey,
                api_type: config.apiType,
                available_models: config.availableModels,
                is_default: config.isDefault,
                created_at: config.createdAt,
                updated_at: config.updatedAt
            };
            
            res.json({
                success: true,
                config: responseConfig
            });
        } else {
            res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
    } catch (error) {
        console.error('获取配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取配置失败'
        });
    }
});

// 路由：获取节点的模型列表
app.get('/api/configs/:id/models', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const config = await configManager.getConfig(req.user.username, configId);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
        
        // 返回该节点配置的模型列表
        res.json({
            success: true,
            models: config.availableModels || []
        });
    } catch (error) {
        console.error('获取节点模型列表失败:', error);
        res.status(500).json({
            success: false,
            error: '获取节点模型列表失败'
        });
    }
});

// 路由：创建新的 API 配置
app.post('/api/configs', verifySession, async (req, res) => {
    try {
        const { name, apiUrl, apiKey, apiType, availableModels, isDefault } = req.body;
        
        if (!name || !apiUrl || !apiKey || !apiType) {
            return res.json({
                success: false,
                error: '请填写所有必填项'
            });
        }
        
        const result = await configManager.createConfig(req.user.username, {
            name,
            apiUrl,
            apiKey,
            apiType,
            availableModels,
            isDefault
        });
        
        if (result.success) {
            console.log(`用户 ${req.user.username} 创建新配置: ${name}`);
            
            // 获取刚创建的配置详情
            const newConfig = await configManager.getConfig(req.user.username, result.id);
            
            // 转换字段名以保持兼容性
            const responseConfig = {
                id: newConfig.id,
                name: newConfig.name,
                api_url: newConfig.apiUrl,
                api_key: newConfig.apiKey,
                api_type: newConfig.apiType,
                available_models: newConfig.availableModels,
                is_default: newConfig.isDefault,
                created_at: newConfig.createdAt,
                updated_at: newConfig.updatedAt
            };
            
            res.json({
                success: true,
                id: result.id,
                config: responseConfig,
                message: '配置创建成功'
            });
        } else {
            res.json({
                success: false,
                error: result.error || '创建配置失败'
            });
        }
    } catch (error) {
        console.error('创建配置失败:', error);
        res.status(500).json({
            success: false,
            error: '创建配置失败'
        });
    }
});

// 路由：更新 API 配置
app.put('/api/configs/:id', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const { name, apiUrl, apiKey, apiType, availableModels, isDefault } = req.body;
        
        const result = await configManager.updateConfig(req.user.username, configId, {
            name,
            apiUrl,
            apiKey,
            apiType,
            availableModels,
            isDefault
        });
        
        if (result.success) {
            console.log(`用户 ${req.user.username} 更新配置 ID: ${configId}`);
            res.json({
                success: true,
                message: '配置更新成功'
            });
        } else {
            res.json({
                success: false,
                error: result.error || '配置不存在或更新失败'
            });
        }
    } catch (error) {
        console.error('更新配置失败:', error);
        res.status(500).json({
            success: false,
            error: '更新配置失败'
        });
    }
});

// 路由：删除 API 配置
app.delete('/api/configs/:id', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        
        const success = await configManager.deleteConfig(req.user.username, configId);
        
        if (success) {
            console.log(`用户 ${req.user.username} 删除配置 ID: ${configId}`);
            res.json({
                success: true,
                message: '配置删除成功'
            });
        } else {
            res.json({
                success: false,
                error: '配置不存在或删除失败'
            });
        }
    } catch (error) {
        console.error('删除配置失败:', error);
        res.status(500).json({
            success: false,
            error: '删除配置失败'
        });
    }
});

// 路由：设置默认配置
app.put('/api/configs/:id/default', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        
        const success = await configManager.setDefaultConfig(req.user.username, configId);
        
        if (success) {
            console.log(`用户 ${req.user.username} 设置默认配置 ID: ${configId}`);
            res.json({
                success: true,
                message: '默认配置设置成功'
            });
        } else {
            res.json({
                success: false,
                error: '配置不存在或设置失败'
            });
        }
    } catch (error) {
        console.error('设置默认配置失败:', error);
        res.status(500).json({
            success: false,
            error: '设置默认配置失败'
        });
    }
});

// 路由：自动探测 API 类型
app.post('/api/configs/detect', verifySession, async (req, res) => {
    try {
        const { apiUrl, apiKey } = req.body;
        
        if (!apiUrl || !apiKey) {
            return res.json({
                success: false,
                error: '请提供 API URL 和 API Key'
            });
        }
        
        const result = await configManager.detectAPIType(apiUrl, apiKey);
        
        res.json(result);
    } catch (error) {
        console.error('探测 API 类型失败:', error);
        res.status(500).json({
            success: false,
            error: '探测 API 类型失败'
        });
    }
});

// 路由：测试 API 连接
app.post('/api/configs/:id/test', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const config = await configManager.getConfig(req.user.username, configId);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
        
        const result = await configManager.testConnection(config.apiUrl, config.apiKey, config.apiType);
        
        // 如果测试成功且获取到了模型列表，保存到数据库
        if (result.success && result.models && result.models.length > 0) {
            console.log(`[测试连接] 获取到 ${result.models.length} 个模型，正在保存...`);
            
            try {
                // 更新配置，保存模型列表
                await configManager.updateConfig(req.user.username, configId, {
                    availableModels: result.models
                });
                
                console.log(`[测试连接] 模型列表已保存到配置 ${configId}`);
                
                // 在返回结果中包含模型列表
                result.available_models = result.models;
            } catch (updateError) {
                console.error('[测试连接] 保存模型列表失败:', updateError);
                // 不影响测试结果，只是记录错误
            }
        } else if (result.success) {
            console.log(`[测试连接] 测试成功但未获取到模型列表`);
        }
        
        res.json(result);
    } catch (error) {
        console.error('测试连接失败:', error);
        res.status(500).json({
            success: false,
            error: '测试连接失败'
        });
    }
});

// ========== 多 API 配置管理路由（新系统）==========

// 获取用户的所有多 API 配置
app.get('/api/api-configs', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const configs = await apiConfigManager.getUserApiConfigs(user.id);
        res.json({
            success: true,
            configs: configs
        });
    } catch (error) {
        console.error('获取多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取多 API 配置失败'
        });
    }
});

// 获取单个多 API 配置
app.get('/api/api-configs/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const configId = parseInt(req.params.id);
        const config = await apiConfigManager.getApiConfig(user.id, configId);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
        
        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        console.error('获取多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '获取多 API 配置失败'
        });
    }
});

// 添加多 API 配置
app.post('/api/api-configs', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const {
            name,
            base_url,
            api_key,
            api_type = 'auto',
            is_default = false,
            is_active = true,
            priority = 0,
            models = [],
            description = ''
        } = req.body;
        
        console.log('添加 API 配置 - 接收到的数据:');
        console.log('  - name:', name);
        console.log('  - models:', models);
        console.log('  - models 类型:', typeof models);
        console.log('  - models 是否为数组:', Array.isArray(models));
        console.log('  - models 长度:', Array.isArray(models) ? models.length : 'N/A');
        
        // 验证必填字段
        if (!name || !base_url || !api_key) {
            return res.status(400).json({
                success: false,
                error: '名称、Base URL 和 API Key 为必填项'
            });
        }
        
        const configId = await apiConfigManager.addApiConfig(user.id, {
            name,
            base_url,
            api_key,
            api_type,
            is_default,
            is_active,
            priority,
            models,
            description
        });
        
        console.log(`用户 ${req.user.username} 添加多 API 配置: ${name}`);
        
        res.json({
            success: true,
            configId: configId,
            message: 'API 配置添加成功'
        });
    } catch (error) {
        console.error('添加多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '添加多 API 配置失败'
        });
    }
});

// 更新多 API 配置
app.put('/api/api-configs/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const configId = parseInt(req.params.id);
        const {
            name,
            base_url,
            api_key,
            api_type,
            is_default,
            is_active,
            priority,
            models,
            description
        } = req.body;
        
        console.log('更新 API 配置 - 接收到的数据:');
        console.log('  - configId:', configId);
        console.log('  - name:', name);
        console.log('  - models:', models);
        console.log('  - models 类型:', typeof models);
        console.log('  - models 是否为数组:', Array.isArray(models));
        console.log('  - models 长度:', Array.isArray(models) ? models.length : 'N/A');
        
        const success = await apiConfigManager.updateApiConfig(user.id, configId, {
            name,
            base_url,
            api_key,
            api_type,
            is_default,
            is_active,
            priority,
            models,
            description
        });
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或更新失败'
            });
        }
        
        console.log(`用户 ${req.user.username} 更新多 API 配置 ID: ${configId}`);
        
        res.json({
            success: true,
            message: 'API 配置更新成功'
        });
    } catch (error) {
        console.error('更新多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '更新多 API 配置失败'
        });
    }
});

// 删除多 API 配置
app.delete('/api/api-configs/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const configId = parseInt(req.params.id);
        const success = await apiConfigManager.deleteApiConfig(user.id, configId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或删除失败'
            });
        }
        
        console.log(`用户 ${req.user.username} 删除多 API 配置 ID: ${configId}`);
        
        res.json({
            success: true,
            message: 'API 配置已删除'
        });
    } catch (error) {
        console.error('删除多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '删除多 API 配置失败'
        });
    }
});

// 设置默认多 API 配置
app.post('/api/api-configs/:id/set-default', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const configId = parseInt(req.params.id);
        const success = await apiConfigManager.setDefaultApiConfig(user.id, configId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '配置不存在或设置失败'
            });
        }
        
        // 同步更新用户的 default_config_id
        // 这是一个额外的保障，确保两个表的数据一致
        try {
            await userManager.updateUser(req.user.username, { defaultConfigId: configId });
        } catch (syncError) {
            console.error('同步 default_config_id 失败:', syncError);
            // 不影响主流程，只记录错误
        }
        
        console.log(`用户 ${req.user.username} 设置默认多 API 配置 ID: ${configId}`);
        
        res.json({
            success: true,
            message: '默认配置已更新'
        });
    } catch (error) {
        console.error('设置默认多 API 配置失败:', error);
        res.status(500).json({
            success: false,
            error: '设置默认多 API 配置失败'
        });
    }
});

// 测试多 API 连接
app.post('/api/api-configs/test', verifySession, async (req, res) => {
    try {
        const { base_url, api_key, api_type = 'auto' } = req.body;
        
        if (!base_url || !api_key) {
            return res.status(400).json({
                success: false,
                error: 'Base URL 和 API Key 为必填项'
            });
        }
        
        // 使用 configManager 的测试连接功能
        const result = await configManager.testConnection(base_url, api_key, api_type);
        
        res.json(result);
    } catch (error) {
        console.error('测试多 API 连接失败:', error);
        res.status(500).json({
            success: false,
            error: '测试 API 连接失败'
        });
    }
});

// API 健康检查
app.post('/api/api-configs/health-check', verifySession, async (req, res) => {
    try {
        const { config_id } = req.body;
        
        if (!config_id) {
            return res.status(400).json({
                success: false,
                error: '配置 ID 为必填项'
            });
        }
        
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 获取配置
        const config = await apiConfigManager.getApiConfig(user.id, config_id);
        
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
        
        // 如果配置被禁用，直接返回离线
        if (!config.is_active) {
            return res.json({
                success: true,
                online: false,
                message: '配置已禁用'
            });
        }
        
        // 快速健康检查（只测试连接，不获取模型列表）
        try {
            const result = await configManager.comprehensiveHealthCheck(config.base_url, config.api_key, config.api_type);
            
            // 保存健康检查结果到数据库
            await apiConfigManager.updateHealthStatus(
                user.id,
                config_id,
                result.status,
                result.latency
            );
            
            // 保存详细日志
            await apiConfigManager.saveHealthLog(config_id, result);
            
            res.json({
                success: true,
                online: result.connectivity,
                status: result.status,
                latency: result.latency,
                authentication: result.authentication,
                quota_status: result.quota_status,
                quota_percentage: result.quota_percentage,
                error_message: result.error_message,
                last_check_at: new Date()
            });
        } catch (error) {
            // 保存离线状态到数据库
            await apiConfigManager.updateHealthStatus(
                user.id,
                config_id,
                'offline',
                0
            );
            
            // 保存错误日志
            await apiConfigManager.saveHealthLog(config_id, {
                status: 'offline',
                connectivity: false,
                latency: 0,
                authentication: 'unknown',
                auth_error_code: null,
                quota_status: 'unknown',
                quota_total: null,
                quota_used: null,
                quota_remaining: null,
                quota_percentage: null,
                error_message: error.message,
                response_code: null
            });
            
            res.json({
                success: true,
                online: false,
                status: 'offline',
                message: 'API 离线',
                error: error.message,
                last_check_at: new Date()
            });
        }
    } catch (error) {
        console.error('API 健康检查失败:', error);
        res.status(500).json({
            success: false,
            error: 'API 健康检查失败'
        });
    }
});

// API 健康历史
app.get('/api/api-configs/:id/health-history', verifySession, async (req, res) => {
    try {
        const configId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 100;
        
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 验证配置是否属于该用户
        const config = await apiConfigManager.getApiConfig(user.id, configId);
        if (!config) {
            return res.status(404).json({
                success: false,
                error: '配置不存在'
            });
        }
        
        // 获取健康历史
        const history = await apiConfigManager.getHealthHistory(configId, limit);
        
        res.json({
            success: true,
            history: history
        });
    } catch (error) {
        console.error('获取健康历史失败:', error);
        res.status(500).json({
            success: false,
            error: '获取健康历史失败'
        });
    }
});

// 故障转移历史
app.get('/api/failover-history', verifySession, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 获取故障转移历史
        const history = await apiConfigManager.getFailoverHistory(user.id, limit);
        
        res.json({
            success: true,
            history: history
        });
    } catch (error) {
        console.error('获取故障转移历史失败:', error);
        res.status(500).json({
            success: false,
            error: '获取故障转移历史失败'
        });
    }
});

// ========== 监控和统计路由（阶段5-6）==========

// 获取总览统计
app.get('/api/stats/overview', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const statsCollector = require('./lib/statsCollector');
        const overview = await statsCollector.getOverviewStats(user.id, start, end);
        
        res.json({
            success: true,
            overview: overview,
            dateRange: { startDate: start, endDate: end }
        });
    } catch (error) {
        console.error('获取总览统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取总览统计失败'
        });
    }
});

// 获取所有节点统计
app.get('/api/stats/nodes', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const statsCollector = require('./lib/statsCollector');
        const nodesStats = await statsCollector.getAllNodesStats(user.id, start, end);
        
        res.json({
            success: true,
            nodes: nodesStats,
            dateRange: { startDate: start, endDate: end }
        });
    } catch (error) {
        console.error('获取节点统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取节点统计失败'
        });
    }
});

// 获取单个节点统计
app.get('/api/stats/nodes/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const nodeId = parseInt(req.params.id);
        const { startDate, endDate } = req.query;
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const statsCollector = require('./lib/statsCollector');
        const nodeStats = await statsCollector.getNodeStats(user.id, nodeId, start, end);
        
        res.json({
            success: true,
            stats: nodeStats,
            dateRange: { startDate: start, endDate: end }
        });
    } catch (error) {
        console.error('获取节点统计失败:', error);
        res.status(500).json({
            success: false,
            error: '获取节点统计失败'
        });
    }
});

// 获取时间趋势数据
app.get('/api/stats/trend', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const { nodeId, startDate, endDate, groupBy } = req.query;
        const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        const group = groupBy || 'hour';
        
        const statsCollector = require('./lib/statsCollector');
        const trend = await statsCollector.getTimeTrend(
            user.id,
            nodeId ? parseInt(nodeId) : null,
            start,
            end,
            group
        );
        
        res.json({
            success: true,
            trend: trend,
            dateRange: { startDate: start, endDate: end },
            groupBy: group
        });
    } catch (error) {
        console.error('获取时间趋势失败:', error);
        res.status(500).json({
            success: false,
            error: '获取时间趋势失败'
        });
    }
});

// 获取告警规则
app.get('/api/alert-rules', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const alertManager = require('./lib/alertManager');
        const rules = await alertManager.getAlertRules(user.id);
        
        res.json({
            success: true,
            rules: rules
        });
    } catch (error) {
        console.error('获取告警规则失败:', error);
        res.status(500).json({
            success: false,
            error: '获取告警规则失败'
        });
    }
});

// 创建告警规则
app.post('/api/alert-rules', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const { alertType, enabled, threshold, notifyEmail, notifyWebhook, webhookUrl } = req.body;
        
        if (!alertType) {
            return res.status(400).json({
                success: false,
                error: '告警类型为必填项'
            });
        }
        
        const alertManager = require('./lib/alertManager');
        const ruleId = await alertManager.createAlertRule(user.id, alertType, {
            enabled,
            threshold,
            notifyEmail,
            notifyWebhook,
            webhookUrl
        });
        
        res.json({
            success: true,
            ruleId: ruleId,
            message: '告警规则创建成功'
        });
    } catch (error) {
        console.error('创建告警规则失败:', error);
        res.status(500).json({
            success: false,
            error: '创建告警规则失败'
        });
    }
});

// 更新告警规则
app.put('/api/alert-rules/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const ruleId = parseInt(req.params.id);
        const updates = req.body;
        
        const alertManager = require('./lib/alertManager');
        const success = await alertManager.updateAlertRule(user.id, ruleId, updates);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '告警规则不存在或更新失败'
            });
        }
        
        res.json({
            success: true,
            message: '告警规则更新成功'
        });
    } catch (error) {
        console.error('更新告警规则失败:', error);
        res.status(500).json({
            success: false,
            error: '更新告警规则失败'
        });
    }
});

// 删除告警规则
app.delete('/api/alert-rules/:id', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const ruleId = parseInt(req.params.id);
        
        const alertManager = require('./lib/alertManager');
        const success = await alertManager.deleteAlertRule(user.id, ruleId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                error: '告警规则不存在或删除失败'
            });
        }
        
        res.json({
            success: true,
            message: '告警规则已删除'
        });
    } catch (error) {
        console.error('删除告警规则失败:', error);
        res.status(500).json({
            success: false,
            error: '删除告警规则失败'
        });
    }
});

// 获取告警日志
app.get('/api/alert-logs', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const limit = parseInt(req.query.limit) || 100;
        
        const alertManager = require('./lib/alertManager');
        const logs = await alertManager.getAlertLogs(user.id, limit);
        
        res.json({
            success: true,
            logs: logs
        });
    } catch (error) {
        console.error('获取告警日志失败:', error);
        res.status(500).json({
            success: false,
            error: '获取告警日志失败'
        });
    }
});

// 手动触发告警检查
app.post('/api/alert-check', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        if (!user || !user.id) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        const alertManager = require('./lib/alertManager');
        await alertManager.checkAlerts(user.id);
        
        res.json({
            success: true,
            message: '告警检查已完成'
        });
    } catch (error) {
        console.error('告警检查失败:', error);
        res.status(500).json({
            success: false,
            error: '告警检查失败'
        });
    }
});

// ========== 个人中心路由 ==========

// 路由：获取个人信息
app.get('/api/profile', verifySession, async (req, res) => {
    try {
        const user = await userManager.getUserByUsername(req.user.username);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: '用户不存在'
            });
        }
        
        // 获取统计信息
        const stats = await logger.getStats(req.user.username);
        const tokenStats = await tokenManager.getTokenStats(req.user.username);
        
        res.json({
            success: true,
            profile: {
                username: user.username,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            stats: {
                totalCalls: stats?.total?.calls || 0,
                successCalls: stats?.total?.success || 0,
                errorCalls: stats?.total?.error || 0,
                totalTokens: stats?.total?.totalTokens || 0,
                apiKeys: tokenStats
            }
        });
    } catch (error) {
        console.error('获取个人信息失败:', error);
        res.status(500).json({
            success: false,
            error: '获取个人信息失败'
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
    let apiKey = '';
    let apiType = '';
    let model = '';
    let mode = '';
    let text = '';
    let apiConfig = null; // 添加 apiConfig 变量定义
    
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
        
        // 模型优先级：请求参数 > 令牌固定模型 > 用户默认模型 > 系统默认
        if (req.body.model) {
            model = req.body.model;
        } else if (req.user.fixedModel) {
            model = req.user.fixedModel;
            console.log(`[请求 ${requestId}] 使用令牌固定模型: ${model}`);
        } else {
            model = req.user.defaultModel || 'claude-sonnet-4-5-20250929';
        }
        
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
        
        // 优先使用外部API配置，如果没有则降级到个人中心配置
        // apiConfig 已在外部定义，这里直接赋值
        
        // 1. 检查用户是否手动指定了节点（前端传递 config_id）
        if (req.body.config_id) {
            console.log(`[请求 ${requestId}] 用户手动指定节点 ID: ${req.body.config_id}`);
            apiConfig = await configManager.getConfig(req.user.username, req.body.config_id);
            
            if (apiConfig) {
                console.log(`[请求 ${requestId}] ✓ 使用用户指定节点: ${apiConfig.name}`);
                baseURL = apiConfig.apiUrl;
                apiKey = apiConfig.apiKey;
                apiType = apiConfig.apiType || 'auto';
                console.log(`[请求 ${requestId}] API 地址: ${baseURL}`);
                console.log(`[请求 ${requestId}] API 类型: ${apiType}`);
            } else {
                console.log(`[请求 ${requestId}] ⚠️ 指定的节点不存在或已禁用`);
            }
        }
        
        // 2. 检查令牌的节点配置策略
        if (!apiConfig && req.user.nodeStrategy === 'fixed' && req.user.fixedNodeId) {
            // 使用令牌指定的固定节点
            console.log(`[请求 ${requestId}] 令牌配置为固定节点模式，节点ID: ${req.user.fixedNodeId}`);
            apiConfig = await configManager.getConfig(req.user.username, req.user.fixedNodeId);
            
            if (apiConfig) {
                console.log(`[请求 ${requestId}] ✓ 使用令牌固定节点: ${apiConfig.name}`);
                baseURL = apiConfig.apiUrl;
                apiKey = apiConfig.apiKey;
                apiType = apiConfig.apiType || 'auto';
                console.log(`[请求 ${requestId}] API 地址: ${baseURL}`);
                console.log(`[请求 ${requestId}] API 类型: ${apiType}`);
            } else {
                console.log(`[请求 ${requestId}] ⚠️ 固定节点不存在或已禁用，降级到负载均衡模式`);
            }
        }
        
        // 3. 如果没有使用固定节点，则使用负载均衡或默认配置
        if (!apiConfig) {
            console.log(`[请求 ${requestId}] 使用负载均衡模式`);
            
            // 3.1 尝试获取用户的默认外部API配置
            if (req.user.defaultConfigId) {
                console.log(`[请求 ${requestId}] 尝试使用默认外部API配置 ID: ${req.user.defaultConfigId}`);
                apiConfig = await configManager.getConfig(req.user.username, req.user.defaultConfigId);
                
                if (apiConfig) {
                    console.log(`[请求 ${requestId}] ✓ 成功加载外部API配置: ${apiConfig.name}`);
                    baseURL = apiConfig.apiUrl;
                    apiKey = apiConfig.apiKey;
                    apiType = apiConfig.apiType || 'auto';
                    console.log(`[请求 ${requestId}] API 地址: ${baseURL}`);
                    console.log(`[请求 ${requestId}] API 类型: ${apiType}`);
                } else {
                    console.log(`[请求 ${requestId}] ⚠️ 未找到默认外部API配置，尝试获取任意默认配置`);
                }
            }
            
            // 3.2 如果没有指定默认配置ID，尝试获取标记为默认的配置
            if (!apiConfig) {
                apiConfig = await configManager.getDefaultConfig(req.user.username);
                if (apiConfig) {
                    console.log(`[请求 ${requestId}] ✓ 使用标记为默认的外部API配置: ${apiConfig.name}`);
                    baseURL = apiConfig.apiUrl;
                    apiKey = apiConfig.apiKey;
                    apiType = apiConfig.apiType || 'auto';
                    console.log(`[请求 ${requestId}] API 地址: ${baseURL}`);
                    console.log(`[请求 ${requestId}] API 类型: ${apiType}`);
                }
            }
        }
        
        // 4. 降级到个人中心的旧配置
        if (!apiConfig) {
            console.log(`[请求 ${requestId}] ⚠️ 未找到外部API配置，使用个人中心配置（旧系统）`);
            
            if (!req.user.claudeApiKey) {
                console.log(`[请求 ${requestId}] ❌ 错误: 用户未配置 API Key`);
                return res.json({
                    errcode: '100203',
                    errmsg: '用户未配置 API Key，请在"系统配置-外部API配置"中添加配置',
                    data: ''
                });
            }
            
            apiKey = req.user.claudeApiKey;
            baseURL = req.user.claudeBaseURL || 'https://api.api123.icu';
            apiType = req.user.apiType || 'auto';
            
            console.log(`[请求 ${requestId}] ✓ 使用个人中心配置`);
            console.log(`[请求 ${requestId}] API 地址: ${baseURL}`);
        }
        
        // 检测 API 类型
        apiType = detectAPIType(baseURL, apiType);
        console.log(`[请求 ${requestId}] 最终 API 类型: ${apiType} (自动识别)`);
        
        // 判断是否启用故障转移
        // 只有在用户没有手动指定节点时才启用故障转移
        const userSpecifiedNode = req.body.config_id ? true : false;
        let allConfigs = [];
        
        if (userSpecifiedNode) {
            // 用户手动指定了节点，只使用这个节点，不启用故障转移
            console.log(`[请求 ${requestId}] 用户手动指定节点，禁用故障转移`);
            if (apiConfig) {
                allConfigs.push(apiConfig);
            }
        } else {
            // 用户使用默认配置或负载均衡，启用故障转移
            console.log(`[请求 ${requestId}] 使用默认配置，启用故障转移`);
            
            if (apiConfig) {
                // 如果有选定的配置，先尝试它
                allConfigs.push(apiConfig);
                
                // 获取其他可用配置作为备用
                const otherConfigs = await configManager.getUserConfigs(req.user.username);
                for (const config of otherConfigs) {
                    if (config.id !== apiConfig.id && config.isActive) {
                        // 获取完整配置（包含 API Key）
                        const fullConfig = await configManager.getConfig(req.user.username, config.id);
                        if (fullConfig) {
                            allConfigs.push(fullConfig);
                        }
                    }
                }
            }
        }
        
        console.log(`[请求 ${requestId}] 可用节点数: ${allConfigs.length}, 故障转移: ${userSpecifiedNode ? '禁用' : '启用'}`);
        
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
                const message = await callAI(baseURL, apiKey, model, prompt, apiType);
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
            
            // 故障转移：尝试多个节点
            let message = null;
            let lastError = null;
            let usedNodeName = apiConfig ? apiConfig.name : '个人中心配置';
            
            if (allConfigs.length > 0) {
                // 尝试每个配置
                for (let i = 0; i < allConfigs.length; i++) {
                    const tryConfig = allConfigs[i];
                    try {
                        console.log(`[请求 ${requestId}] 尝试节点 ${i + 1}/${allConfigs.length}: ${tryConfig.name}`);
                        
                        message = await callAI(
                            tryConfig.apiUrl,
                            tryConfig.apiKey,
                            model,
                            prompt,
                            detectAPIType(tryConfig.apiUrl, tryConfig.apiType)
                        );
                        
                        usedNodeName = tryConfig.name;
                        
                        // 如果是故障转移（不是第一个节点）
                        if (i > 0) {
                            console.log(`[请求 ${requestId}] ✅ 故障转移成功: ${allConfigs[0].name} → ${tryConfig.name}`);
                            
                            // 记录故障转移日志
                            try {
                                await nodeSelector.logFailover(
                                    req.user.id,
                                    allConfigs[0].id,
                                    tryConfig.id,
                                    lastError?.message || 'API调用失败',
                                    {
                                        requestModel: model,
                                        requestEndpoint: '/api/rewrite',
                                        success: true,
                                        retryCount: i,
                                        fromNodeStatus: 'error',
                                        toNodeStatus: 'healthy'
                                    }
                                );
                            } catch (logError) {
                                console.error(`[请求 ${requestId}] 记录故障转移日志失败:`, logError);
                            }
                        }
                        
                        break; // 成功，跳出循环
                    } catch (error) {
                        lastError = error;
                        console.error(`[请求 ${requestId}] 节点 ${tryConfig.name} 失败:`, error.message);
                        
                        // 如果还有其他节点，继续尝试
                        if (i < allConfigs.length - 1) {
                            console.log(`[请求 ${requestId}] 准备尝试下一个节点...`);
                            continue;
                        } else {
                            // 所有节点都失败了
                            throw error;
                        }
                    }
                }
            } else {
                // 使用个人中心配置（无故障转移）
                message = await callAI(baseURL, apiKey, model, prompt, apiType);
            }
            
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
        
        // 记录成功的 API 调用（异步，不等待）
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
        }).catch(err => console.error('记录日志失败:', err));
        
        // 记录统计数据（用于监控仪表板）
        if (apiConfig && apiConfig.id) {
            const statsCollector = require('./lib/statsCollector');
            statsCollector.recordRequest(
                req.user.id,
                apiConfig.id,
                true, // 成功
                Date.now() - apiStartTime
            ).catch(err => console.error('记录统计失败:', err));
        }
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
        
        // 记录失败的 API 调用（异步，不等待）
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
        }).catch(err => console.error('记录日志失败:', err));
        
        // 记录统计数据（用于监控仪表板）
        if (apiConfig && apiConfig.id) {
            const statsCollector = require('./lib/statsCollector');
            statsCollector.recordRequest(
                req.user.id,
                apiConfig.id,
                false, // 失败
                Date.now() - startTime
            ).catch(err => console.error('记录统计失败:', err));
        }
        
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
// 路由：获取统计数据（需要登录）
app.get('/api/stats', verifySession, async (req, res) => {
    try {
        const username = req.user.role === 'admin' && req.query.username
            ? req.query.username
            : req.user.username;
        
        const stats = await logger.getStats(username);
        
        if (!stats) {
            return res.status(500).json({
                success: false,
                error: '获取统计数据失败'
            });
        }
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计数据失败'
        });
    }
});

// 路由：获取用户日志（需要登录）
// 路由：获取用户日志（需要登录，支持分页和筛选）
app.get('/api/logs', verifySession, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || parseInt(req.query.pageSize) || 20;
        const status = req.query.status || null;
        const model = req.query.model || null;
        const mode = req.query.mode || null;
        const search = req.query.search || null;
        const dateRange = req.query.dateRange || null;
        const startDate = req.query.startDate || null;
        const endDate = req.query.endDate || null;
        
        const username = req.user.role === 'admin' && req.query.username
            ? req.query.username
            : req.user.username;
        
        const result = await logger.getUserLogs(username, {
            page,
            pageSize: limit,
            status,
            model,
            mode,
            search,
            dateRange,
            startDate,
            endDate
        });
        
        // 获取筛选器选项
        const models = await logger.getUniqueModels(username);
        const modes = await logger.getUniqueModes(username);
        
        // 获取统计数据
        const stats = await logger.getStats(username);
        
        res.json({
            success: true,
            ...result,
            stats: stats ? {
                totalCalls: stats.total.calls || 0,
                successCalls: stats.total.success || 0,
                errorCalls: stats.total.error || 0,
                avgDuration: stats.total.avgDuration || 0,
                totalInputTokens: stats.total.totalInputTokens || 0,
                totalOutputTokens: stats.total.totalOutputTokens || 0
            } : null,
            filters: {
                models,
                modes
            }
        });
    } catch (error) {
        console.error('获取日志失败:', error);
        res.status(500).json({
            success: false,
            error: '获取日志失败'
        });
    }
});

// 路由：获取日志统计（不返回日志列表，只返回统计数据）
app.get('/api/logs/stats', verifySession, async (req, res) => {
    try {
        const username = req.user.role === 'admin' && req.query.username
            ? req.query.username
            : req.user.username;
        
        // 提取过滤参数
        const filters = {
            status: req.query.status || null,
            model: req.query.model || null,
            mode: req.query.mode || null,
            search: req.query.search || null,
            dateRange: req.query.dateRange || null,
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        };
        
        // 获取统计数据（带过滤）
        const stats = await logger.getStats(username, filters);
        
        res.json({
            success: true,
            totalCalls: stats?.total?.calls || 0,
            successCalls: stats?.total?.success || 0,
            failedCalls: stats?.total?.error || 0,
            avgDuration: stats?.total?.avgDuration || 0,
            totalInputTokens: stats?.total?.totalInputTokens || 0,
            totalOutputTokens: stats?.total?.totalOutputTokens || 0
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            error: '获取统计数据失败'
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

// 启动服务器（异步初始化数据库）
(async () => {
    try {
        console.log('🔌 连接数据库...');
        const connected = await testConnection();
        if (!connected) {
            console.error('❌ 数据库连接失败，请检查 .env 配置');
            process.exit(1);
        }
        
        console.log('📋 初始化数据库表...');
        await initDatabase();
        
        console.log('👤 初始化默认管理员...');
        await userManager.initDefaultAdmin();
        
        // 定期清理过期会话（每小时）
        setInterval(async () => {
            const cleaned = await userManager.cleanExpiredSessions();
            if (cleaned > 0) {
                console.log(`🧹 清理了 ${cleaned} 个过期会话`);
            }
        }, 60 * 60 * 1000);
        
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
            console.log(`数据库状态: ✓ 已连接`);
            console.log('');
        });
    } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
})();

// 错误处理
process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的 Promise 拒绝:', reason);
});
