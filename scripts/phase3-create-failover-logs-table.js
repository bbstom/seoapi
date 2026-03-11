/**
 * 阶段3：创建故障转移日志表
 * 
 * 用于记录每次故障转移的详细信息
 */

const { pool } = require('../lib/database');

async function createFailoverLogsTable() {
    const connection = await pool.getConnection();
    
    try {
        console.log('开始创建故障转移日志表...\n');
        
        // 检查表是否已存在
        const [tables] = await connection.query(`
            SHOW TABLES LIKE 'failover_logs'
        `);
        
        if (tables.length > 0) {
            console.log('⚠️  failover_logs 表已存在');
            const answer = 'y'; // 自动选择重建
            
            if (answer === 'y') {
                console.log('删除旧表...');
                await connection.query('DROP TABLE failover_logs');
                console.log('✓ 旧表已删除');
            } else {
                console.log('保留现有表，退出');
                return;
            }
        }
        
        // 创建故障转移日志表
        console.log('创建 failover_logs 表...');
        await connection.query(`
            CREATE TABLE failover_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL COMMENT '用户ID',
                
                -- 转移信息
                failover_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '转移时间',
                from_node_id INT COMMENT '源节点ID（失败的节点）',
                to_node_id INT NOT NULL COMMENT '目标节点ID（切换到的节点）',
                
                -- 失败原因
                failure_reason VARCHAR(100) COMMENT '失败原因',
                failure_details TEXT COMMENT '失败详情',
                
                -- 请求信息
                request_model VARCHAR(100) COMMENT '请求的模型',
                request_endpoint VARCHAR(200) COMMENT '请求的端点',
                
                -- 转移结果
                success BOOLEAN DEFAULT TRUE COMMENT '转移是否成功',
                retry_count INT DEFAULT 0 COMMENT '重试次数',
                total_latency INT COMMENT '总延迟（毫秒）',
                
                -- 节点状态
                from_node_status VARCHAR(20) COMMENT '源节点状态',
                to_node_status VARCHAR(20) COMMENT '目标节点状态',
                
                INDEX idx_user_id (user_id),
                INDEX idx_failover_time (failover_time),
                INDEX idx_from_node (from_node_id),
                INDEX idx_to_node (to_node_id),
                INDEX idx_success (success),
                
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (from_node_id) REFERENCES api_configs(id) ON DELETE SET NULL,
                FOREIGN KEY (to_node_id) REFERENCES api_configs(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故障转移日志'
        `);
        
        console.log('✓ failover_logs 表创建成功\n');
        
        // 显示表结构
        console.log('表结构：');
        const [columns] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'failover_logs'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.table(columns);
        
        // 显示索引
        console.log('\n索引：');
        const [indexes] = await connection.query(`
            SHOW INDEX FROM failover_logs
        `);
        
        const indexInfo = indexes.map(idx => ({
            索引名: idx.Key_name,
            列名: idx.Column_name,
            唯一: idx.Non_unique === 0 ? '是' : '否'
        }));
        console.table(indexInfo);
        
        console.log('\n✅ 故障转移日志表创建完成！');
        console.log('\n下一步：');
        console.log('1. 实现智能节点选择算法');
        console.log('2. 实现自动故障转移逻辑');
        console.log('3. 集成到 API 调用流程');
        
    } catch (error) {
        console.error('❌ 创建表失败:', error);
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

// 运行脚本
createFailoverLogsTable().catch(console.error);
