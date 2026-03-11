/**
 * 节点选择服务
 * 
 * 实现智能节点选择算法，支持：
 * - 健康状态过滤
 * - 优先级排序
 * - 权重分配
 * - 故障转移
 * - 多种负载均衡策略
 */

const { pool } = require('./database');

class NodeSelector {
    constructor() {
        // 轮询索引（用于 round_robin 策略）
        this.roundRobinIndex = 0;
    }
    
    /**
     * 选择最佳节点
     * 
     * @param {number} userId - 用户ID
     * @param {object} options - 选项
     * @returns {object|null} - 选中的节点或null
     */
    async selectBestNode(userId, options = {}) {
        const {
            excludeNodeIds = [],  // 排除的节点ID列表
            requireHealthy = true, // 是否要求健康节点
            strategy = 'priority', // 选择策略
            clientIp = null        // 客户端IP（用于 ip_hash 策略）
        } = options;
        
        try {
            // 1. 获取所有启用的节点
            let query = `
                SELECT id, name, base_url, api_key, api_type, 
                       priority, weight, health_status, avg_latency, models,
                       active_connections, total_connections
                FROM api_configs 
                WHERE user_id = ? AND is_active = TRUE
            `;
            
            const params = [userId];
            
            // 排除指定节点
            if (excludeNodeIds.length > 0) {
                query += ` AND id NOT IN (${excludeNodeIds.map(() => '?').join(',')})`;
                params.push(...excludeNodeIds);
            }
            
            query += ` ORDER BY priority DESC, weight DESC`;
            
            const [nodes] = await pool.query(query, params);
            
            if (nodes.length === 0) {
                console.log('[节点选择] 没有可用节点');
                return null;
            }
            
            // 2. 过滤健康节点
            let availableNodes = nodes;
            if (requireHealthy) {
                availableNodes = nodes.filter(node => 
                    node.health_status === 'healthy' || node.health_status === 'warning'
                );
                
                // 如果没有健康节点，降级使用所有节点
                if (availableNodes.length === 0) {
                    console.log('[节点选择] 没有健康节点，使用所有节点');
                    availableNodes = nodes;
                }
            }
            
            // 3. 根据策略选择节点
            let selectedNode = null;
            
            switch (strategy) {
                case 'weighted':
                    selectedNode = this._selectByWeight(availableNodes);
                    break;
                case 'random':
                    selectedNode = this._selectRandom(availableNodes);
                    break;
                case 'round_robin':
                    selectedNode = this._selectByRoundRobin(availableNodes);
                    break;
                case 'least_connections':
                    selectedNode = this._selectByLeastConnections(availableNodes);
                    break;
                case 'fastest_response':
                    selectedNode = this._selectByFastestResponse(availableNodes);
                    break;
                case 'ip_hash':
                    selectedNode = this._selectByIpHash(availableNodes, clientIp);
                    break;
                case 'priority':
                default:
                    selectedNode = this._selectByPriority(availableNodes);
                    break;
            }
            
            if (selectedNode) {
                console.log(`[节点选择] 策略: ${strategy}, 选中节点: ${selectedNode.name} (ID: ${selectedNode.id}, 优先级: ${selectedNode.priority}, 权重: ${selectedNode.weight}, 状态: ${selectedNode.health_status})`);
            }
            
            return selectedNode;
            
        } catch (error) {
            console.error('[节点选择] 选择失败:', error);
            return null;
        }
    }
    
    /**
     * 按优先级选择（默认策略）
     */
    _selectByPriority(nodes) {
        if (nodes.length === 0) return null;
        
        // 已经按优先级排序，直接返回第一个
        return nodes[0];
    }
    
    /**
     * 按权重选择（加权随机）
     */
    _selectByWeight(nodes) {
        if (nodes.length === 0) return null;
        
        // 计算总权重
        const totalWeight = nodes.reduce((sum, node) => sum + (node.weight || 1), 0);
        
        // 生成随机数
        let random = Math.random() * totalWeight;
        
        // 选择节点
        for (const node of nodes) {
            random -= (node.weight || 1);
            if (random <= 0) {
                return node;
            }
        }
        
        // 兜底返回第一个
        return nodes[0];
    }
    
    /**
     * 随机选择
     */
    _selectRandom(nodes) {
        if (nodes.length === 0) return null;
        
        const index = Math.floor(Math.random() * nodes.length);
        return nodes[index];
    }
    
