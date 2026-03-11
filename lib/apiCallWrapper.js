/**
 * API 调用包装器
 * 
 * 集成节点选择和自动故障转移功能
 */

const nodeSelector = require('./nodeSelector');
const apiConfigManager = require('./apiConfigManager');

class ApiCallWrapper {
    /**
     * 调用 AI API（带故障转移）
     * 
     * @param {number} userId - 用户ID
     * @param {Function} callFunction - 实际的 API 调用函数
     * @param {object} options - 选项
     * @returns {Promise<object>} - API 响应
     */
    async callWithFailover(userId, callFunction, options = {}) {
        const {
            maxRetries = 3,           // 最大重试次数
            retryDelay = 1000,        // 重试延迟（毫秒）
            strategy = 'priority',    // 节点选择策略
            requireHealthy = true,    // 是否要求健康节点
            requestModel = null,      // 请求的模型
            requestEndpoint = null    // 请求的端点
        } = options;
        
        let lastError = null;
        let attemptedNodes = [];
        const startTime = Date.now();
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // 选择节点（排除已尝试失败的节点）
                const node = await nodeSelector.selectBestNode(userId, {
                    excludeNodeIds: attemptedNodes,
                    requireHealthy: requireHealthy,
                    strategy: strategy
                });
                
                if (!node) {
                    throw new Error('没有可用的节点');
                }
                
                attemptedNodes.push(node.id);
                
                console.log(`[API 调用] 尝试 ${attempt + 1}/${maxRetries}: 使用节点 ${node.name} (ID: ${node.id})`);
                
                // 调用 API
                const result = await callFunction(node);
                
                // 成功，记录日志（如果是故障转移）
                if (attempt > 0) {
                    const totalLatency = Date.now() - startTime;
                    await nodeSelector.logFailover(
                        userId,
                        attemptedNodes[0], // 第一个失败的节点
                        node.id,           // 成功的节点
                        lastError?.message || 'unknown',
                        {
                            failureDetails: lastError?.stack || null,
                            requestModel: requestModel,
                            requestEndpoint: requestEndpoint,
                            success: true,
                            retryCount: attempt,
                            totalLatency: totalLatency,
                            fromNodeStatus: 'error',
                            toNodeStatus: node.health_status
                        }
                    );
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                console.error(`[API 调用] 节点 ${attemptedNodes[attemptedNodes.length - 1]} 调用失败:`, error.message);
                
                // 标记节点为故障
                await nodeSelector.markNodeAsFailed(
                    attemptedNodes[attemptedNodes.length - 1],
                    error.message
                );
                
                // 如果还有重试机会，等待后继续
                if (attempt < maxRetries - 1) {
                    console.log(`[API 调用] 等待 ${retryDelay}ms 后重试...`);
                    await this._sleep(retryDelay);
                }
            }
        }
        
        // 所有重试都失败了
        console.error(`[API 调用] 所有节点都失败了，已尝试 ${attemptedNodes.length} 个节点`);
        
        // 记录最终失败的故障转移日志
        if (attemptedNodes.length > 1) {
            const totalLatency = Date.now() - startTime;
            await nodeSelector.logFailover(
                userId,
                attemptedNodes[0],
                attemptedNodes[attemptedNodes.length - 1],
                lastError?.message || 'unknown',
                {
                    failureDetails: lastError?.stack || null,
                    requestModel: requestModel,
                    requestEndpoint: requestEndpoint,
                    success: false,
                    retryCount: attemptedNodes.length - 1,
                    totalLatency: totalLatency,
                    fromNodeStatus: 'error',
                    toNodeStatus: 'error'
                }
            );
        }
        
        throw lastError || new Error('API 调用失败');
    }
    
    /**
     * 使用默认节点调用（不进行故障转移）
     * 
     * @param {number} userId - 用户ID
     * @param {Function} callFunction - 实际的 API 调用函数
     * @returns {Promise<object>} - API 响应
     */
    async callWithDefaultNode(userId, callFunction) {
        // 获取默认配置
        const defaultConfig = await apiConfigManager.getDefaultApiConfig(userId);
        
        if (!defaultConfig) {
            throw new Error('未配置默认 API');
        }
        
        console.log(`[API 调用] 使用默认节点: ${defaultConfig.name} (ID: ${defaultConfig.id})`);
        
        try {
            const result = await callFunction(defaultConfig);
            return result;
        } catch (error) {
            console.error(`[API 调用] 默认节点调用失败:`, error.message);
            
            // 标记节点为故障
            await nodeSelector.markNodeAsFailed(defaultConfig.id, error.message);
            
            throw error;
        }
    }
    
    /**
     * 睡眠函数
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new ApiCallWrapper();
