/**
 * 创建 API 配置表
 * 支持多个外部 API 配置
 */

const { pool } = require('../lib/database');

async function createApiConfigsTable() {
    const connection = await pool.getConnection();
    
    try {
        console.log('开始创建 api_configs 表...');
        
        // 创建 API 配置表
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_id (user_id),
                INDEX idx_is_default (is_default),
                INDEX idx_priority (priority),
                INDEX idx_is_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='外部API配置表';
        `);
        
        console.log('✅ api_configs 表创建成功！');
        
        // 迁移现有的单一配置到新表
        console.log('\n开始迁移现有配置...');
        
        const [users] = await connection.query(`
            SELECT id, username, claudeBaseURL, claudeApiKey, apiType 
            FROM users 
            WHERE claudeBaseURL IS NOT NULL AND claudeBaseURL != ''
        `);
        
        if (users.length > 0) {
            for (const user of users) {
                // 检查是否已经迁移
                const [existing] = await connection.query(
                    'SELECT id FROM api_configs WHERE user_id = ? AND base_url = ?',
                    [user.id, user.claudeBaseURL]
                );
                
                if (existing.length === 0) {
                    await connection.query(`
                        INSERT INTO api_configs 
                        (user_id, name, base_url, api_key, api_type, is_default, is_active, priority)
                        VALUES (?, ?, ?, ?, ?, TRUE, TRUE, 100)
                    `, [
                        user.id,
                        '主要 API',
                        user.claudeBaseURL,
                        user.claudeApiKey || '',
                        user.apiType || 'auto'
                    ]);
                    
                    console.log(`✅ 已迁移用户 ${user.username} 的配置`);
                }
            }
            
            console.log(`\n✅ 成功迁移 ${users.length} 个用户的配置`);
        } else {
            console.log('没有需要迁移的配置');
        }
        
        console.log('\n✅ 所有操作完成！');
        
    } catch (error) {
        console.error('❌ 创建表失败:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// 执行
createApiConfigsTable()
    .then(() => {
        console.log('\n数据库更新完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
