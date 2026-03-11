/**
 * 统计数据收集器
 * 
 * 收集和聚合请求统计数据
 * 用于监控仪表板和报表生成
 */

const { pool } = require('./database');

class StatsCollector {
    /**
     * 记录请求统计
     */
    async recordRequest(userId, nodeId, success, latency) {
        try {
            const now = new Date();
            const date = now.toISOString().split('T')[0];
            const hour = now.getHours();
            
            await pool.query(
                `INSERT INTO request_stats 
                 (user_id, node_id, date, hour, total_requests, success_requests, failed_requests, total_latency, min_latency, max_latency)
                 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   total_requests = total_requests + 1,
                   success_requests = success_requests + ?,
                   failed_requests = failed_requests + ?,
                   total_latency = total_latency + ?,
                   min_latency = LEAST(min_latency, ?),
                   max_latency = GREATEST(max_latency, ?)`,
                [
                    userId, nodeId, date, hour,
                    success ? 1 : 0, success ? 0 : 1, latency, latency, latency,
                    success ? 1 : 0, success ? 0 : 1, latency, latency, latency
                ]
            );
            
            console.log(`[统计] 记录请求: 用户${userId}, 节点${nodeId}, 成功=${success}, 延迟=${latency}ms`);
            
        } catch (error) {
            console.error('[统计] 记录请求失败:', error);
        }
    }
    
    /**
     * 获取节点统计
     */
    async getNodeStats(userId, nodeId, startDate, endDate) {
        try {
            const [stats] = await pool.query(
                `SELECT 
                   SUM(total_requests) as total_requests,
                   SUM(success_requests) as success_requests,
                   SUM(failed_requests) as failed_requests,
                   CASE 
                     WHEN SUM(total_requests) > 0 
                     THEN ROUND(SUM(total_latency) / SUM(total_requests), 2)
                     ELSE 0 
                   END as avg_latency,
                   MIN(min_latency) as min_latency,
                   MAX(max_latency) as max_latency,
                   CASE 
                     WHEN SUM(total_requests) > 0 
                     THEN ROUND(SUM(success_requests) * 100.0 / SUM(total_requests), 2)
                     ELSE 0 
                   END as success_rate
                 FROM request_stats
                 WHERE user_id = ? AND node_id = ? AND date BETWEEN ? AND ?`,
                [userId, nodeId, startDate, endDate]
            );
            
            return stats[0] || {
                total_requests: 0,
                success_requests: 0,
                failed_requests: 0,
                avg_latency: 0,
                min_latency: 0,
                max_latency: 0,
                success_rate: 0
            };
            
        } catch (error) {
            console.error('[统计] 获取节点统计失败:', error);
            return null;
        }
    }
    
    /**
     * 获取所有节点统计
     */
    async getAllNodesStats(userId, startDate, endDate) {
        try {
            const [stats] = await pool.query(
                `SELECT 
                   rs.node_id,
                   ac.name as node_name,
                   COALESCE(SUM(rs.total_requests), 0) as total_requests,
                   COALESCE(SUM(rs.success_requests), 0) as success_requests,
                   COALESCE(SUM(rs.failed_requests), 0) as failed_requests,
                   CASE 
                     WHEN SUM(rs.total_requests) > 0 
                     THEN ROUND(SUM(rs.total_latency) / SUM(rs.total_requests), 2)
                     ELSE 0 
                   END as avg_latency,
                   COALESCE(MIN(rs.min_latency), 0) as min_latency,
                   COALESCE(MAX(rs.max_latency), 0) as max_latency,
                   CASE 
                     WHEN SUM(rs.total_requests) > 0 
                     THEN ROUND(SUM(rs.success_requests) * 100.0 / SUM(rs.total_requests), 2)
                     ELSE 0 
                   END as success_rate
                 FROM request_stats rs
                 LEFT JOIN api_configs ac ON rs.node_id = ac.id
                 WHERE rs.user_id = ? AND rs.date BETWEEN ? AND ?
                 GROUP BY rs.node_id, ac.name
                 ORDER BY total_requests DESC`,
                [userId, startDate, endDate]
            );
            
            // 确保所有数值字段都是数字类型
            return stats.map(stat => ({
                node_id: stat.node_id,
                node_name: stat.node_name,
                total_requests: Number(stat.total_requests) || 0,
                success_requests: Number(stat.success_requests) || 0,
                failed_requests: Number(stat.failed_requests) || 0,
                avg_latency: Number(stat.avg_latency) || 0,
                min_latency: Number(stat.min_latency) || 0,
                max_latency: Number(stat.max_latency) || 0,
                success_rate: Number(stat.success_rate) || 0
            }));
            
        } catch (error) {
            console.error('[统计] 获取所有节点统计失败:', error);
            return [];
        }
    }
    
