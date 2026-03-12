/**
 * 令牌管理模块
 * 管理用户的多个 API Key
 */

const { pool } = require('./database');
const crypto = require('crypto');

class TokenManager {
    /**
     * 生成 API Key
     */
    generateApiKey() {
        return 'sk_' + crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * 获取用户的所有 API Key
     */
    async getUserTokens(username) {
        try {
            const [rows] = await pool.query(
                `SELECT id, api_key, name, status, created_at, last_used_at, 
                node_strategy, load_balance_strategy, load_balance_nodes, default_model,
                fixed_node_id, fixed_model 
                FROM api_keys 
                WHERE username = ? 
                ORDER BY created_at DESC`,
                [username]
            );
            
            return rows.map(row => ({
                id: row.id,
                apiKey: row.api_key,
                name: row.name,
                status: row.status,
                createdAt: row.created_at,
                lastUsedAt: row.last_used_at,
                nodeStrategy: row.node_strategy,
                loadBalanceStrategy: row.load_balance_strategy,
                loadBalanceNodes: row.load_balance_nodes ? JSON.parse(row.load_balance_nodes) : null,
                defaultModel: row.default_model,
                fixedNodeId: row.fixed_node_id,
                fixedModel: row.fixed_model
            }));
        } catch (error) {
            console.error('获取令牌列表失败:', error.message);
            return [];
        }
    }
    
    /**
     * 创建新的 API Key
     */
    async createToken(username, name = null) {
        try {
            const apiKey = this.generateApiKey();
            
            await pool.query(
                `INSERT INTO api_keys (username, api_key, name, status) 
                VALUES (?, ?, ?, 'active')`,
                [username, apiKey, name]
            );
            
            return {
                success: true,
                apiKey: apiKey,
                name: name
            };
        } catch (error) {
            console.error('创建令牌失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 删除 API Key
     */
    async deleteToken(username, tokenId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM api_keys WHERE id = ? AND username = ?',
                [tokenId, username]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除令牌失败:', error.message);
            return false;
        }
    }
    
    /**
     * 重新生成 API Key
     */
    async regenerateToken(username, tokenId) {
        try {
            const newApiKey = this.generateApiKey();
            
            const [result] = await pool.query(
                'UPDATE api_keys SET api_key = ? WHERE id = ? AND username = ?',
                [newApiKey, tokenId, username]
            );
            
            if (result.affectedRows > 0) {
                return {
                    success: true,
                    apiKey: newApiKey
                };
            }
            
            return {
                success: false,
                error: '令牌不存在'
            };
        } catch (error) {
            console.error('重新生成令牌失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 更新令牌状态
     */
    async updateTokenStatus(username, tokenId, status) {
        try {
            const [result] = await pool.query(
                'UPDATE api_keys SET status = ? WHERE id = ? AND username = ?',
                [status, tokenId, username]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新令牌状态失败:', error.message);
            return false;
        }
    }
    
    /**
     * 更新令牌名称
     */
    async updateTokenName(username, tokenId, name) {
        try {
            const [result] = await pool.query(
                'UPDATE api_keys SET name = ? WHERE id = ? AND username = ?',
                [name, tokenId, username]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新令牌名称失败:', error.message);
            return false;
        }
    }
    
    /**
     * 更新令牌最后使用时间
     */
    async updateLastUsed(apiKey) {
        try {
            await pool.query(
                'UPDATE api_keys SET last_used_at = NOW() WHERE api_key = ?',
                [apiKey]
            );
        } catch (error) {
            console.error('更新令牌使用时间失败:', error.message);
        }
    }
    
    /**
     * 验证 API Key（检查是否存在且启用）
     */
    async verifyToken(apiKey) {
        try {
            const [rows] = await pool.query(
                `SELECT ak.*, u.id as user_id, u.username, u.role, u.claude_api_key, u.claude_base_url, 
                u.api_type, u.default_model, u.default_mode, u.default_config_id
                FROM api_keys ak
                JOIN users u ON ak.username = u.username
                WHERE ak.api_key = ? AND ak.status = 'active'`,
                [apiKey]
            );
            
            if (rows.length === 0) {
                return null;
            }
            
            // 更新最后使用时间（异步，不等待）
            this.updateLastUsed(apiKey).catch(() => {});
            
            const row = rows[0];
            return {
                id: row.user_id,  // 添加用户 ID
                username: row.username,
                role: row.role,
                apiKey: row.api_key,
                claudeApiKey: row.claude_api_key,
                claudeBaseURL: row.claude_base_url,
                apiType: row.api_type,
                defaultModel: row.default_model,
                defaultMode: row.default_mode,
                defaultConfigId: row.default_config_id,
                nodeStrategy: row.node_strategy,
                fixedNodeId: row.fixed_node_id,
                fixedModel: row.fixed_model
            };
        } catch (error) {
            console.error('验证令牌失败:', error.message);
            return null;
        }
    }
    
    /**
     * 获取令牌统计信息
     */
    async getTokenStats(username) {
        try {
            const [rows] = await pool.query(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled
                FROM api_keys 
                WHERE username = ?`,
                [username]
            );
            
            return rows[0];
        } catch (error) {
            console.error('获取令牌统计失败:', error.message);
            return { total: 0, active: 0, disabled: 0 };
        }
    }
    
    /**
     * 更新令牌的节点配置
     */
    async updateTokenNodeConfig(username, tokenId, config) {
        try {
            const {
                nodeStrategy,
                loadBalanceStrategy = 'round_robin',
                loadBalanceNodes = null,
                defaultModel = null,
                fixedNodeId = null,
                fixedModel = null
            } = config;
            
            const [result] = await pool.query(
                `UPDATE api_keys 
                SET node_strategy = ?, 
                    load_balance_strategy = ?,
                    load_balance_nodes = ?,
                    default_model = ?,
                    fixed_node_id = ?, 
                    fixed_model = ? 
                WHERE id = ? AND username = ?`,
                [
                    nodeStrategy, 
                    loadBalanceStrategy,
                    loadBalanceNodes ? JSON.stringify(loadBalanceNodes) : null,
                    defaultModel,
                    fixedNodeId, 
                    fixedModel, 
                    tokenId, 
                    username
                ]
            );
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新令牌节点配置失败:', error.message);
            return false;
        }
    }
}

module.exports = new TokenManager();
