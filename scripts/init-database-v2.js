/**
 * 数据库初始化脚本 V2
 * 全新的数据库架构设计
 */

const { pool } = require('../lib/database');
const bcrypt = require('bcrypt');

async function initDatabase() {
    const connection = await pool.getConnection();
    
    try {
        console.log('========================================');
        console.log('开始初始化数据库...');
        console.log('========================================\n');

        // 1. 用户表
        console.log('1. 创建 users 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
                password VARCHAR(255) NOT NULL COMMENT '密码（bcrypt加密）',
                email VARCHAR(100) COMMENT '邮箱',
                role ENUM('admin', 'user') DEFAULT 'user' COMMENT '角色',
                api_key VARCHAR(64) UNIQUE NOT NULL COMMENT 'API密钥',
                status ENUM('active', 'disabled') DEFAULT 'active' COMMENT '状态',
                default_model VARCHAR(100) COMMENT '默认模型',
                default_mode VARCHAR(50) COMMENT '默认改写模式',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
                INDEX idx_username (username),
                INDEX idx_api_key (api_key),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
        `);
        console.log('✅ users 表创建成功\n');

        // 2. 会话表
        console.log('2. 创建 sessions 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                session_token VARCHAR(64) UNIQUE NOT NULL COMMENT '会话令牌',
                ip_address VARCHAR(45) COMMENT 'IP地址',
                user_agent TEXT COMMENT '用户代理',
                expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_session_token (session_token),
                INDEX idx_user_id (user_id),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';
        `);
        console.log('✅ sessions 表创建成功\n');

        // 3. API 配置表（多 API 支持）
        console.log('3. 创建 api_configs 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_configs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL COMMENT 'API配置名称',
                base_url VARCHAR(500) NOT NULL COMMENT 'Base URL',
                api_key TEXT NOT NULL COMMENT 'API Key（加密存储）',
                api_type VARCHAR(50) DEFAULT 'auto' COMMENT 'API类型',
                is_default BOOLEAN DEFAULT FALSE COMMENT '是否为默认配置',
                is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
                priority INT DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',
                models TEXT COMMENT '可用模型列表（JSON）',
                description TEXT COMMENT '配置描述',
                last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
                success_count INT DEFAULT 0 COMMENT '成功次数',
                fail_count INT DEFAULT 0 COMMENT '失败次数',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_default (is_default),
                INDEX idx_priority (priority),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外部API配置表';
        `);
        console.log('✅ api_configs 表创建成功\n');

        // 4. API 日志表
        console.log('4. 创建 api_logs 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                api_config_id INT COMMENT '使用的API配置ID',
                request_type VARCHAR(50) COMMENT '请求类型（rewrite等）',
                model VARCHAR(100) COMMENT '使用的模型',
                mode VARCHAR(50) COMMENT '改写模式',
                input_length INT COMMENT '输入文本长度',
                output_length INT COMMENT '输出文本长度',
                similarity DECIMAL(5,4) COMMENT '相似度',
                duration DECIMAL(10,3) COMMENT '耗时（秒）',
                usage JSON COMMENT 'Token使用情况',
                status ENUM('success', 'failed') DEFAULT 'success' COMMENT '状态',
                error_message TEXT COMMENT '错误信息',
                ip_address VARCHAR(45) COMMENT 'IP地址',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (api_config_id) REFERENCES api_configs(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_api_config_id (api_config_id),
                INDEX idx_created_at (created_at),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API调用日志表';
        `);
        console.log('✅ api_logs 表创建成功\n');

        // 5. 改写模式表
        console.log('5. 创建 rewrite_modes 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS rewrite_modes (
                id INT PRIMARY KEY AUTO_INCREMENT,
                mode_key VARCHAR(50) UNIQUE NOT NULL COMMENT '模式标识',
                name VARCHAR(100) NOT NULL COMMENT '模式名称',
                description TEXT COMMENT '模式描述',
                context TEXT NOT NULL COMMENT '提示词上下文',
                anti_ai BOOLEAN DEFAULT FALSE COMMENT '是否反AI检测',
                is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
                sort_order INT DEFAULT 0 COMMENT '排序',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_mode_key (mode_key),
                INDEX idx_is_active (is_active),
                INDEX idx_sort_order (sort_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='改写模式表';
        `);
        console.log('✅ rewrite_modes 表创建成功\n');

        // 6. API 令牌表（用于外部工具调用）
        console.log('6. 创建 api_tokens 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS api_tokens (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL COMMENT '令牌名称',
                token VARCHAR(64) UNIQUE NOT NULL COMMENT '令牌值',
                is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
                last_used_at TIMESTAMP NULL COMMENT '最后使用时间',
                usage_count INT DEFAULT 0 COMMENT '使用次数',
                expires_at TIMESTAMP NULL COMMENT '过期时间',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_token (token),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API令牌表';
        `);
        console.log('✅ api_tokens 表创建成功\n');

        // 7. 审计日志表
        console.log('7. 创建 audit_logs 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT,
                action VARCHAR(100) NOT NULL COMMENT '操作类型',
                resource_type VARCHAR(50) COMMENT '资源类型',
                resource_id INT COMMENT '资源ID',
                details JSON COMMENT '详细信息',
                ip_address VARCHAR(45) COMMENT 'IP地址',
                user_agent TEXT COMMENT '用户代理',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_action (action),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
        `);
        console.log('✅ audit_logs 表创建成功\n');

        // 8. 系统设置表
        console.log('8. 创建 system_settings 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '设置键',
                setting_value TEXT COMMENT '设置值',
                setting_type VARCHAR(20) DEFAULT 'string' COMMENT '值类型',
                description TEXT COMMENT '描述',
                is_public BOOLEAN DEFAULT FALSE COMMENT '是否公开',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_setting_key (setting_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统设置表';
        `);
        console.log('✅ system_settings 表创建成功\n');

        // 插入默认改写模式
        console.log('9. 插入默认改写模式...');
        const defaultModes = [
            {
                mode_key: 'standard',
                name: '标准改写',
                description: '保持原意的标准改写',
                context: '请对以下文本进行改写，保持原意但使用不同的表达方式。',
                anti_ai: false,
                sort_order: 1
            },
            {
                mode_key: 'professional',
                name: '专业改写',
                description: '更加专业和正式的表达',
                context: '请将以下文本改写得更加专业和正式，适合商务场合使用。',
                anti_ai: false,
                sort_order: 2
            },
            {
                mode_key: 'casual',
                name: '口语化改写',
                description: '更加口语化和通俗易懂',
                context: '请将以下文本改写得更加口语化和通俗易懂，适合日常交流。',
                anti_ai: false,
                sort_order: 3
            },
            {
                mode_key: 'creative',
                name: '创意改写',
                description: '富有创意和想象力的改写',
                context: '请对以下文本进行创意改写，使用更加生动和富有想象力的表达。',
                anti_ai: false,
                sort_order: 4
            },
            {
                mode_key: 'anti_ai',
                name: '反AI检测',
                description: '降低AI检测率的改写',
                context: '请对以下文本进行深度改写，使其更接近人类写作风格，降低AI检测率。注意：1) 使用自然的语言节奏和变化 2) 加入适当的口语化表达 3) 避免过于完美的语法结构 4) 保持内容的真实性和可读性。',
                anti_ai: true,
                sort_order: 5
            }
        ];

        for (const mode of defaultModes) {
            await connection.query(
                `INSERT INTO rewrite_modes (mode_key, name, description, context, anti_ai, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                 name = VALUES(name),
                 description = VALUES(description),
                 context = VALUES(context),
                 anti_ai = VALUES(anti_ai),
                 sort_order = VALUES(sort_order)`,
                [mode.mode_key, mode.name, mode.description, mode.context, mode.anti_ai, mode.sort_order]
            );
        }
        console.log('✅ 默认改写模式插入成功\n');

        // 创建默认管理员账号
        console.log('10. 创建默认管理员账号...');
        const adminUsername = 'admin';
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const crypto = require('crypto');
        const apiKey = crypto.randomBytes(32).toString('hex');

        await connection.query(
            `INSERT INTO users (username, password, role, api_key)
             VALUES (?, ?, 'admin', ?)
             ON DUPLICATE KEY UPDATE password = VALUES(password)`,
            [adminUsername, hashedPassword, apiKey]
        );
        console.log('✅ 默认管理员账号创建成功');
        console.log(`   用户名: ${adminUsername}`);
        console.log(`   密码: ${adminPassword}`);
        console.log(`   API Key: ${apiKey}\n`);

        console.log('========================================');
        console.log('✅ 数据库初始化完成！');
        console.log('========================================\n');

        console.log('数据库表列表：');
        console.log('1. users - 用户表');
        console.log('2. sessions - 会话表');
        console.log('3. api_configs - API配置表（支持多API）');
        console.log('4. api_logs - API调用日志表');
        console.log('5. rewrite_modes - 改写模式表');
        console.log('6. api_tokens - API令牌表');
        console.log('7. audit_logs - 审计日志表');
        console.log('8. system_settings - 系统设置表\n');

        console.log('默认账号信息：');
        console.log(`管理员: ${adminUsername} / ${adminPassword}`);
        console.log('\n⚠️  请立即修改默认密码！\n');

    } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// 执行初始化
initDatabase()
    .then(() => {
        console.log('数据库初始化脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
