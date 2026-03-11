/**
 * 阶段2：创建节点健康日志表
 * 
 * 用于记录每次健康检查的详细结果
 */

const { pool } = require('../lib/database');

async function createHealthLogsTable() {
    const connection = await pool.getConnection();
    
    try {
        console.log('开始创建节点健康日志表...\n');
        
        // 检查表是否已存在
        const [tables] = await connection.query(`
            SHOW TABLES LIKE 'node_health_logs'
        `);
        
        if (tables.length > 0) {
            console.log('⚠️  node_health_logs 表已存在');
            const answer = 'y'; // 自动选择重建
            
            if (answer === 'y') {
                console.log('删除旧表...');
                await connection.query('DROP TABLE node_health_logs');
                console.log('✓ 旧表已删除');
            } else {
                console.log('保留现有表，退出');
                return;
            }
        }
        
        // 创建健康日志表
        console.log('创建 node_health_logs 表...');
        await connection.query(`
            CREATE TABLE node_health_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                node_id INT NOT NULL COMMENT '节点ID',
                check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '检查时间',
                
                -- 综合状态
                status VARCHAR(20) NOT NULL COMMENT '综合状态：healthy, warning, error, offline',
                
                -- 连接状态
                connectivity BOOLEAN COMMENT '连接状态：true=可连接, false=无法连接',
                latency INT COMMENT '延迟（毫秒）',
                
                -- 认证状态
                authentication VARCHAR(20) COMMENT '认证状态：valid, invalid, unknown',
                auth_error_code INT COMMENT '认证错误码（如401, 403）',
                
                -- 额度状态
                quota_status VARCHAR(20) COMMENT '额度状态：sufficient, low, exhausted, unknown',
                quota_total BIGINT COMMENT '总额度',
                quota_used BIGINT COMMENT '已用额度',
                quota_remaining BIGINT COMMENT '剩余额度',
                quota_percentage DECIMAL(5,2) COMMENT '剩余额度百分比',
                
                -- 详细信息
                error_message TEXT COMMENT '错误信息',
                response_code INT COMMENT 'HTTP状态码',
                response_time INT COMMENT '响应时间（毫秒）',
                
                INDEX idx_node_id (node_id),
                INDEX idx_check_time (check_time),
                INDEX idx_status (status),
                INDEX idx_node_time (node_id, check_time),
                
                FOREIGN KEY (node_id) REFERENCES api_configs(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='节点健康检查日志'
        `);
        
        console.log('✓ node_health_logs 表创建成功\n');
        
        // 显示表结构
        console.log('表结构：');
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'node_health_logs'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.table(columns);
        
        // 显示索引
        console.log('\n索引：');
        const [indexes] = await connection.query(`
            SHOW INDEX FROM node_health_logs
        `);
        
        const indexInfo = indexes.map(idx => ({
            索引名: idx.Key_name,
            列名: idx.Column_name,
            唯一: idx.Non_unique === 0 ? '是' : '否'
        }));
        console.table(indexInfo);
        
        console.log('\n✅ 健康日志表创建完成！');
        console.log('\n下一步：');
        console.log('1. 实现增强的健康检测逻辑');
        console.log('2. 更新健康检查接口');
        console.log('3. 更新前端显示综合状态');
        
    } catch (error) {
        console.error('❌ 创建表失败:', error);
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

// 运行脚本
createHealthLogsTable().catch(console.error);