    /**
     * 轮询选择（Round Robin）
     */
    _selectByRoundRobin(nodes) {
        if (nodes.length === 0) return null;
        
        const node = nodes[this.roundRobinIndex % nodes.length];
        this.roundRobinIndex++;
        
        // 防止索引溢出
        if (this.roundRobinIndex > 1000000) {
            this.roundRobinIndex = 0;
        }
        
        return node;
    }
    
    /**
     * 最少连接选择（Least Connections）
     */
    _selectByLeastConnections(nodes) {
        if (nodes.length === 0) return null;
        
        // 按活跃连接数排序，选择最少的
        return nodes.sort((a, b) => 
            (a.active_connections || 0) - (b.active_connections || 0)
        )[0];
    }
    
    /**
     * 最快响应选择（Fastest Response）
     */
    _selectByFastestResponse(nodes) {
        if (nodes.length === 0) return null;
        
        // 按平均延迟排序，选择最快的
        return nodes.sort((a, b) => 
            (a.avg_latency || Infinity) - (b.avg_latency || Infinity)
        )[0];
    }
    
    /**
     * IP哈希选择（IP Hash）
     */
    _selectByIpHash(nodes, clientIp) {
        if (nodes.length === 0) return null;
        
        // 如果没有提供IP，降级为优先级选择
        if (!clientIp) {
            console.log('[节点选择] 未提供客户端IP，降级为优先级选择');
            return this._selectByPriority(nodes);
        }
        
        // 计算IP的哈希值
        const hash = this._hashCode(clientIp);
        const index = Math.abs(hash) % nodes.length;
        
        return nodes[index];
    }
    
    /**
     * 计算字符串的哈希值
     */
    _hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }
    
    /**
     * 故障转移：选择备用节点
     * 
     * @param {number} userId - 用户ID
     * @param {number} failedNodeId - 失败的节点ID
     * @param {string} failureReason - 失败原因
     * @returns {object|null} - 备用节点或null
     */
    async failover(userId, failedNodeId, failureReason = 'unknown') {
        console.log(`[故障转移] 节点 ${failedNodeId} 失败，原因: ${failureReason}`);
        
        try {
            // 选择备用节点（排除失败的节点）
            const backupNode = await this.selectBestNode(userId, {
                excludeNodeIds: [failedNodeId],
                requireHealthy: true,
                strategy: 'priority'
            });
            
            if (backupNode) {
                console.log(`[故障转移] 切换到备用节点: ${backupNode.name} (ID: ${backupNode.id})`);
                
                // 记录故障转移日志
                await this.logFailover(userId, failedNodeId, backupNode.id, failureReason);
            } else {
                console.log('[故障转移] 没有可用的备用节点');
            }
            
            return backupNode;
            
        } catch (error) {
            console.error('[故障转移] 失败:', error);
            return null;
        }
    }
    
    /**
     * 记录故障转移日志
     */
    async logFailover(userId, fromNodeId, toNodeId, failureReason, details = {}) {
        try {
            const {
                failureDetails = null,
                requestModel = null,
                requestEndpoint = null,
                success = true,
                retryCount = 0,
                totalLatency = null,
                fromNodeStatus = null,
                toNodeStatus = null
            } = details;
            
            await pool.query(
                `INSERT INTO failover_logs 
                 (user_id, from_node_id, to_node_id, failure_reason, failure_details,
                  request_model, request_endpoint, success, retry_count, total_latency,
                  from_node_status, to_node_status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, fromNodeId, toNodeId, failureReason, failureDetails,
                    requestModel, requestEndpoint, success, retryCount, totalLatency,
                    fromNodeStatus, toNodeStatus
                ]
            );
            
            console.log('[故障转移] 日志已记录');
            
        } catch (error) {
            console.error('[故障转移] 记录日志失败:', error);
        }
    }
    
    /**
     * 获取故障转移历史
     */
    async getFailoverHistory(userId, limit = 100) {
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
            console.error('[故障转移] 获取历史失败:', error);
            return [];
        }
    }
    
    /**
     * 标记节点为故障状态
     */
    async markNodeAsFailed(nodeId, reason = 'unknown') {
        try {
            await pool.query(
                `UPDATE api_configs 
                 SET health_status = 'error',
                     last_check_at = NOW()
                 WHERE id = ?`,
                [nodeId]
            );
            
            console.log(`[节点管理] 节点 ${nodeId} 已标记为故障: ${reason}`);
            
        } catch (error) {
            console.error('[节点管理] 标记失败:', error);
        }
    }
}

module.exports = new NodeSelector();
