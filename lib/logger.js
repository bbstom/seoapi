/**
 * 日志记录系统
 * 记录所有 API 调用的详细信息
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logsDir = path.join(__dirname, '..', 'logs');
        this.ensureLogsDir();
    }

    // 确保日志目录存在
    ensureLogsDir() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    // 获取当前日期的日志文件路径
    getLogFilePath(type = 'api') {
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        return path.join(this.logsDir, `${type}-${date}.log`);
    }

    // 记录 API 调用
    logAPICall(data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            requestId: data.requestId,
            username: data.username,
            status: data.status, // 'success' or 'error'
            
            // 请求信息
            baseURL: data.baseURL,
            apiType: data.apiType, // 'anthropic' or 'openai'
            model: data.model,
            mode: data.mode,
            
            // 文本信息
            inputLength: data.inputLength,
            outputLength: data.outputLength,
            
            // 性能信息
            duration: data.duration, // 总耗时（秒）
            apiDuration: data.apiDuration, // API 调用耗时（秒）
            
            // Token 使用
            inputTokens: data.inputTokens || 0,
            outputTokens: data.outputTokens || 0,
            totalTokens: (data.inputTokens || 0) + (data.outputTokens || 0),
            
            // 错误信息（如果有）
            errorCode: data.errorCode || null,
            errorMessage: data.errorMessage || null,
            
            // 客户端信息
            clientIP: data.clientIP,
            userAgent: data.userAgent
        };

        // 写入日志文件
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(this.getLogFilePath('api'), logLine);

        // 同时更新统计数据
        this.updateStats(logEntry);
    }

    // 更新统计数据
    updateStats(logEntry) {
        const statsFile = path.join(this.logsDir, 'stats.json');
        let stats = {};

        // 读取现有统计数据
        if (fs.existsSync(statsFile)) {
            try {
                stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            } catch (error) {
                console.error('读取统计数据失败:', error);
                stats = {};
            }
        }

        // 初始化统计结构
        if (!stats.total) {
            stats = {
                total: {
                    calls: 0,
                    success: 0,
                    error: 0,
                    totalTokens: 0,
                    totalDuration: 0
                },
                byUser: {},
                byModel: {},
                byMode: {},
                byBaseURL: {},
                byDate: {},
                lastUpdated: null
            };
        }

        // 更新总计
        stats.total.calls++;
        if (logEntry.status === 'success') {
            stats.total.success++;
        } else {
            stats.total.error++;
        }
        stats.total.totalTokens += logEntry.totalTokens;
        stats.total.totalDuration += logEntry.duration;

        // 按用户统计
        if (!stats.byUser[logEntry.username]) {
            stats.byUser[logEntry.username] = {
                calls: 0,
                success: 0,
                error: 0,
                totalTokens: 0,
                totalDuration: 0
            };
        }
        stats.byUser[logEntry.username].calls++;
        if (logEntry.status === 'success') {
            stats.byUser[logEntry.username].success++;
        } else {
            stats.byUser[logEntry.username].error++;
        }
        stats.byUser[logEntry.username].totalTokens += logEntry.totalTokens;
        stats.byUser[logEntry.username].totalDuration += logEntry.duration;

        // 按模型统计
        if (!stats.byModel[logEntry.model]) {
            stats.byModel[logEntry.model] = { calls: 0, success: 0, error: 0, totalTokens: 0 };
        }
        stats.byModel[logEntry.model].calls++;
        if (logEntry.status === 'success') {
            stats.byModel[logEntry.model].success++;
        } else {
            stats.byModel[logEntry.model].error++;
        }
        stats.byModel[logEntry.model].totalTokens += logEntry.totalTokens;

        // 按模式统计
        if (!stats.byMode[logEntry.mode]) {
            stats.byMode[logEntry.mode] = { calls: 0, success: 0, error: 0 };
        }
        stats.byMode[logEntry.mode].calls++;
        if (logEntry.status === 'success') {
            stats.byMode[logEntry.mode].success++;
        } else {
            stats.byMode[logEntry.mode].error++;
        }

        // 按 Base URL 统计
        if (!stats.byBaseURL[logEntry.baseURL]) {
            stats.byBaseURL[logEntry.baseURL] = { calls: 0, success: 0, error: 0 };
        }
        stats.byBaseURL[logEntry.baseURL].calls++;
        if (logEntry.status === 'success') {
            stats.byBaseURL[logEntry.baseURL].success++;
        } else {
            stats.byBaseURL[logEntry.baseURL].error++;
        }

        // 按日期统计
        const date = logEntry.timestamp.split('T')[0];
        if (!stats.byDate[date]) {
            stats.byDate[date] = { calls: 0, success: 0, error: 0, totalTokens: 0 };
        }
        stats.byDate[date].calls++;
        if (logEntry.status === 'success') {
            stats.byDate[date].success++;
        } else {
            stats.byDate[date].error++;
        }
        stats.byDate[date].totalTokens += logEntry.totalTokens;

        // 更新时间
        stats.lastUpdated = new Date().toISOString();

        // 保存统计数据
        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    }

    // 获取统计数据
    getStats() {
        const statsFile = path.join(this.logsDir, 'stats.json');
        if (fs.existsSync(statsFile)) {
            try {
                return JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            } catch (error) {
                console.error('读取统计数据失败:', error);
                return null;
            }
        }
        return null;
    }

    // 获取指定日期的日志
    getLogsByDate(date) {
        const logFile = path.join(this.logsDir, `api-${date}.log`);
        if (fs.existsSync(logFile)) {
            try {
                const content = fs.readFileSync(logFile, 'utf8');
                return content.split('\n')
                    .filter(line => line.trim())
                    .map(line => JSON.parse(line));
            } catch (error) {
                console.error('读取日志失败:', error);
                return [];
            }
        }
        return [];
    }

    // 获取用户的日志
    getUserLogs(username, limit = 100) {
        const allLogs = [];
        
        // 获取最近 30 天的日志
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const logs = this.getLogsByDate(dateStr);
            const userLogs = logs.filter(log => log.username === username);
            allLogs.push(...userLogs);
            
            // 如果已经获取足够的日志，提前退出
            if (allLogs.length >= limit) {
                break;
            }
        }
        
        // 按时间倒序排序（最新的在前）
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 返回指定数量的日志
        return allLogs.slice(0, limit);
    }

    // 清理旧日志（保留最近 N 天）
    cleanOldLogs(daysToKeep = 30) {
        const files = fs.readdirSync(this.logsDir);
        const now = new Date();
        
        files.forEach(file => {
            if (file.startsWith('api-') && file.endsWith('.log')) {
                const dateStr = file.replace('api-', '').replace('.log', '');
                const fileDate = new Date(dateStr);
                const daysDiff = (now - fileDate) / (1000 * 60 * 60 * 24);
                
                if (daysDiff > daysToKeep) {
                    fs.unlinkSync(path.join(this.logsDir, file));
                    console.log(`已删除旧日志: ${file}`);
                }
            }
        });
    }
}

module.exports = new Logger();
