/**
 * 阶段4数据库迁移 - 添加连接数字段
 * 
 * 为 api_configs 表添加连接数追踪字段
 */

const { pool, testConnection } = require('../lib/database');

async function migrate() {
    console.log('========================================');
    console.log('阶段4数据库迁移 - 添加连接数字段');
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
        
        // 检查字段是否已存在
        console.log('2. 检查字段是否已存在...');
        const [columns] = await pool.query(
            `SHOW COLUMNS FROM api_configs LIKE 'active_connections'`
        );
        
        if (columns.length > 0) {
            console.log('✅ 字段已存在，跳过迁移\n');
            process.exit(0);
        }
        
        console.log('✅ 字段不存在，开始迁移\n');
        
        // 添加 active_connections 字段
        console.log('3. 添加 active_connections 字段...');
        await pool.query(`
            ALTER TABLE api_configs 
            ADD COLUMN active_connections INT DEFAULT 0 COMMENT '活跃连接数'
        `);
        console.log('✅ active_connections 字段添加成功\n');
        
        // 添加 total_connections 字段
        console.log('4. 添加 total_connections 字段...');
        await pool.query(`
            ALTER TABLE api_configs 
            ADD COLUMN total_connections BIGINT DEFAULT 0 COMMENT '总连接数'
        `);
        console.log('✅ total_connections 字段添加成功\n');
        
        // 验证字段
        console.log('5. 验证字段...');
        const [newColumns] = await pool.query(
            `SHOW COLUMNS FROM api_configs WHERE Field IN ('active_connections', 'total_connections')`
        );
        
        console.log('✅ 字段验证成功\n');
        console.log('新增字段:');
        newColumns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} (${col.Comment || '无注释'})`);
        });
        
        console.log('\n========================================');
        console.log('迁移完成！');
        console.log('========================================\n');
        
        console.log('📊 新增字段说明:');
        console.log('  - active_connections: 当前活跃的连接数');
        console.log('  - total_connections: 历史总连接数\n');
        
        console.log('🎯 用途:');
        console.log('  - 用于最少连接负载均衡策略');
        console.log('  - 实时追踪节点负载');
        console.log('  - 性能监控和分析\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        process.exit(1);
    }
}

// 运行迁移
migrate();