    /**
     * 获取时间趋势数据
     */
    async getTimeTrend(userId, nodeId, startDate, endDate, groupBy = 'hour') {
        try {
            let groupByClause, selectClause;
            
            if (groupBy === 'hour') {
                groupByClause = 'date, hour';
                selectClause = 'date, hour';
            } else if (groupBy === 'day') {
                groupByClause = 'date';
                selectClause = 'date';
            } else {
                groupByClause = 'DATE_FORMAT(date, "%Y-%m")';
                selectClause = 'DATE_FORMAT(date, "%Y-%m") as month';
            }
            
            let query = `
                SELECT 
                  ${selectClause},
                  SUM(total_requests) as total_requests,
                  SUM(success_requests) as success_requests,
                  SUM(failed_requests) as failed_requests,
                  CASE 
                    WHEN SUM(total_requests) > 0 
                    THEN ROUND(SUM(total_latency) / SUM(total_requests), 2)
                    ELSE 0 
                  END as avg_latency
                FROM request_stats
                WHERE user_id = ? AND date BETWEEN ? AND ?
            `;
            
            const params = [userId, startDate, endDate];
            
            if (nodeId) {
                query += ' AND node_id = ?';
                params.push(nodeId);
            }
            
            query += ` GROUP BY ${groupByClause} ORDER BY ${groupByClause}`;
            
            const [trend] = await pool.query(query, params);
            
            return trend;
            
        } catch (error) {
            console.error('[统计] 获取时间趋势失败:', error);
            return [];
        }
    }
    
    /**
     * 获取总览统计
     */
    async getOverviewStats(userId, startDate, endDate) {
        try {
            // 总体统计
            const [overall] = await pool.query(
                `SELECT 
                   COALESCE(SUM(total_requests), 0) as total_requests,
                   COALESCE(SUM(success_requests), 0) as success_requests,
                   COALESCE(SUM(failed_requests), 0) as failed_requests,
                   CASE 
                     WHEN SUM(total_requests) > 0 
                     THEN ROUND(SUM(total_latency) / SUM(total_requests), 2)
                     ELSE 0 
                   END as avg_latency,
                   COALESCE(MIN(min_latency), 0) as min_latency,
                   COALESCE(MAX(max_latency), 0) as max_latency,
                   CASE 
                     WHEN SUM(total_requests) > 0 
                     THEN ROUND(SUM(success_requests) * 100.0 / SUM(total_requests), 2)
                     ELSE 0 
                   END as success_rate
                 FROM request_stats
                 WHERE user_id = ? AND date BETWEEN ? AND ?`,
                [userId, startDate, endDate]
            );
            
            // 在线节点数
            const [nodes] = await pool.query(
                `SELECT 
                   COUNT(*) as total_nodes,
                   SUM(CASE WHEN health_status IN ('healthy', 'warning') THEN 1 ELSE 0 END) as online_nodes
                 FROM api_configs
                 WHERE user_id = ? AND is_active = TRUE`,
                [userId]
            );
            
            const result = {
                total_requests: Number(overall[0].total_requests) || 0,
                success_requests: Number(overall[0].success_requests) || 0,
                failed_requests: Number(overall[0].failed_requests) || 0,
                avg_latency: Number(overall[0].avg_latency) || 0,
                min_latency: Number(overall[0].min_latency) || 0,
                max_latency: Number(overall[0].max_latency) || 0,
                success_rate: Number(overall[0].success_rate) || 0,
                total_nodes: Number(nodes[0].total_nodes) || 0,
                online_nodes: Number(nodes[0].online_nodes) || 0
            };
            
            return result;
            
        } catch (error) {
            console.error('[统计] 获取总览统计失败:', error);
            return {
                total_requests: 0,
                success_requests: 0,
                failed_requests: 0,
                avg_latency: 0,
                min_latency: 0,
                max_latency: 0,
                success_rate: 0,
                total_nodes: 0,
                online_nodes: 0
            };
        }
    }
    
    /**
     * 清理旧数据（保留最近30天）
     */
    async cleanupOldData(days = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
            
            const [result] = await pool.query(
                'DELETE FROM request_stats WHERE date < ?',
                [cutoffDateStr]
            );
            
            console.log(`[统计] 清理了 ${result.affectedRows} 条旧数据（${days}天前）`);
            
            return result.affectedRows;
            
        } catch (error) {
            console.error('[统计] 清理旧数据失败:', error);
            return 0;
        }
    }
}

// 导出单例
module.exports = new StatsCollector();
