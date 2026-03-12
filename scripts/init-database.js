/**
 * 数据库初始化脚本
 * 用于生产环境部署
 * 
 * 功能：
 * 1. 创建所有必需的数据库表
 * 2. 创建默认管理员账号
 * 3. 初始化系统配置
 * 
 * 使用方法：
 * node scripts/init-database.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

// 数据库配置
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seoapi',
    port: process.env.DB_PORT || 3306
};

// 默认管理员配置
const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'admin123',
    role: 'admin'
};

async function initDatabase() {
    let connection;
    
    try {
        console.log('========================================');
        console.log('数据库初始化开始');
        console.log('========================================\n');
        
        // 连接数据库
        console.log('1. 连接数据库...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✓ 数据库连接成功\n');
        
        // 创建表
        console.log('2. 创建数据库表...');
        await createTables(connection);
        console.log('✓ 所有表创建完成\n');
        
        // 创建默认管理员
        console.log('3. 创建默认管理员账号...');
        await createDefaultAdmin(connection);
        console.log('✓ 默认管理员创建完成\n');
        
        console.log('========================================');
        console.log('数据库初始化完成！');
        console.log('========================================\n');
        
        console.log('默认管理员账号信息：');
        console.log(`  用户名: ${DEFAULT_ADMIN.username}`);
        console.log(`  密码: ${DEFAULT_ADMIN.password}`);
        console.log('\n⚠️  请在首次登录后立即修改密码！\n');
        
    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function createTables(connection) {
    const tables = [
        // 1. 用户表
        {
            name: 'users',
            sql: `CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                claudeApiKey TEXT,
                claudeBaseURL VARCHAR(255) DEFAULT 'https://api.api123.icu',
                apiType VARCHAR(50) DEFAULT 'auto',
                defaultMode VARCHAR(50) DEFAULT 'humanlike',
                defaultModel VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929',
                defaultConfigId INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_username (username),
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 2. 会话表
        {
            name: 'sessions',
            sql: `CREATE TABLE IF NOT EXISTS sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                token VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                INDEX idx_token (token),
                INDEX idx_username (username),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 3. API令牌表
        {
            name: 'api_keys',
            sql: `CREATE TABLE IF NOT EXISTS api_keys (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                api_key VARCHAR(255) UNIQUE NOT NULL,
                node_strategy VARCHAR(20) DEFAULT 'load_balance',
                fixed_node_id INT,
                fixed_model VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                last_used_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_api_key (api_key),
                INDEX idx_user_id (user_id),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 4. API配置表
        {
            name: 'api_configs',
            sql: `CREATE TABLE IF NOT EXISTS api_configs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                base_url VARCHAR(255) NOT NULL,
                api_key TEXT NOT NULL,
                api_type VARCHAR(50) DEFAULT 'auto',
                models TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                is_default BOOLEAN DEFAULT FALSE,
                priority INT DEFAULT 0,
                weight INT DEFAULT 1,
                description TEXT,
                health_status VARCHAR(20) DEFAULT 'unknown',
                last_check_at TIMESTAMP NULL,
                avg_latency INT DEFAULT 0,
                last_error TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_active (is_active),
                INDEX idx_is_default (is_default),
                INDEX idx_health_status (health_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 5. API日志表
        {
            name: 'api_logs',
            sql: `CREATE TABLE IF NOT EXISTS api_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                request_id VARCHAR(50) NOT NULL,
                username VARCHAR(50) NOT NULL,
                status VARCHAR(20) NOT NULL,
                base_url VARCHAR(255),
                api_type VARCHAR(50),
                model VARCHAR(100),
                mode VARCHAR(50),
                input_length INT,
                output_length INT,
                duration DECIMAL(10,3),
                api_duration DECIMAL(10,3),
                input_tokens INT DEFAULT 0,
                output_tokens INT DEFAULT 0,
                total_tokens INT DEFAULT 0,
                error_code VARCHAR(50),
                error_message TEXT,
                client_ip VARCHAR(50),
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_request_id (request_id),
                INDEX idx_username (username),
                INDEX idx_status (status),
                INDEX idx_created_at (created_at),
                INDEX idx_model (model),
                INDEX idx_mode (mode)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 6. 请求统计表
        {
            name: 'request_stats',
            sql: `CREATE TABLE IF NOT EXISTS request_stats (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                node_id INT NOT NULL,
                date DATE NOT NULL,
                hour TINYINT NOT NULL,
                total_requests INT DEFAULT 0,
                success_requests INT DEFAULT 0,
                failed_requests INT DEFAULT 0,
                total_latency BIGINT DEFAULT 0,
                min_latency INT DEFAULT 0,
                max_latency INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_stat (user_id, node_id, date, hour),
                INDEX idx_user_id (user_id),
                INDEX idx_node_id (node_id),
                INDEX idx_date (date),
                INDEX idx_hour (hour)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 7. 节点健康日志表
        {
            name: 'node_health_logs',
            sql: `CREATE TABLE IF NOT EXISTS node_health_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                node_id INT NOT NULL,
                status VARCHAR(20) NOT NULL,
                latency INT,
                error_message TEXT,
                checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_node_id (node_id),
                INDEX idx_status (status),
                INDEX idx_checked_at (checked_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 8. 故障转移日志表
        {
            name: 'failover_logs',
            sql: `CREATE TABLE IF NOT EXISTS failover_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                from_node_id INT,
                to_node_id INT NOT NULL,
                failure_reason TEXT,
                success BOOLEAN DEFAULT FALSE,
                retry_count INT DEFAULT 0,
                total_latency INT,
                failover_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user_id (user_id),
                INDEX idx_from_node (from_node_id),
                INDEX idx_to_node (to_node_id),
                INDEX idx_success (success),
                INDEX idx_failover_time (failover_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 9. 告警规则表
        {
            name: 'alert_rules',
            sql: `CREATE TABLE IF NOT EXISTS alert_rules (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                condition_field VARCHAR(50) NOT NULL,
                condition_operator VARCHAR(20) NOT NULL,
                condition_value DECIMAL(10,2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_type (type),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        },
        
        // 10. 告警日志表
        {
            name: 'alert_logs',
            sql: `CREATE TABLE IF NOT EXISTS alert_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                rule_id INT NOT NULL,
                user_id INT NOT NULL,
                message TEXT NOT NULL,
                severity VARCHAR(20) DEFAULT 'warning',
                is_read BOOLEAN DEFAULT FALSE,
                triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_rule_id (rule_id),
                INDEX idx_user_id (user_id),
                INDEX idx_is_read (is_read),
                INDEX idx_triggered_at (triggered_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        }
    ];
    
    for (const table of tables) {
        try {
            await connection.execute(table.sql);
            console.log(`  ✓ ${table.name}`);
        } catch (error) {
            console.error(`  ✗ ${table.name}: ${error.message}`);
            throw error;
        }
    }
}

async function createDefaultAdmin(connection) {
    try {
        // 检查是否已存在管理员
        const [existing] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [DEFAULT_ADMIN.username]
        );
        
        if (existing.length > 0) {
            console.log(`  ⚠️  管理员账号 "${DEFAULT_ADMIN.username}" 已存在，跳过创建`);
            return;
        }
        
        // 创建管理员
        const hashedPassword = await bcrypt.hash(DEFAULT_ADMIN.password, 10);
        await connection.execute(
            `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
            [DEFAULT_ADMIN.username, hashedPassword, DEFAULT_ADMIN.role]
        );
        
        console.log(`  ✓ 管理员账号 "${DEFAULT_ADMIN.username}" 创建成功`);
        
    } catch (error) {
        console.error(`  ✗ 创建管理员失败: ${error.message}`);
        throw error;
    }
}

// 执行初始化
if (require.main === module) {
    initDatabase();
}

module.exports = { initDatabase };
