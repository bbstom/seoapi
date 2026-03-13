/**
 * 日志记录系统 - MySQL 版本
 * 记录所有 API 调用的详细信息到数据库
 */

const { pool } = require('./database');

class Logger {
    // 记录 API 调用
    async logAPICall(data) {
        try {
            const logEntry = {
                request_id: data.requestId,
                username: data.username,
                status: data.status, // 'success' or 'error'
                
                // 请求信息
                base_url: data.baseURL,
                node_id: data.nodeId || null,
                node_name: data.nodeName || null,
                api_type: data.apiType,
                model: data.model,
                mode: data.mode,
                
                // 文本信息
                input_length: data.inputLength,
                output_length: data.outputLength,
                
                // 性能信息
                duration: data.duration,
                api_duration: data.apiDuration,
                
                // Token 使用
                input_tokens: data.inputTokens || 0,
                output_tokens: data.outputTokens || 0,
                total_tokens: (data.inputTokens || 0) + (data.outputTokens || 0),
                
                // 错误信息
                error_code: data.errorCode || null,
                error_message: data.errorMessage || null,
                
                // 客户端信息
                client_ip: data.clientIP,
                user_agent: data.userAgent
            };

            await pool.query(
                `INSERT INTO api_logs (
                    request_id, username, status, base_url, node_id, node_name, api_type, model, mode,
                    input_length, output_length, duration, api_duration,
                    input_tokens, output_tokens, total_tokens,
                    error_code, error_message, client_ip, user_agent
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    logEntry.request_id, logEntry.username, logEntry.status,
                    logEntry.base_url, logEntry.node_id, logEntry.node_name, logEntry.api_type, logEntry.model, logEntry.mode,
                    logEntry.input_length, logEntry.output_length,
                    logEntry.duration, logEntry.api_duration,
                    logEntry.input_tokens, logEntry.output_tokens, logEntry.total_tokens,
                    logEntry.error_code, logEntry.error_message,
                    logEntry.client_ip, logEntry.user_agent
                ]
            );
        } catch (error) {
            console.error('记录日志失败:', error.message);
        }
    }

    // 获取用户的日志（支持分页和筛选）
    async getUserLogs(username, options = {}) {
        try {
            const {
                page = 1,
                pageSize = 20,
                status = null,
                model = null,
                mode = null,
                search = null,
                dateRange = null,
                startDate = null,
                endDate = null
            } = options;

            let whereConditions = ['username = ?'];
            let params = [username];

            // 状态筛选（支持 'failed' 映射到 'error'）
            if (status) {
                if (status === 'failed') {
                    whereConditions.push('status = ?');
                    params.push('error');
                } else {
                    whereConditions.push('status = ?');
                    params.push(status);
                }
            }

            // 模型筛选
            if (model) {
                whereConditions.push('model = ?');
                params.push(model);
            }

            // 模式筛选
            if (mode) {
                whereConditions.push('mode = ?');
                params.push(mode);
            }

            // 搜索筛选（用户名、模型、模式）
            if (search) {
                whereConditions.push('(username LIKE ? OR model LIKE ? OR mode LIKE ?)');
                const searchPattern = `%${search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            // 日期范围筛选
            if (dateRange) {
                switch (dateRange) {
                    case 'today':
                        whereConditions.push('DATE(created_at) = CURDATE()');
                        break;
                    case 'yesterday':
                        whereConditions.push('DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)');
                        break;
                    case 'week':
                        whereConditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
                        break;
                    case 'month':
                        whereConditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
                        break;
                }
            }

            // 自定义日期范围
            if (startDate && endDate) {
                whereConditions.push('DATE(created_at) BETWEEN ? AND ?');
                params.push(startDate, endDate);
            } else if (startDate) {
                whereConditions.push('DATE(created_at) >= ?');
                params.push(startDate);
            } else if (endDate) {
                whereConditions.push('DATE(created_at) <= ?');
                params.push(endDate);
            }

            const whereClause = whereConditions.join(' AND ');

            // 获取总数
            const [countResult] = await pool.query(
                `SELECT COUNT(*) as total FROM api_logs WHERE ${whereClause}`,
                params
            );
            const total = countResult[0].total;

            // 获取分页数据
            const offset = (page - 1) * pageSize;
            const [logs] = await pool.query(
                `SELECT 
                    id, request_id as requestId, username, status,
                    base_url as baseURL, api_type as apiType, model, mode,
                    input_length as inputLength, output_length as outputLength,
                    duration, api_duration as apiDuration,
                    input_tokens as inputTokens, output_tokens as outputTokens, total_tokens as totalTokens,
                    error_code as errorCode, error_message as errorMessage,
                    client_ip as clientIP, user_agent as userAgent,
                    created_at as timestamp
                FROM api_logs 
                WHERE ${whereClause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?`,
                [...params, pageSize, offset]
            );

            return {
                logs,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error('获取日志失败:', error.message);
            return { logs: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
        }
    }

    // 获取统计数据（支持过滤）
    async getStats(username = null, filters = {}) {
        try {
            let whereConditions = [];
            let params = [];

            // 用户名过滤
            if (username) {
                whereConditions.push('username = ?');
                params.push(username);
            }

            // 状态筛选（支持 'failed' 映射到 'error'）
            if (filters.status) {
                if (filters.status === 'failed') {
                    whereConditions.push('status = ?');
                    params.push('error');
                } else {
                    whereConditions.push('status = ?');
                    params.push(filters.status);
                }
            }

            // 模型筛选
            if (filters.model) {
                whereConditions.push('model = ?');
                params.push(filters.model);
            }

            // 模式筛选
            if (filters.mode) {
                whereConditions.push('mode = ?');
                params.push(filters.mode);
            }

            // 搜索筛选
            if (filters.search) {
                whereConditions.push('(username LIKE ? OR model LIKE ? OR mode LIKE ?)');
                const searchPattern = `%${filters.search}%`;
                params.push(searchPattern, searchPattern, searchPattern);
            }

            // 日期范围筛选
            if (filters.dateRange) {
                switch (filters.dateRange) {
                    case 'today':
                        whereConditions.push('DATE(created_at) = CURDATE()');
                        break;
                    case 'yesterday':
                        whereConditions.push('DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)');
                        break;
                    case 'week':
                        whereConditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
                        break;
                    case 'month':
                        whereConditions.push('created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
                        break;
                }
            }

            // 自定义日期范围
            if (filters.startDate && filters.endDate) {
                whereConditions.push('DATE(created_at) BETWEEN ? AND ?');
                params.push(filters.startDate, filters.endDate);
            } else if (filters.startDate) {
                whereConditions.push('DATE(created_at) >= ?');
                params.push(filters.startDate);
            } else if (filters.endDate) {
                whereConditions.push('DATE(created_at) <= ?');
                params.push(filters.endDate);
            }

            const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            // 总体统计
            const [totalStats] = await pool.query(
                `SELECT 
                    COUNT(*) as calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
                    SUM(total_tokens) as totalTokens,
                    SUM(input_tokens) as totalInputTokens,
                    SUM(output_tokens) as totalOutputTokens,
                    AVG(duration) as avgDuration
                FROM api_logs ${whereClause}`,
                params
            );

            // 按模型统计
            const [byModel] = await pool.query(
                `SELECT 
                    model,
                    COUNT(*) as calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
                    SUM(total_tokens) as totalTokens
                FROM api_logs ${whereClause}
                GROUP BY model`,
                params
            );

            // 按模式统计
            const [byMode] = await pool.query(
                `SELECT 
                    mode,
                    COUNT(*) as calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error
                FROM api_logs ${whereClause}
                GROUP BY mode`,
                params
            );

            // 按日期统计（最近30天）
            const [byDate] = await pool.query(
                `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
                    SUM(total_tokens) as totalTokens
                FROM api_logs 
                ${whereClause}
                ${whereClause ? 'AND' : 'WHERE'} created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY DATE(created_at)
                ORDER BY date DESC`,
                params
            );

            return {
                total: totalStats[0],
                byModel: byModel.reduce((acc, item) => {
                    acc[item.model] = item;
                    return acc;
                }, {}),
                byMode: byMode.reduce((acc, item) => {
                    acc[item.mode] = item;
                    return acc;
                }, {}),
                byDate: byDate.reduce((acc, item) => {
                    acc[item.date] = item;
                    return acc;
                }, {}),
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取统计数据失败:', error.message);
            return null;
        }
    }

    // 获取唯一的模型列表
    async getUniqueModels(username) {
        try {
            const [models] = await pool.query(
                'SELECT DISTINCT model FROM api_logs WHERE username = ? ORDER BY model',
                [username]
            );
            return models.map(row => row.model);
        } catch (error) {
            console.error('获取模型列表失败:', error.message);
            return [];
        }
    }

    // 获取唯一的模式列表
    async getUniqueModes(username) {
        try {
            const [modes] = await pool.query(
                'SELECT DISTINCT mode FROM api_logs WHERE username = ? ORDER BY mode',
                [username]
            );
            return modes.map(row => row.mode);
        } catch (error) {
            console.error('获取模式列表失败:', error.message);
            return [];
        }
    }
}

module.exports = new Logger();
