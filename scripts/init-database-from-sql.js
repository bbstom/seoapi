#!/usr/bin/env node

/**
 * 数据库初始化脚本 - 基于 seoapi2.sql 的完整结构
 * 此脚本根据生产环境的实际数据库结构创建
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seoapi',
  charset: 'utf8mb4'
};

async function initDatabase() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('数据库初始化开始');
    console.log('========================================');
    
    // 1. 连接数据库
    console.log('\n1. 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功');
    
    // 2. 创建表
    console.log('\n2. 创建数据库表...');
    
    // users 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        api_key VARCHAR(100) NOT NULL,
        role ENUM('admin','user') DEFAULT 'user',
        claude_api_key TEXT NULL,
        claude_base_url VARCHAR(255) DEFAULT 'https://api.api123.icu',
        api_type VARCHAR(50) DEFAULT 'auto',
        default_model VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929',
        default_mode VARCHAR(100) DEFAULT 'humanlike',
        default_config_id INT NULL DEFAULT NULL,
        last_login_at TIMESTAMP NULL DEFAULT NULL,
        login_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY username (username),
        UNIQUE KEY api_key (api_key),
        INDEX idx_username (username),
        INDEX idx_api_key (api_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ users');
    
    // sessions 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INT NOT NULL AUTO_INCREMENT,
        token VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY token (token),
        INDEX idx_token (token),
        INDEX idx_username (username),
        INDEX idx_expires_at (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ sessions');
    
    // api_keys 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT NOT NULL AUTO_INCREMENT,
        username VARCHAR(100) NOT NULL,
        api_key VARCHAR(100) NOT NULL,
        name VARCHAR(100) NULL DEFAULT NULL,
        status ENUM('active','disabled') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP NULL DEFAULT NULL,
        node_strategy ENUM('load_balance','fixed') DEFAULT 'load_balance' COMMENT '节点选择策略：load_balance=负载均衡，fixed=固定节点',
        fixed_node_id INT NULL DEFAULT NULL COMMENT '固定节点ID（当 node_strategy=fixed 时使用）',
        fixed_model VARCHAR(100) NULL DEFAULT NULL COMMENT '固定模型（当使用固定节点时可指定模型）',
        load_balance_nodes JSON NULL COMMENT '负载均衡节点池（节点ID数组）',
        load_balance_strategy VARCHAR(50) DEFAULT 'round_robin' COMMENT '负载均衡策略：round_robin(轮询), weighted(加权), least_connections(最少连接)',
        allowed_models JSON NULL COMMENT '允许使用的模型列表（JSON数组）',
        default_model VARCHAR(255) NULL DEFAULT NULL COMMENT '默认使用的模型',
        PRIMARY KEY (id),
        UNIQUE KEY api_key (api_key),
        INDEX idx_username (username),
        INDEX idx_api_key (api_key),
        INDEX idx_status (status),
        INDEX idx_node_strategy (node_strategy)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ api_keys');
    
    // api_configs 表 - 关键：包含所有字段
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_configs (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        base_url VARCHAR(500) NOT NULL,
        api_key TEXT NOT NULL,
        api_type VARCHAR(50) DEFAULT 'auto',
        is_default TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        priority INT DEFAULT 0,
        models TEXT NULL,
        description TEXT NULL,
        last_used_at TIMESTAMP NULL DEFAULT NULL,
        success_count INT DEFAULT 0,
        fail_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        weight INT DEFAULT 1 COMMENT '权重（用于负载均衡）',
        health_status VARCHAR(20) DEFAULT 'unknown' COMMENT '健康状态：healthy, warning, error, offline, unknown',
        last_check_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后检查时间',
        avg_latency INT DEFAULT 0 COMMENT '平均延迟（毫秒）',
        active_connections INT DEFAULT 0 COMMENT '活跃连接数',
        total_connections BIGINT DEFAULT 0 COMMENT '总连接数',
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        INDEX idx_is_default (is_default),
        INDEX idx_is_active (is_active),
        INDEX idx_health_status (health_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ api_configs');
    
    // api_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        request_id VARCHAR(64) NOT NULL,
        username VARCHAR(100) NOT NULL,
        status ENUM('success','error') NOT NULL,
        base_url VARCHAR(255) NULL DEFAULT NULL,
        node_id INT NULL COMMENT 'API节点ID',
        node_name VARCHAR(100) NULL COMMENT 'API节点名称',
        api_type VARCHAR(50) NULL DEFAULT NULL,
        model VARCHAR(100) NULL DEFAULT NULL,
        mode VARCHAR(100) NULL DEFAULT NULL,
        input_length INT NULL DEFAULT NULL,
        output_length INT NULL DEFAULT NULL,
        duration DECIMAL(10,3) NULL DEFAULT NULL,
        api_duration DECIMAL(10,3) NULL DEFAULT NULL,
        input_tokens INT DEFAULT 0,
        output_tokens INT DEFAULT 0,
        total_tokens INT DEFAULT 0,
        error_code VARCHAR(50) NULL DEFAULT NULL,
        error_message TEXT NULL,
        client_ip VARCHAR(45) NULL DEFAULT NULL,
        user_agent VARCHAR(500) NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_username (username),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at),
        INDEX idx_model (model),
        INDEX idx_mode (mode),
        INDEX idx_request_id (request_id),
        INDEX idx_node_id (node_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ api_logs');
    
    // node_health_logs 表 - 关键：包含所有健康检查字段
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS node_health_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        node_id INT NOT NULL COMMENT '节点ID',
        check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '检查时间',
        status VARCHAR(20) NOT NULL COMMENT '综合状态：healthy, warning, error, offline',
        connectivity TINYINT(1) NULL DEFAULT NULL COMMENT '连接状态：true=可连接, false=无法连接',
        latency INT NULL DEFAULT NULL COMMENT '延迟（毫秒）',
        authentication VARCHAR(20) NULL DEFAULT NULL COMMENT '认证状态：valid, invalid, unknown',
        auth_error_code INT NULL DEFAULT NULL COMMENT '认证错误码（如401, 403）',
        quota_status VARCHAR(20) NULL DEFAULT NULL COMMENT '额度状态：sufficient, low, exhausted, unknown',
        quota_total BIGINT NULL DEFAULT NULL COMMENT '总额度',
        quota_used BIGINT NULL DEFAULT NULL COMMENT '已用额度',
        quota_remaining BIGINT NULL DEFAULT NULL COMMENT '剩余额度',
        quota_percentage DECIMAL(5,2) NULL DEFAULT NULL COMMENT '剩余额度百分比',
        error_message TEXT NULL COMMENT '错误信息',
        response_code INT NULL DEFAULT NULL COMMENT 'HTTP状态码',
        response_time INT NULL DEFAULT NULL COMMENT '响应时间（毫秒）',
        PRIMARY KEY (id),
        INDEX idx_node_id (node_id),
        INDEX idx_check_time (check_time),
        INDEX idx_status (status),
        INDEX idx_node_time (node_id, check_time),
        CONSTRAINT node_health_logs_ibfk_1 FOREIGN KEY (node_id) REFERENCES api_configs (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='节点健康检查日志'
    `);
    console.log('✓ node_health_logs');
    
    // request_stats 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS request_stats (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        node_id INT NOT NULL,
        date DATE NOT NULL,
        hour TINYINT NOT NULL,
        total_requests INT DEFAULT 0 COMMENT '总请求数',
        success_requests INT DEFAULT 0 COMMENT '成功请求数',
        failed_requests INT DEFAULT 0 COMMENT '失败请求数',
        total_latency BIGINT DEFAULT 0 COMMENT '总延迟（毫秒）',
        min_latency INT DEFAULT 0 COMMENT '最小延迟',
        max_latency INT DEFAULT 0 COMMENT '最大延迟',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_node_date_hour (user_id, node_id, date, hour),
        INDEX idx_user_date (user_id, date),
        INDEX idx_node_date (node_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='请求统计表'
    `);
    console.log('✓ request_stats');
    
    // failover_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS failover_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL COMMENT '用户ID',
        failover_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '转移时间',
        from_node_id INT NULL DEFAULT NULL COMMENT '源节点ID（失败的节点）',
        to_node_id INT NOT NULL COMMENT '目标节点ID（切换到的节点）',
        failure_reason VARCHAR(100) NULL DEFAULT NULL COMMENT '失败原因',
        failure_details TEXT NULL COMMENT '失败详情',
        request_model VARCHAR(100) NULL DEFAULT NULL COMMENT '请求的模型',
        request_endpoint VARCHAR(200) NULL DEFAULT NULL COMMENT '请求的端点',
        success TINYINT(1) DEFAULT 1 COMMENT '转移是否成功',
        retry_count INT DEFAULT 0 COMMENT '重试次数',
        total_latency INT NULL DEFAULT NULL COMMENT '总延迟（毫秒）',
        from_node_status VARCHAR(20) NULL DEFAULT NULL COMMENT '源节点状态',
        to_node_status VARCHAR(20) NULL DEFAULT NULL COMMENT '目标节点状态',
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        INDEX idx_failover_time (failover_time),
        INDEX idx_from_node (from_node_id),
        INDEX idx_to_node (to_node_id),
        INDEX idx_success (success),
        CONSTRAINT failover_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT failover_logs_ibfk_2 FOREIGN KEY (from_node_id) REFERENCES api_configs (id) ON DELETE SET NULL,
        CONSTRAINT failover_logs_ibfk_3 FOREIGN KEY (to_node_id) REFERENCES api_configs (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='故障转移日志'
    `);
    console.log('✓ failover_logs');
    
    // alert_rules 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS alert_rules (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
        enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        threshold INT NULL DEFAULT NULL COMMENT '阈值',
        notify_email TINYINT(1) DEFAULT 0 COMMENT '邮件通知',
        notify_webhook TINYINT(1) DEFAULT 0 COMMENT 'Webhook通知',
        webhook_url VARCHAR(500) NULL DEFAULT NULL COMMENT 'Webhook地址',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        INDEX idx_alert_type (alert_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='告警规则表'
    `);
    console.log('✓ alert_rules');
    
    // alert_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS alert_logs (
        id BIGINT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
        node_id INT NULL DEFAULT NULL COMMENT '节点ID',
        message TEXT NULL COMMENT '告警消息',
        details TEXT NULL COMMENT '详细信息',
        notified TINYINT(1) DEFAULT 0 COMMENT '是否已通知',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at),
        INDEX idx_node_id (node_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='告警日志表'
    `);
    console.log('✓ alert_logs');
    
    // api_tokens 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS api_tokens (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        name VARCHAR(100) NOT NULL COMMENT '令牌名称',
        token VARCHAR(64) NOT NULL COMMENT '令牌值',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        last_used_at TIMESTAMP NULL DEFAULT NULL COMMENT '最后使用时间',
        usage_count INT DEFAULT 0 COMMENT '使用次数',
        expires_at TIMESTAMP NULL DEFAULT NULL COMMENT '过期时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY token (token),
        INDEX idx_user_id (user_id),
        INDEX idx_token (token),
        INDEX idx_is_active (is_active),
        CONSTRAINT api_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='API令牌表'
    `);
    console.log('✓ api_tokens');
    
    // audit_logs 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NULL DEFAULT NULL,
        action VARCHAR(100) NOT NULL COMMENT '操作类型',
        resource_type VARCHAR(50) NULL DEFAULT NULL COMMENT '资源类型',
        resource_id INT NULL DEFAULT NULL COMMENT '资源ID',
        details JSON NULL COMMENT '详细信息',
        ip_address VARCHAR(45) NULL DEFAULT NULL COMMENT 'IP地址',
        user_agent TEXT NULL COMMENT '用户代理',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        CONSTRAINT audit_logs_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审计日志表'
    `);
    console.log('✓ audit_logs');
    
    // system_settings 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(100) NOT NULL COMMENT '设置键',
        setting_value TEXT NULL COMMENT '设置值',
        setting_type VARCHAR(20) DEFAULT 'string' COMMENT '值类型',
        description TEXT NULL COMMENT '描述',
        is_public TINYINT(1) DEFAULT 0 COMMENT '是否公开',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY setting_key (setting_key),
        INDEX idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统设置表'
    `);
    console.log('✓ system_settings');
    
    // rewrite_modes 表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rewrite_modes (
        id VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT NULL,
        prompt TEXT NOT NULL,
        anti_ai TINYINT(1) DEFAULT 0,
        builtin TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ rewrite_modes');
    
    console.log('✓ 所有表创建完成');
    
    // 3. 创建默认管理员账号
    console.log('\n3. 创建默认管理员账号...');
    
    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    
    const username = 'admin';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = 'sk_' + crypto.randomBytes(32).toString('hex');
    
    // 检查是否已存在管理员
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    
    if (existingUsers.length === 0) {
      await connection.execute(
        `INSERT INTO users (username, password, api_key, role) VALUES (?, ?, ?, 'admin')`,
        [username, hashedPassword, apiKey]
      );
      console.log(`✓ 管理员账号 "${username}" 创建成功`);
    } else {
      console.log(`ℹ 管理员账号 "${username}" 已存在，跳过创建`);
    }
    
    console.log('✓ 默认管理员创建完成');
    
    console.log('\n========================================');
    console.log('数据库初始化完成！');
    console.log('========================================');
    console.log('\n默认管理员账号信息：');
    console.log(`用户名: ${username}`);
    console.log(`密码: ${password}`);
    console.log('\n⚠️  请在首次登录后立即修改密码！');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error('\n详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行初始化
initDatabase();
