/**
 * 阶段5数据库迁移 - 创建监控统计表
 * 
 * 创建3个表：
 * 1. request_stats - 请求统计
 * 2. alert_rules - 告警规则
 * 3. alert_logs - 告警日志
 */

const { pool, testConnection } = require('../lib/database');

async function migrate() {
    console.log('========================================');
    console.log('阶段5数据库迁移 - 创建监控统计表');
    console.log('========================================\n');
    
    try {
        // 测试数据库连接
        console.log('1. 测试数据库连接...');
        const connected = await testConnection();
        
        if (!connected) {
            console.error('❌ 数据库连接失败');
            process.exit(1);
        }
        
        console.log('✅ 数据库连接成功\n');
        
        // 创建 request_stats 表
        console.log('2. 创建 request_stats 表...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS request_stats (
              id BIGINT PRIMARY KEY AUTO_INCREMENT,
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
              UNIQUE KEY uk_user_node_date_hour (user_id, node_id, date, hour),
              INDEX idx_user_date (user_id, date),
              INDEX idx_node_date (node_id, date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='请求统计表'
        `);
        console.log('✅ request_stats 表创建成功\n');
        
        // 创建 alert_rules 表
        console.log('3. 创建 alert_rules 表...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_rules (
              id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
              enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',
              threshold INT COMMENT '阈值',
              notify_email BOOLEAN DEFAULT FALSE COMMENT '邮件通知',
              notify_webhook BOOLEAN DEFAULT FALSE COMMENT 'Webhook通知',
              webhook_url VARCHAR(500) COMMENT 'Webhook地址',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_user_id (user_id),
              INDEX idx_alert_type (alert_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则表'
        `);
        console.log('✅ alert_rules 表创建成功\n');
        
        // 创建 alert_logs 表
        console.log('4. 创建 alert_logs 表...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS alert_logs (
              id BIGINT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              alert_type VARCHAR(50) NOT NULL COMMENT '告警类型',
              node_id INT COMMENT '节点ID',
              message TEXT COMMENT '告警消息',
              details TEXT COMMENT '详细信息',
              notified BOOLEAN DEFAULT FALSE COMMENT '是否已通知',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_user_id (user_id),
              INDEX idx_created_at (created_at),
              INDEX idx_node_id (node_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警日志表'
        `);
        console.log('✅ alert_logs 表创建成功\n');
        
        // 验证表
        console.log('5. 验证表结构...');
        const tables = ['request_stats', 'alert_rules', 'alert_logs'];
        
        for (const table of tables) {
            const [rows] = await pool.query(`SHOW TABLES LIKE '${table}'`);
            if (rows.length > 0) {
                console.log(`  ✅ ${table} 表存在`);
            } else {
                console.log(`  ❌ ${table} 表不存在`);
            }
        }
        
        console.log('\n========================================');
        console.log('迁移完成！');
        console.log('========================================\n');
        
        console.log('📊 新增表说明:');
        console.log('  1. request_stats - 请求统计表');
        console.log('     记录每小时的请求统计数据');
        console.log('     用于生成图表和报表\n');
        
        console.log('  2. alert_rules - 告警规则表');
        console.log('     配置各种告警规则');
        console.log('     支持邮件和Webhook通知\n');
        
        console.log('  3. alert_logs - 告警日志表');
        console.log('     记录所有触发的告警');
        console.log('     用于告警历史查询\n');
        
        console.log('🎯 用途:');
        console.log('  - 节点性能监控');
        console.log('  - 请求统计分析');
        console.log('  - 告警通知');
        console.log('  - 报表导出\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    }
}

// 运行迁移
migrate();
