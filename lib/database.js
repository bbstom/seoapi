/**
 * MySQL 数据库连接池
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 创建连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seoapi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// 测试连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL 数据库连接成功');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL 数据库连接失败:', error.message);
        return false;
    }
}

// 初始化数据库表
async function initDatabase() {
    try {
        const connection = await pool.getConnection();
        
        // 创建 API 调用日志表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                request_id VARCHAR(64) NOT NULL,
                username VARCHAR(100) NOT NULL,
                status ENUM('success', 'error') NOT NULL,
                
                base_url VARCHAR(255),
                api_type VARCHAR(50),
                model VARCHAR(100),
                mode VARCHAR(100),
                
                input_length INT,
                output_length INT,
                
                duration DECIMAL(10, 3),
                api_duration DECIMAL(10, 3),
                
                input_tokens INT DEFAULT 0,
                output_tokens INT DEFAULT 0,
                total_tokens INT DEFAULT 0,
                
                error_code VARCHAR(50),
                error_message TEXT,
                
                client_ip VARCHAR(45),
                user_agent VARCHAR(500),
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_username (username),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at),
                INDEX idx_model (model),
                INDEX idx_mode (mode),
                INDEX idx_request_id (request_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建用户表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                api_key VARCHAR(100) UNIQUE NOT NULL,
                role ENUM('admin', 'user') DEFAULT 'user',
                
                claude_api_key TEXT,
                claude_base_url VARCHAR(255) DEFAULT 'https://api.api123.icu',
                api_type VARCHAR(50) DEFAULT 'auto',
                default_model VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929',
                default_mode VARCHAR(100) DEFAULT 'humanlike',
                default_config_id INT DEFAULT NULL,
                
                last_login_at TIMESTAMP NULL,
                login_count INT DEFAULT 0,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_username (username),
                INDEX idx_api_key (api_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建会话表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token VARCHAR(100) UNIQUE NOT NULL,
                username VARCHAR(100) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_token (token),
                INDEX idx_username (username),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建改写模式表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rewrite_modes (
                id VARCHAR(100) PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                prompt TEXT NOT NULL,
                anti_ai BOOLEAN DEFAULT FALSE,
                builtin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建 API Keys 表（用户可以有多个 API Key）
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_keys (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                api_key VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(100) DEFAULT NULL,
                status ENUM('active', 'disabled') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used_at TIMESTAMP NULL,
                
                INDEX idx_username (username),
                INDEX idx_api_key (api_key),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        // 创建 API 配置表（用户可以配置多个第三方 API）
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                base_url VARCHAR(500) NOT NULL,
                api_key TEXT NOT NULL,
                api_type VARCHAR(50) DEFAULT 'auto',
                is_default BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                priority INT DEFAULT 0,
                models TEXT,
                description TEXT,
                last_used_at TIMESTAMP NULL,
                success_count INT DEFAULT 0,
                fail_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_user_id (user_id),
                INDEX idx_is_default (is_default),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        
        connection.release();
        console.log('✅ 数据库表初始化成功');
        return true;
    } catch (error) {
        console.error('❌ 数据库表初始化失败:', error.message);
        return false;
    }
}

// 清理过期会话
async function cleanExpiredSessions() {
    try {
        const [result] = await pool.query(
            'DELETE FROM sessions WHERE expires_at < NOW()'
        );
        if (result.affectedRows > 0) {
            console.log(`🧹 清理了 ${result.affectedRows} 个过期会话`);
        }
    } catch (error) {
        console.error('清理过期会话失败:', error.message);
    }
}

// 清理旧日志（保留最近N天）
async function cleanOldLogs(daysToKeep = 30) {
    try {
        const [result] = await pool.query(
            'DELETE FROM api_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [daysToKeep]
        );
        if (result.affectedRows > 0) {
            console.log(`🧹 清理了 ${result.affectedRows} 条旧日志（保留${daysToKeep}天）`);
        }
    } catch (error) {
        console.error('清理旧日志失败:', error.message);
    }
}

// 定期清理任务（每天执行一次）
setInterval(() => {
    cleanExpiredSessions();
    cleanOldLogs(30);
}, 24 * 60 * 60 * 1000); // 24小时

module.exports = {
    pool,
    testConnection,
    initDatabase,
    cleanExpiredSessions,
    cleanOldLogs
};
