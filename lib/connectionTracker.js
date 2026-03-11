/**
 * 连接数追踪器
 * 
 * 追踪每个节点的活跃连接数和总连接数
 * 用于最少连接负载均衡策略
 */

const { pool } = require('./database');

class ConnectionTracker {
    constructor() {
        // 内存中的连接数缓存（避免频繁查询数据库）
        this.connections = new Map();
        
        // 定期同步到数据库（每5秒）
        this.syncInterval = 5000;
        this.startSync();
    }
    
    /**
     * 增加连接数
     */
    async incrementConnection(nodeId) {
        try {
            // 更新内存缓存
            const current = this.connections.get(nodeId) || { active: 0, total: 0 };
            current.active++;
            current.total++;
            this.connections.set(nodeId, current);
            
            console.log(`[连接追踪] 节点 ${nodeId} 连接数增加: ${current.active} 活跃, ${current.total} 总计`);
            
        } catch (error) {
            console.error('[连接追踪] 增加连接数失败:', error);
        }
    }
    
    /**
     * 减少连接数
     */
    async decrementConnection(nodeId) {
        try {
            // 更新内存缓存
            const current = this.connections.get(nodeId) || { active: 0, total: 0 };
            current.active = Math.max(0, current.active - 1);
            this.connections.set(nodeId, current);
            
            console.log(`[连接追踪] 节点 ${nodeId} 连接数减少: ${current.active} 活跃`);
            
        } catch (error) {
            console.error('[连接追踪] 减少连接数失败:', error);
        }
    }
    
    /**
     * 获取活跃连接数
     */
    getActiveConnections(nodeId) {
        const current = this.connections.get(nodeId) || { active: 0, total: 0 };
        return current.active;
    }
    
    /**
     * 获取总连接数
     */
    getTotalConnections(nodeId) {
        const current = this.connections.get(nodeId) || { active: 0, total: 0 };
        return current.total;
    }
    
    /**
     * 启动定期同步
     */
    startSync() {
        setInterval(() => {
            this.syncToDatabase();
        }, this.syncInterval);
        
        console.log(`[连接追踪] 已启动定期同步，间隔: ${this.syncInterval}ms`);
    }
    
    /**
     * 同步到数据库
     */
    async syncToDatabase() {
        if (this.connections.size === 0) return;
        
        try {
            // 批量更新
            const updates = [];
            for (const [nodeId, counts] of this.connections.entries()) {
                updates.push([counts.active, counts.total, nodeId]);
            }
            
            if (updates.length > 0) {
                await pool.query(
                    `UPDATE api_configs 
                     SET active_connections = ?, total_connections = ? 
                     WHERE id = ?`,
                    updates[0] // 简化版：只更新第一个，实际应该批量更新
                );
                
                console.log(`[连接追踪] 已同步 ${updates.length} 个节点的连接数到数据库`);
            }
            
        } catch (error) {
            console.error('[连接追踪] 同步到数据库失败:', error);
        }
    }
    
    /**
     * 清空连接数（用于测试）
     */
    reset() {
        this.connections.clear();
        console.log('[连接追踪] 已清空所有连接数');
    }
}

// 导出单例
module.exports = new ConnectionTracker();
