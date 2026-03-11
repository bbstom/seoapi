/**
 * 数据库迁移脚本：添加 default_config_id 字段
 * 为 users 表添加默认 API 配置 ID 字段
 */

const { pool } = require('../lib/database');

async function addDefaultConfigField() {
    console.log('========================================');
    console.log('开始添加 default_config_id 字段');
    console.log('========================================\n');
    
    try {
        // 检查字段是否已存在
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'users' 
            AND COLUMN_NAME = 'default_config_id'
        `);
        
        if (columns.length > 0) {
            console.log('✅ default_config_id 字段已存在，无需添加');
            return;
        }
        
        console.log('📝 添加 default_config_id 字段到 users 表...');
        
        // 添加字段
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN default_config_id INT DEFAULT NULL AFTER default_mode
        `);
        
        console.log('✅ 字段添加成功');
        
        // 添加外键约束（如果 api_configs 表存在）
        try {
            console.log('📝 添加外键约束...');
            await pool.query(`
                ALTER TABLE users 
                ADD CONSTRAINT fk_users_default_config 
                FOREIGN KEY (default_config_id) 
                REFERENCES api_configs(id) 
                ON DELETE SET NULL
            `);
            console.log('✅ 外键约束添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('ℹ️  外键约束已存在');
            } else {
                console.log('⚠️  外键约束添加失败（可能 api_configs 表不存在）:', error.message);
            }
        }
        
        console.log('\n========================================');
        console.log('✅ 迁移完成！');
        console.log('========================================');
        
    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

// 运行迁移
addDefaultConfigField();
