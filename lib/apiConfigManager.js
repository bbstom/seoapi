/**
 * API 配置管理器
 * 支持多个外部 API 配置
 */

const { pool } = require('./database');
const crypto = require('crypto');

// 加密密钥（从环境变量获取）
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const ALGORITHM = 'aes-256-cbc';

/**
 * 加密 API Key
 */
function encryptApiKey(apiKey) {
    if (!apiKey) return '';
    
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
}

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

/**
 * 获取用户的所有 API 配置
 */
async function getUserApiConfigs(userId) {
    const [configs] = await pool.query(
        `SELECT id, name, base_url, api_key, api_type, is_default, is_active, 
                priority, weight, models, description, 
                health_status, last_check_at, avg_latency,
                created_at, updated_at
         FROM api_configs 
         WHERE user_id = ? 
         ORDER BY priority DESC, created_at DESC`,
        [userId]
    );
    
    // 解密 API Key
    return configs.map(config => ({
        ...config,
        api_key: decryptApiKey(config.api_key),
        models: config.models ? JSON.parse(config.models) : []
    }));
}

/**
 * 获取用户的默认 API 配置
 */
async function getDefaultApiConfig(userId) {
    const [configs] = await pool.query(
        `SELECT id, name, base_url, api_key, api_type, is_default, is_active, 
                priority, models, description
         FROM api_configs 
         WHERE user_id = ? AND is_default = TRUE AND is_active = TRUE
         LIMIT 1`,
        [userId]
    );
    
    if (configs.length > 0) {
        return {
            ...configs[0],
            api_key: decryptApiKey(configs[0].api_key),
            models: configs[0].models ? JSON.parse(configs[0].models) : []
        };
    }
    
    // 如果没有默认配置，返回优先级最高的启用配置
    const [fallback] = await pool.query(
        `SELECT id, name, base_url, api_key, api_type, is_default, is_active, 
                priority, models, description
         FROM api_configs 
         WHERE user_id = ? AND is_active = TRUE
         ORDER BY priority DESC, created_at DESC
         LIMIT 1`,
        [userId]
    );
    
    if (fallback.length > 0) {
        return {
            ...fallback[0],
            api_key: decryptApiKey(fallback[0].api_key),
            models: fallback[0].models ? JSON.parse(fallback[0].models) : []
        };
    }
    
    return null;
}

/**
 * 获取用户的所有启用的 API 配置（按优先级排序）
 */
async function getActiveApiConfigs(userId) {
    const [configs] = await pool.query(
        `SELECT id, name, base_url, api_key, api_type, is_default, is_active, 
                priority, models, description
         FROM api_configs 
         WHERE user_id = ? AND is_active = TRUE
         ORDER BY priority DESC, created_at DESC`,
        [userId]
    );
    
    return configs.map(config => ({
        ...config,
        api_key: decryptApiKey(config.api_key),
        models: config.models ? JSON.parse(config.models) : []
    }));
}

/**
 * 添加 API 配置
 */
