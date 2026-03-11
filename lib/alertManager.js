/**
 * 告警管理器
 * 
 * 管理告警规则、检测告警条件、发送告警通知
 */

const { pool } = require('./database');

class AlertManager {
    constructor() {
        // 告警类型定义
        this.alertTypes = {
            node_offline: {
                name: '节点离线',
                description: '节点状态变为离线时触发'
            },
            high_latency: {
                name: '响应时间过高',
                description: '节点平均响应时间超过阈值时触发',
                defaultThreshold: 5000 // 5秒
            },
            low_success_rate: {
                name: '成功率过低',
                description: '节点成功率低于阈值时触发',
                defaultThreshold: 95 // 95%
            },
            frequent_failover: {
                name: '故障转移频繁',
                description: '1小时内故障转移次数超过阈值时触发',
                defaultThreshold: 10 // 10次
            },
            high_connections: {
                name: '连接数过高',
                description: '节点活跃连接数超过阈值时触发',
                defaultThreshold: 100 // 100个连接
            }
        };
    }
    
    /**
     * 创建告警规则
     */
    async createAlertRule(userId, alertType, config = {}) {
        try {
            const {
                enabled = true,
                threshold = null,
                notifyEmail = false,
                notifyWebhook = false,
                webhookUrl = null
            } = config;
            
            const [result] = await pool.query(
                `INSERT INTO alert_rules 
                 (user_id, alert_type, enabled, threshold, notify_email, notify_webhook, webhook_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, alertType, enabled, threshold, notifyEmail, notifyWebhook, webhookUrl]
            );
            
            console.log(`[告警] 创建告警规则: ${alertType}`);
            
            return result.insertId;
            
        } catch (error) {
            console.error('[告警] 创建告警规则失败:', error);
            return null;
        }
    }
    
    /**
     * 获取用户的告警规则
     */
    async getAlertRules(userId) {
        try {
            const [rules] = await pool.query(
                'SELECT * FROM alert_rules WHERE user_id = ? ORDER BY alert_type',
                [userId]
            );
            
            return rules;
            
        } catch (error) {
            console.error('[告警] 获取告警规则失败:', error);
            return [];
        }
    }
    
    /**
     * 更新告警规则
     */
    async updateAlertRule(userId, ruleId, updates) {
        try {
            const fields = [];
            const values = [];
            
            if (updates.enabled !== undefined) {
                fields.push('enabled = ?');
                values.push(updates.enabled);
            }
            if (updates.threshold !== undefined) {
                fields.push('threshold = ?');
                values.push(updates.threshold);
            }
            if (updates.notifyEmail !== undefined) {
                fields.push('notify_email = ?');
                values.push(updates.notifyEmail);
            }
            if (updates.notifyWebhook !== undefined) {
                fields.push('notify_webhook = ?');
                values.push(updates.notifyWebhook);
            }
            if (updates.webhookUrl !== undefined) {
                fields.push('webhook_url = ?');
                values.push(updates.webhookUrl);
            }
            
            if (fields.length === 0) return false;
            
            values.push(userId, ruleId);
            
            await pool.query(
                `UPDATE alert_rules SET ${fields.join(', ')} WHERE user_id = ? AND id = ?`,
                values
            );
            
            console.log(`[告警] 更新告警规则: ${ruleId}`);
            
            return true;
            
        } catch (error) {
            console.error('[告警] 更新告警规则失败:', error);
            return false;
        }
    }
    
    /**
     * 删除告警规则
     */
    async deleteAlertRule(userId, ruleId) {
        try {
            const [result] = await pool.query(
                'DELETE FROM alert_rules WHERE user_id = ? AND id = ?',
                [userId, ruleId]
            );
            
            if (result.affectedRows === 0) {
                return false;
            }
            
            console.log(`[告警] 删除告警规则: ${ruleId}`);
            
            return true;
            
        } catch (error) {
            console.error('[告警] 删除告警规则失败:', error);
            return false;
        }
    }
    
    /**
     * 触发告警
     */
    async triggerAlert(userId, alertType, nodeId, message, details = null) {
        try {
            // 检查是否有启用的规则
            const [rules] = await pool.query(
                'SELECT * FROM alert_rules WHERE user_id = ? AND alert_type = ? AND enabled = TRUE',
                [userId, alertType]
            );
            
            if (rules.length === 0) {
                console.log(`[告警] 未启用告警规则: ${alertType}`);
                return false;
            }
            
            const rule = rules[0];
            
            // 记录告警日志
            await pool.query(
                `INSERT INTO alert_logs (user_id, alert_type, node_id, message, details)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, alertType, nodeId, message, details]
            );
            
            console.log(`[告警] 触发告警: ${alertType} - ${message}`);
            
            // 发送通知
            if (rule.notify_email) {
                await this.sendEmailNotification(userId, alertType, message);
            }
            
            if (rule.notify_webhook && rule.webhook_url) {
                await this.sendWebhookNotification(rule.webhook_url, alertType, message, details);
            }
            
            return true;
            
        } catch (error) {
            console.error('[告警] 触发告警失败:', error);
            return false;
        }
    }
    
    /**
     * 检查所有告警条件
     */
    async checkAlerts(userId) {
        try {
            // 检查节点离线
            await this.checkNodeOffline(userId);
            
            // 检查响应时间过高
            await this.checkHighLatency(userId);
            
            // 检查成功率过低
            await this.checkLowSuccessRate(userId);
            
            // 检查故障转移频繁
            await this.checkFrequentFailover(userId);
            
            // 检查连接数过高
            await this.checkHighConnections(userId);
            
        } catch (error) {
            console.error('[告警] 检查告警失败:', error);
        }
    }
    
    /**
     * 检查节点离线
     */
    async checkNodeOffline(userId) {
        const [nodes] = await pool.query(
            `SELECT id, name FROM api_configs 
             WHERE user_id = ? AND is_active = TRUE AND health_status = 'offline'`,
            [userId]
        );
        
        for (const node of nodes) {
            await this.triggerAlert(
                userId,
                'node_offline',
                node.id,
                `节点 ${node.name} 离线`
            );
        }
    }
    
    /**
     * 检查响应时间过高
     */
    async checkHighLatency(userId) {
        const [rule] = await pool.query(
            'SELECT threshold FROM alert_rules WHERE user_id = ? AND alert_type = ? AND enabled = TRUE',
            [userId, 'high_latency']
        );
        
        if (rule.length === 0) return;
        
        const threshold = rule[0].threshold || 5000;
        
        const [nodes] = await pool.query(
            `SELECT id, name, avg_latency FROM api_configs 
             WHERE user_id = ? AND is_active = TRUE AND avg_latency > ?`,
            [userId, threshold]
        );
        
        for (const node of nodes) {
            await this.triggerAlert(
                userId,
                'high_latency',
                node.id,
                `节点 ${node.name} 响应时间过高: ${node.avg_latency}ms（阈值: ${threshold}ms）`
            );
        }
    }
    
    /**
     * 检查成功率过低
     */
    async checkLowSuccessRate(userId) {
        // 实现类似逻辑
    }
    
    /**
     * 检查故障转移频繁
     */
    async checkFrequentFailover(userId) {
        const [rule] = await pool.query(
            'SELECT threshold FROM alert_rules WHERE user_id = ? AND alert_type = ? AND enabled = TRUE',
            [userId, 'frequent_failover']
        );
        
        if (rule.length === 0) return;
        
        const threshold = rule[0].threshold || 10;
        
        const [count] = await pool.query(
            `SELECT COUNT(*) as count FROM failover_logs 
             WHERE user_id = ? AND failover_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
            [userId]
        );
        
        if (count[0].count > threshold) {
            await this.triggerAlert(
                userId,
                'frequent_failover',
                null,
                `1小时内故障转移 ${count[0].count} 次（阈值: ${threshold}次）`
            );
        }
    }
    
    /**
     * 检查连接数过高
     */
    async checkHighConnections(userId) {
        const [rule] = await pool.query(
            'SELECT threshold FROM alert_rules WHERE user_id = ? AND alert_type = ? AND enabled = TRUE',
            [userId, 'high_connections']
        );
        
        if (rule.length === 0) return;
        
        const threshold = rule[0].threshold || 100;
        
        const [nodes] = await pool.query(
            `SELECT id, name, active_connections FROM api_configs 
             WHERE user_id = ? AND is_active = TRUE AND active_connections > ?`,
            [userId, threshold]
        );
        
        for (const node of nodes) {
            await this.triggerAlert(
                userId,
                'high_connections',
                node.id,
                `节点 ${node.name} 连接数过高: ${node.active_connections}（阈值: ${threshold}）`
            );
        }
    }
    
    /**
     * 发送邮件通知
     */
    async sendEmailNotification(userId, alertType, message) {
        // TODO: 实现邮件发送
        console.log(`[告警] 发送邮件通知: ${alertType} - ${message}`);
    }
    
    /**
     * 发送Webhook通知
     */
    async sendWebhookNotification(webhookUrl, alertType, message, details) {
        try {
            const https = require('https');
            const http = require('http');
            const url = new URL(webhookUrl);
            const httpModule = url.protocol === 'https:' ? https : http;
            
            const postData = JSON.stringify({
                alert_type: alertType,
                message: message,
                details: details,
                timestamp: new Date().toISOString()
            });
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };
            
            const req = httpModule.request(options, (res) => {
                console.log(`[告警] Webhook通知已发送: ${res.statusCode}`);
            });
            
            req.on('error', (error) => {
                console.error('[告警] Webhook通知失败:', error);
            });
            
            req.write(postData);
            req.end();
            
        } catch (error) {
            console.error('[告警] 发送Webhook通知失败:', error);
        }
    }
    
    /**
     * 获取告警日志
     */
    async getAlertLogs(userId, limit = 100) {
        try {
            const [logs] = await pool.query(
                `SELECT 
                   al.*,
                   ac.name as node_name
                 FROM alert_logs al
                 LEFT JOIN api_configs ac ON al.node_id = ac.id
                 WHERE al.user_id = ?
                 ORDER BY al.created_at DESC
                 LIMIT ?`,
                [userId, limit]
            );
            
            return logs;
            
        } catch (error) {
            console.error('[告警] 获取告警日志失败:', error);
            return [];
        }
    }
}

// 导出单例
module.exports = new AlertManager();
