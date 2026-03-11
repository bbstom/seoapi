/**
 * 阶段1：添加 AI 节点管理所需的数据库字段
 * 
 * 新增字段：
 * - weight: 权重（用于负载均衡）
 * - health_status: 健康状态（healthy, warning, error, offline, unknown）
 * - last_check_at: 最后检查时间
 * - avg_latency: 平均延迟（毫秒）
 */

const { pool } = require('../lib/database');

async function addNodeFields() {
    const connection = await pool.getConnection();
    
    try {
        console.log('开始添加 AI 节点管理字段...\n');
        
        // 检查字段是否已存在
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'api_configs'
        `);
        
        const existingColumns = columns.map(col => col.COLUMN_NAME);
        
        // 添加 weight 字段
        if (!existingColumns.includes('weight')) {
            console.log('添加 weight 字段...');
            await connection.query(`
                ALTER TABLE api_configs 
                ADD COLUMN weight INT DEFAULT 1 COMMENT '权重（用于负载均衡）'
            `);
            console.log('✓ weight 字段添加成功');
        } else {
            console.log('✓ weight 字段已存在');
        }
        
        // 添加 health_status 字段
        if (!existingColumns.includes('health_status')) {
            console.log('添加 health_status 字段...');
            await connection.query(`
                ALTER TABLE api_configs 
                ADD COLUMN health_status VARCHAR(20) DEFAULT 'unknown' 
                COMMENT '健康状态：healthy, warning, error, offline, unknown'
            `);
            console.log('✓ health_status 字段添加成功');
        } else {
            console.log('✓ health_status 字段已存在');
        }
        
        // 添加 last_check_at 字段
        if (!existingColumns.includes('last_check_at')) {
            console.log('添加 last_check_at 字段...');
            await connection.query(`
                ALTER TABLE api_configs 
                ADD COLUMN last_check_at TIMESTAMP NULL 
                COMMENT '最后检查时间'
            `);
            console.log('✓ last_check_at 字段添加成功');
        } else {
            console.log('✓ last_check_at 字段已存在');
        }
        
        // 添加 avg_latency 字段
        if (!existingColumns.includes('avg_latency')) {
            console.log('添加 avg_latency 字段...');
            await connection.query(`
                ALTER TABLE api_configs 
                ADD COLUMN avg_latency INT DEFAULT 0 
                COMMENT '平均延迟（毫秒）'
            `);
            console.log('✓ avg_latency 字段添加成功');
        } else {
            console.log('✓ avg_latency 字段已存在');
        }
        
        // 添加索引
        console.log('\n添加索引...');
        
        try {
            await connection.query(`
                CREATE INDEX idx_health_status ON api_configs(health_status)
            `);
            console.log('✓ health_status 索引添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('✓ health_status 索引已存在');
            } else {
                throw error;
            }
        }
        
        // 查看表结构
        console.log('\n当前表结构：');
        const [tableInfo] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'api_configs'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.table(tableInfo);
        
        console.log('\n✅ 所有字段添加完成！');
        console.log('\n下一步：');
        console.log('1. 重启服务器以应用更改');
        console.log('2. 刷新前端页面查看新功能');
        
    } catch (error) {
        console.error('❌ 添加字段失败:', error);
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

// 运行脚本
addNodeFields().catch(console.error);
