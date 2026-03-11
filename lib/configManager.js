/**
 * API 配置管理模块
 * 管理用户的第三方 API 配置
 */

const { pool } = require('./database');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// 加密密钥（从环境变量获取）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const ALGORITHM = 'aes-256-cbc';

/**
 * 解密 API Key
 */
function decryptApiKey(encryptedApiKey) {
    if (!encryptedApiKey) return '';
    
    try {
        const parts = encryptedApiKey.split(':');
        if (parts.length !== 2) return encryptedApiKey; // 未加密的旧数据
        
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('解密失败:', error);
        return encryptedApiKey; // 返回原始值
    }
}

class ConfigManager {
    /**
     * 获取用户的所有 API 配置
     */
    async getUserConfigs(username) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return [];
            }
            const userId = users[0].id;
            
            const [rows] = await pool.query(
                `SELECT id, name, base_url, api_type, models, is_default, is_active, created_at, updated_at
                FROM api_configs 
                WHERE user_id = ? 
                ORDER BY is_default DESC, created_at DESC`,
                [userId]
            );
            
            return rows.map(row => ({
                id: row.id,
                name: row.name,
                apiUrl: row.base_url,
                apiType: row.api_type,
                availableModels: row.models ? JSON.parse(row.models) : [],
                isDefault: row.is_default === 1,
                isActive: row.is_active !== 0, // 默认为 true
                createdAt: row.created_at,
                updatedAt: row.updated_at
            }));
        } catch (error) {
            console.error('获取配置列表失败:', error.message);
            console.error('错误详情:', error);
            return [];
        }
    }
    
    /**
     * 获取单个配置（包含 API Key）
     */
    async getConfig(username, configId) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return null;
            }
            const userId = users[0].id;
            
            const [rows] = await pool.query(
                `SELECT * FROM api_configs WHERE id = ? AND user_id = ?`,
                [configId, userId]
            );
            
            if (rows.length === 0) {
                return null;
            }
            
            const row = rows[0];
            return {
                id: row.id,
                name: row.name,
                apiUrl: row.base_url,
                apiKey: decryptApiKey(row.api_key),
                apiType: row.api_type,
                availableModels: row.models ? JSON.parse(row.models) : [],
                isDefault: row.is_default === 1,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };
        } catch (error) {
            console.error('获取配置失败:', error.message);
            console.error('错误详情:', error);
            return null;
        }
    }
    
    /**
     * 创建新的 API 配置
     */
    async createConfig(username, configData) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return { success: false, error: '用户不存在' };
            }
            const userId = users[0].id;
            
            const { name, apiUrl, apiKey, apiType, availableModels, isDefault } = configData;
            
            // 如果设置为默认，先取消其他配置的默认状态
            if (isDefault) {
                await pool.query(
                    'UPDATE api_configs SET is_default = FALSE WHERE user_id = ?',
                    [userId]
                );
            }
            
            // 确保 availableModels 是有效的数组或 JSON 字符串
            let modelsValue = [];
            if (availableModels) {
                if (Array.isArray(availableModels)) {
                    modelsValue = availableModels;
                } else if (typeof availableModels === 'string') {
                    try {
                        modelsValue = JSON.parse(availableModels);
                        if (!Array.isArray(modelsValue)) {
                            modelsValue = [];
                        }
                    } catch (e) {
                        console.error('availableModels 不是有效的 JSON:', availableModels);
                        modelsValue = [];
                    }
                }
            }
            
            const [result] = await pool.query(
                `INSERT INTO api_configs (user_id, name, base_url, api_key, api_type, models, is_default) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, name, apiUrl, apiKey, apiType, JSON.stringify(modelsValue), isDefault || false]
            );
            
            return {
                success: true,
                id: result.insertId
            };
        } catch (error) {
            console.error('创建配置失败:', error.message);
            console.error('错误详情:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 更新 API 配置
     */
    async updateConfig(username, configId, configData) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return { success: false, error: '用户不存在' };
            }
            const userId = users[0].id;
            
            const { name, apiUrl, apiKey, apiType, availableModels, isDefault } = configData;
            
            // 如果设置为默认，先取消其他配置的默认状态
            if (isDefault) {
                await pool.query(
                    'UPDATE api_configs SET is_default = FALSE WHERE user_id = ? AND id != ?',
                    [userId, configId]
                );
            }
            
            const updates = [];
            const values = [];
            
            if (name !== undefined) {
                updates.push('name = ?');
                values.push(name);
            }
            if (apiUrl !== undefined) {
                updates.push('base_url = ?');
                values.push(apiUrl);
            }
            if (apiKey !== undefined) {
                updates.push('api_key = ?');
                values.push(apiKey);
            }
            if (apiType !== undefined) {
                updates.push('api_type = ?');
                values.push(apiType);
            }
            if (availableModels !== undefined) {
                updates.push('models = ?');
                values.push(JSON.stringify(availableModels));
            }
            if (isDefault !== undefined) {
                updates.push('is_default = ?');
                values.push(isDefault);
            }
            
            if (updates.length === 0) {
                return { success: true };
            }
            
            values.push(configId, userId);
            
            const [result] = await pool.query(
                `UPDATE api_configs SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                values
            );
            
            return {
                success: result.affectedRows > 0
            };
        } catch (error) {
            console.error('更新配置失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 删除 API 配置
     */
    async deleteConfig(username, configId) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return false;
            }
            const userId = users[0].id;
            
            const [result] = await pool.query(
                'DELETE FROM api_configs WHERE id = ? AND user_id = ?',
                [configId, userId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除配置失败:', error.message);
            return false;
        }
    }
    
    /**
     * 设置默认配置
     */
    async setDefaultConfig(username, configId) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return false;
            }
            const userId = users[0].id;
            
            // 先取消所有默认配置
            await pool.query(
                'UPDATE api_configs SET is_default = FALSE WHERE user_id = ?',
                [userId]
            );
            
            // 设置新的默认配置
            const [result] = await pool.query(
                'UPDATE api_configs SET is_default = TRUE WHERE id = ? AND user_id = ?',
                [configId, userId]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('设置默认配置失败:', error.message);
            return false;
        }
    }
    
    /**
     * 获取默认配置
     */
    async getDefaultConfig(username) {
        try {
            // 先获取用户ID
            const [users] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
            if (users.length === 0) {
                console.error('用户不存在:', username);
                return null;
            }
            const userId = users[0].id;
            
            const [rows] = await pool.query(
                `SELECT * FROM api_configs WHERE user_id = ? AND is_default = TRUE LIMIT 1`,
                [userId]
            );
            
            if (rows.length === 0) {
                return null;
            }
            
            const row = rows[0];
            return {
                id: row.id,
                name: row.name,
                apiUrl: row.base_url,
                apiKey: decryptApiKey(row.api_key),
                apiType: row.api_type,
                availableModels: row.models ? JSON.parse(row.models) : []
            };
        } catch (error) {
            console.error('获取默认配置失败:', error.message);
            console.error('错误详情:', error);
            return null;
        }
    }
    
    /**
     * 自动探测 API 类型
     */
    async detectAPIType(apiUrl, apiKey) {
        try {
            console.log(`[API 探测] 开始探测: ${apiUrl}`);
            
            // 确保 URL 包含 /v1
            let testURL = apiUrl;
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
                    timeout: 10000
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
                                console.log(`[API 探测] 识别为 OpenAI 格式`);
                                resolve({
                                    success: true,
                                    apiType: 'openai',
                                    models: response.data.map(m => m.id)
                                });
                            } else if (response.models || response.model) {
                                console.log(`[API 探测] 识别为 OpenAI 兼容格式`);
                                resolve({
                                    success: true,
                                    apiType: 'openai',
                                    models: response.models || [response.model]
                                });
                            } else {
                                console.log(`[API 探测] 无法确定格式，使用默认 OpenAI 格式`);
                                resolve({
                                    success: true,
                                    apiType: 'openai',
                                    models: []
                                });
                            }
                        } catch (error) {
                            console.log(`[API 探测] 响应解析失败，使用默认 OpenAI 格式`);
                            resolve({
                                success: true,
                                apiType: 'openai',
                                models: []
                            });
                        }
                    });
                });
                
                req.on('error', (error) => {
                    console.log(`[API 探测] 请求失败:`, error.message);
                    resolve({
                        success: false,
                        error: error.message
                    });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    console.log(`[API 探测] 请求超时`);
                    resolve({
                        success: false,
                        error: '请求超时'
                    });
                });
                
                req.end();
            });
        } catch (error) {
            console.log(`[API 探测] 探测异常:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 测试 API 连接
     */
    async testConnection(apiUrl, apiKey, apiType) {
        try {
            // 简单的测试：尝试获取模型列表
            const result = await this.detectAPIType(apiUrl, apiKey);
            return result;
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 快速健康检查（不获取模型列表，只测试连接）
     */
    async quickHealthCheck(apiUrl, apiKey, apiType) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            try {
                // 确保 URL 包含 /v1
                let testURL = apiUrl;
                if (!testURL.endsWith('/v1') && !testURL.includes('/v1/')) {
                    testURL = testURL.replace(/\/$/, '') + '/v1';
                }
                
                const url = new URL(`${testURL}/models`);
                const isHttps = url.protocol === 'https:';
                const httpModule = isHttps ? https : http;
                
                const options = {
                    hostname: url.hostname,
                    port: url.port || (isHttps ? 443 : 80),
                    path: url.pathname + url.search,
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 3000 // 3秒超时（比完整测试更快）
                };
                
                const req = httpModule.request(options, (res) => {
                    const latency = Date.now() - startTime;
                    
                    // 只要能收到响应（即使是错误响应），也认为 API 在线
                    if (res.statusCode >= 200 && res.statusCode < 500) {
                        resolve({
                            success: true,
                            latency: latency
                        });
                    } else {
                        resolve({
                            success: false,
                            latency: latency
                        });
                    }
                    
                    // 清理响应数据
                    res.on('data', () => {});
                    res.on('end', () => {});
                });
                
                req.on('error', () => {
                    resolve({
                        success: false,
                        latency: Date.now() - startTime
                    });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        latency: Date.now() - startTime
                    });
                });
                
                req.end();
            } catch (error) {
                resolve({
                    success: false,
                    latency: Date.now() - startTime
                });
            }
        });
    }

    /**
     * 增强健康检查（包含认证和额度检测）
     */
    async comprehensiveHealthCheck(apiUrl, apiKey, apiType) {
        const startTime = Date.now();
        const result = {
            connectivity: false,
            latency: 0,
            authentication: 'unknown',
            auth_error_code: null,
            quota_status: 'unknown',
            quota_total: null,
            quota_used: null,
            quota_remaining: null,
            quota_percentage: null,
            status: 'offline',
            error_message: null,
            response_code: null
        };
        
        return new Promise((resolve) => {
            try {
                // 确保 URL 包含 /v1
                let testURL = apiUrl;
                if (!testURL.endsWith('/v1') && !testURL.includes('/v1/')) {
                    testURL = testURL.replace(/\/$/, '') + '/v1';
                }
                
                const url = new URL(`${testURL}/models`);
                const isHttps = url.protocol === 'https:';
                const httpModule = isHttps ? https : http;
                
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
                    result.latency = Date.now() - startTime;
                    result.response_code = res.statusCode;
                    
                    let data = '';
                    
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    
                    res.on('end', () => {
                        // 1. 检查连接状态
                        if (res.statusCode >= 200 && res.statusCode < 600) {
                            result.connectivity = true;
                        }
                        
                        // 2. 检查认证状态
                        if (res.statusCode === 200) {
                            result.authentication = 'valid';
                        } else if (res.statusCode === 401 || res.statusCode === 403) {
                            result.authentication = 'invalid';
                            result.auth_error_code = res.statusCode;
                            result.error_message = res.statusCode === 401 ? 'API Key 无效或已过期' : '没有访问权限';
                        } else if (res.statusCode >= 400 && res.statusCode < 500) {
                            result.authentication = 'unknown';
                            result.error_message = `客户端错误: ${res.statusCode}`;
                        } else if (res.statusCode >= 500) {
                            result.authentication = 'unknown';
                            result.error_message = `服务器错误: ${res.statusCode}`;
                        }
                        
                        // 3. 检查额度状态（从响应头）
                        const rateLimitRemaining = res.headers['x-ratelimit-remaining-tokens'] || 
                                                  res.headers['x-ratelimit-remaining-requests'];
                        const rateLimitTotal = res.headers['x-ratelimit-limit-tokens'] || 
                                              res.headers['x-ratelimit-limit-requests'];
                        
                        if (rateLimitRemaining && rateLimitTotal) {
                            result.quota_remaining = parseInt(rateLimitRemaining);
                            result.quota_total = parseInt(rateLimitTotal);
                            result.quota_used = result.quota_total - result.quota_remaining;
                            result.quota_percentage = (result.quota_remaining / result.quota_total * 100).toFixed(2);
                            
                            if (result.quota_percentage > 20) {
                                result.quota_status = 'sufficient';
                            } else if (result.quota_percentage > 0) {
                                result.quota_status = 'low';
                            } else {
                                result.quota_status = 'exhausted';
                            }
                        }
                        
                        // 4. 综合状态判断
                        if (!result.connectivity) {
                            result.status = 'offline';
                        } else if (result.authentication === 'invalid') {
                            result.status = 'error';
                        } else if (result.authentication === 'valid') {
                            if (result.quota_status === 'exhausted') {
                                result.status = 'error';
                            } else if (result.quota_status === 'low') {
                                result.status = 'warning';
                            } else {
                                result.status = 'healthy';
                            }
                        } else {
                            // 认证状态未知，但能连接
                            result.status = 'warning';
                        }
                        
                        resolve(result);
                    });
                });
                
                req.on('error', (error) => {
                    result.latency = Date.now() - startTime;
                    result.connectivity = false;
                    result.status = 'offline';
                    result.error_message = error.message;
                    resolve(result);
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    result.latency = Date.now() - startTime;
                    result.connectivity = false;
                    result.status = 'offline';
                    result.error_message = '连接超时';
                    resolve(result);
                });
                
                req.end();
            } catch (error) {
                result.latency = Date.now() - startTime;
                result.connectivity = false;
                result.status = 'offline';
                result.error_message = error.message;
                resolve(result);
            }
        });
    }
}

module.exports = new ConfigManager();