async function addApiConfig(userId, configData) {
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
    } = configData;
    
    // 如果设置为默认，先取消其他配置的默认状态
    if (is_default) {
        await pool.query(
            'UPDATE api_configs SET is_default = FALSE WHERE user_id = ?',
            [userId]
        );
    }
    
    // 加密 API Key
    const encryptedApiKey = encryptApiKey(api_key);
    
    const [result] = await pool.query(
        `INSERT INTO api_configs 
         (user_id, name, base_url, api_key, api_type, is_default, is_active, priority, models, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, base_url, encryptedApiKey, api_type, is_default, is_active, priority, 
         JSON.stringify(models), description]
    );
    
    return result.insertId;
}

/**
 * 更新 API 配置
 */
async function updateApiConfig(userId, configId, configData) {
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
    } = configData;
    
    // 如果设置为默认，先取消其他配置的默认状态
    if (is_default) {
        await pool.query(
            'UPDATE api_configs SET is_default = FALSE WHERE user_id = ? AND id != ?',
            [userId, configId]
        );
    }
    
    // 构建更新语句
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
    }
    if (base_url !== undefined) {
        updates.push('base_url = ?');
        values.push(base_url);
    }
    if (api_key !== undefined) {
        updates.push('api_key = ?');
        values.push(encryptApiKey(api_key));
    }
    if (api_type !== undefined) {
        updates.push('api_type = ?');
        values.push(api_type);
    }
    if (is_default !== undefined) {
        updates.push('is_default = ?');
        values.push(is_default);
    }
    if (is_active !== undefined) {
        updates.push('is_active = ?');
        values.push(is_active);
    }
    if (priority !== undefined) {
        updates.push('priority = ?');
        values.push(priority);
    }
    if (models !== undefined) {
        updates.push('models = ?');
        values.push(JSON.stringify(models));
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    
    if (updates.length === 0) {
        return false;
    }
    
    values.push(userId, configId);
    
    const [result] = await pool.query(
        `UPDATE api_configs SET ${updates.join(', ')} WHERE user_id = ? AND id = ?`,
        values
    );
    
    return result.affectedRows > 0;
}

/**
 * 删除 API 配置
 */
async function deleteApiConfig(userId, configId) {
    const [result] = await pool.query(
        'DELETE FROM api_configs WHERE user_id = ? AND id = ?',
        [userId, configId]
    );
    
    return result.affectedRows > 0;
}

/**
 * 设置默认 API 配置
 */
async function setDefaultApiConfig(userId, configId) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 取消所有默认状态
        await connection.query(
            'UPDATE api_configs SET is_default = FALSE WHERE user_id = ?',
            [userId]
        );
        
        // 设置新的默认配置
        await connection.query(
            'UPDATE api_configs SET is_default = TRUE WHERE user_id = ? AND id = ?',
            [userId, configId]
        );
        
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 获取单个 API 配置
 */
async function getApiConfig(userId, configId) {
    const [configs] = await pool.query(
        `SELECT id, name, base_url, api_key, api_type, is_default, is_active, 
                priority, models, description, created_at, updated_at
         FROM api_configs 
         WHERE user_id = ? AND id = ?`,
        [userId, configId]
    );
    
    if (configs.length === 0) {
        return null;
    }
    
    return {
        ...configs[0],
        api_key: decryptApiKey(configs[0].api_key),
        models: configs[0].models ? JSON.parse(configs[0].models) : []
    };
}

/**
 * 更新节点健康状态
 */
async function updateHealthStatus(userId, configId, healthStatus, latency) {
    try {
        await pool.query(
            `UPDATE api_configs 
             SET health_status = ?, 
                 last_check_at = NOW(), 
                 avg_latency = ? 
             WHERE user_id = ? AND id = ?`,
            [healthStatus, latency || 0, userId, configId]
        );
        return true;
    } catch (error) {
        console.error('更新健康状态失败:', error);
        return false;
    }
}

/**
 * 保存健康检查日志
 */
async function saveHealthLog(nodeId, healthData) {
    try {
        await pool.query(
            `INSERT INTO node_health_logs 
             (node_id, status, connectivity, latency, authentication, auth_error_code,
              quota_status, quota_total, quota_used, quota_remaining, quota_percentage,
              error_message, response_code, response_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nodeId,
                healthData.status,
                healthData.connectivity,
                healthData.latency,
                healthData.authentication,
                healthData.auth_error_code,
                healthData.quota_status,
                healthData.quota_total,
                healthData.quota_used,
                healthData.quota_remaining,
                healthData.quota_percentage,
                healthData.error_message,
                healthData.response_code,
                healthData.latency
            ]
        );
        return true;
    } catch (error) {
        console.error('保存健康日志失败:', error);
        return false;
    }
}

/**
 * 获取节点健康历史
 */
async function getHealthHistory(nodeId, limit = 100) {
    try {
        const [logs] = await pool.query(
            `SELECT * FROM node_health_logs 
             WHERE node_id = ? 
             ORDER BY check_time DESC 
             LIMIT ?`,
            [nodeId, limit]
        );
        return logs;
    } catch (error) {
        console.error('获取健康历史失败:', error);
        return [];
    }
}

/**
 * 获取故障转移历史
 */
async function getFailoverHistory(userId, limit = 100) {
    try {
        const [logs] = await pool.query(
            `SELECT 
                fl.*,
                fn.name as from_node_name,
                tn.name as to_node_name
             FROM failover_logs fl
             LEFT JOIN api_configs fn ON fl.from_node_id = fn.id
             LEFT JOIN api_configs tn ON fl.to_node_id = tn.id
             WHERE fl.user_id = ?
             ORDER BY fl.failover_time DESC
             LIMIT ?`,
            [userId, limit]
        );
        return logs;
    } catch (error) {
        console.error('获取故障转移历史失败:', error);
        return [];
    }
}

module.exports = {
    getUserApiConfigs,
    getDefaultApiConfig,
    getActiveApiConfigs,
    addApiConfig,
    updateApiConfig,
    deleteApiConfig,
    setDefaultApiConfig,
    getApiConfig,
    updateHealthStatus,
    saveHealthLog,
    getHealthHistory,
    getFailoverHistory,
    encryptApiKey,
    decryptApiKey
};
