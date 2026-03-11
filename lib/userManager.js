/**
 * 用户管理模块 - MySQL 版本
 * 管理用户数据、会话、认证等
 */

const { pool } = require('./database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class UserManager {
    // ==================== 用户管理 ====================
    
    /**
     * 获取用户（通过用户名）
     */
    async getUserByUsername(username) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE username = ?',
                [username]
            );
            
            if (rows.length === 0) return null;
            
            const user = rows[0];
            return {
                id: user.id,  // 添加 id 字段
                username: user.username,
                password: user.password,
                apiKey: user.api_key,
                role: user.role,
                claudeApiKey: user.claude_api_key,
                claudeBaseURL: user.claude_base_url,
                apiType: user.api_type,
                defaultModel: user.default_model,
                defaultMode: user.default_mode,
                defaultConfigId: user.default_config_id,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            };
        } catch (error) {
            console.error('获取用户失败:', error.message);
            return null;
        }
    }
    
    /**
     * 获取用户（通过API Key）
     */
    async getUserByApiKey(apiKey) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE api_key = ?',
                [apiKey]
            );
            
            if (rows.length === 0) return null;
            
            const user = rows[0];
            return {
                id: user.id,  // 添加 id 字段
                username: user.username,
                password: user.password,
                apiKey: user.api_key,
                role: user.role,
                claudeApiKey: user.claude_api_key,
                claudeBaseURL: user.claude_base_url,
                apiType: user.api_type,
                defaultModel: user.default_model,
                defaultMode: user.default_mode,
                defaultConfigId: user.default_config_id,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            };
        } catch (error) {
            console.error('获取用户失败:', error.message);
            return null;
        }
    }
    
    /**
     * 创建用户
     */
    async createUser(userData) {
        try {
            const {
                username,
                password,
                role = 'user',
                claudeApiKey = null,
                claudeBaseURL = 'https://api.api123.icu',
                apiType = 'auto',
                defaultModel = 'claude-sonnet-4-5-20250929',
                defaultMode = 'humanlike'
            } = userData;
            
            // 生成API Key
            const apiKey = this.generateApiKey();
            
            // 哈希密码
            const hashedPassword = await bcrypt.hash(password, 10);
            
            await pool.query(
                `INSERT INTO users (
                    username, password, api_key, role,
                    claude_api_key, claude_base_url, api_type,
                    default_model, default_mode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    username,
                    hashedPassword,
                    apiKey,
                    role,
                    claudeApiKey,
                    claudeBaseURL,
                    apiType,
                    defaultModel,
                    defaultMode
                ]
            );
            
            return {
                username,
                apiKey,
                role
            };
        } catch (error) {
            console.error('创建用户失败:', error.message);
            throw error;
        }
    }
    
    /**
     * 更新用户配置
     */
    async updateUser(username, updates) {
        try {
            const allowedFields = {
                'claude_api_key': 'claudeApiKey',
                'claude_base_url': 'claudeBaseURL',
                'api_type': 'apiType',
                'default_model': 'defaultModel',
                'default_mode': 'defaultMode',
                'default_config_id': 'defaultConfigId'
            };
            
            const setClause = [];
            const values = [];
            
            for (const [dbField, jsField] of Object.entries(allowedFields)) {
                if (updates[jsField] !== undefined) {
                    setClause.push(`${dbField} = ?`);
                    values.push(updates[jsField]);
                }
            }
            
            if (setClause.length === 0) {
                return true; // 没有需要更新的字段
            }
            
            values.push(username);
            
            await pool.query(
                `UPDATE users SET ${setClause.join(', ')} WHERE username = ?`,
                values
            );
            
            return true;
        } catch (error) {
            console.error('更新用户失败:', error.message);
            return false;
        }
    }
    
    /**
     * 修改密码
     */
    async changePassword(username, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            await pool.query(
                'UPDATE users SET password = ? WHERE username = ?',
                [hashedPassword, username]
            );
            
            return true;
        } catch (error) {
            console.error('修改密码失败:', error.message);
            return false;
        }
    }
    
    /**
     * 重新生成API Key
     */
    async regenerateApiKey(username) {
        try {
            const newApiKey = this.generateApiKey();
            
            await pool.query(
                'UPDATE users SET api_key = ? WHERE username = ?',
                [newApiKey, username]
            );
            
            return newApiKey;
        } catch (error) {
            console.error('重新生成API Key失败:', error.message);
            return null;
        }
    }
    
    /**
     * 验证密码
     */
    async verifyPassword(username, password) {
        try {
            const user = await this.getUserByUsername(username);
            if (!user) return false;
            
            return await bcrypt.compare(password, user.password);
        } catch (error) {
            console.error('验证密码失败:', error.message);
            return false;
        }
    }
    
    // ==================== 会话管理 ====================
    
    /**
     * 创建会话
     */
    async createSession(username, expiresInHours = 24) {
        try {
            const token = this.generateSessionToken();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + expiresInHours);
            
            await pool.query(
                'INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)',
                [token, username, expiresAt]
            );
            
            return {
                token,
                expiresAt
            };
        } catch (error) {
            console.error('创建会话失败:', error.message);
            return null;
        }
    }
    
    /**
     * 获取会话
     */
    async getSession(token) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
                [token]
            );
            
            if (rows.length === 0) return null;
            
            return {
                token: rows[0].token,
                username: rows[0].username,
                expiresAt: rows[0].expires_at
            };
        } catch (error) {
            console.error('获取会话失败:', error.message);
            return null;
        }
    }
    
    /**
     * 删除会话（登出）
     */
    async deleteSession(token) {
        try {
            await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
            return true;
        } catch (error) {
            console.error('删除会话失败:', error.message);
            return false;
        }
    }
    
    /**
     * 删除用户的所有会话
     */
    async deleteUserSessions(username) {
        try {
            await pool.query('DELETE FROM sessions WHERE username = ?', [username]);
            return true;
        } catch (error) {
            console.error('删除用户会话失败:', error.message);
            return false;
        }
    }
    
    /**
     * 清理过期会话
     */
    async cleanExpiredSessions() {
        try {
            const [result] = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
            return result.affectedRows;
        } catch (error) {
            console.error('清理过期会话失败:', error.message);
            return 0;
        }
    }
    
    // ==================== 工具函数 ====================
    
    /**
     * 生成API Key
     */
    generateApiKey() {
        return 'sk_' + crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * 生成会话Token
     */
    generateSessionToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * 初始化默认管理员（如果不存在）
     */
    async initDefaultAdmin() {
        try {
            // 检查是否已有管理员
            const [rows] = await pool.query('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
            
            if (rows[0].count > 0) {
                console.log('✅ 管理员账号已存在');
                return;
            }
            
            // 创建默认管理员
            const admin = await this.createUser({
                username: 'admin',
                password: 'admin123',
                role: 'admin',
                claudeApiKey: process.env.CLAUDE_API_KEY || '',
                claudeBaseURL: process.env.CLAUDE_BASE_URL || 'https://api.api123.icu'
            });
            
            console.log('✅ 默认管理员账号已创建');
            console.log('   用户名: admin');
            console.log('   密码: admin123');
            console.log('   API Key:', admin.apiKey);
        } catch (error) {
            console.error('初始化管理员失败:', error.message);
        }
    }
}

module.exports = new UserManager();
