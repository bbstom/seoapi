/**
 * 测试阶段1新功能
 * 
 * 测试内容：
 * 1. 数据库新字段是否存在
 * 2. 健康检查是否保存结果
 * 3. 权重字段是否正常工作
 */

const { pool } = require('../lib/database');
const apiConfigManager = require('../lib/apiConfigManager');

async function testPhase1Features() {
    console.log('='.repeat(60));
    console.log('阶段1功能测试');
    console.log('='.repeat(60));
    console.log();
    
    try {
        // 测试1：检查数据库字段
        console.log('测试1：检查数据库新字段...');
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'api_configs'
            AND COLUMN_NAME IN ('weight', 'health_status', 'last_check_at', 'avg_latency')
            ORDER BY COLUMN_NAME
        `);
        
        if (columns.length === 4) {
            console.log('✅ 所有新字段都存在：');
            columns.forEach(col => {
                console.log(`   - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.COLUMN_COMMENT})`);
            });
        } else {
            console.log('❌ 缺少字段，找到 ' + columns.length + ' 个，应该是 4 个');
            return;
        }
        console.log();
        
        // 测试2：检查是否有配置数据
        console.log('测试2：检查现有配置...');
        const [configs] = await pool.query(`
            SELECT id, name, weight, health_status, last_check_at, avg_latency
            FROM api_configs
            LIMIT 5
        `);
        
        if (configs.length > 0) {
            console.log(`✅ 找到 ${configs.length} 个配置：`);
            configs.forEach(config => {
                console.log(`   - ID ${config.id}: ${config.name}`);
                console.log(`     权重: ${config.weight || 1}`);
                console.log(`     健康状态: ${config.health_status || 'unknown'}`);
                console.log(`     最后检查: ${config.last_check_at || '未检查'}`);
                console.log(`     平均延迟: ${config.avg_latency || 0}ms`);
            });
        } else {
            console.log('⚠️  没有找到配置数据');
        }
        console.log();
        
        // 测试3：测试 updateHealthStatus 方法
        if (configs.length > 0) {
            console.log('测试3：测试健康状态更新...');
            const testConfig = configs[0];
            
            // 模拟更新健康状态
            const updated = await apiConfigManager.updateHealthStatus(
                testConfig.id,
                testConfig.id,
                'healthy',
                123
            );
            
            if (updated) {
                console.log('✅ 健康状态更新成功');
                
                // 验证更新
                const [result] = await pool.query(`
                    SELECT health_status, last_check_at, avg_latency
                    FROM api_configs
                    WHERE id = ?
                `, [testConfig.id]);
                
                if (result.length > 0) {
                    console.log('   验证结果：');
                    console.log(`   - 健康状态: ${result[0].health_status}`);
                    console.log(`   - 最后检查: ${result[0].last_check_at}`);
                    console.log(`   - 平均延迟: ${result[0].avg_latency}ms`);
                }
            } else {
                console.log('❌ 健康状态更新失败');
            }
        }
        console.log();
        
        // 测试4：检查索引
        console.log('测试4：检查数据库索引...');
        const [indexes] = await pool.query(`
            SHOW INDEX FROM api_configs
            WHERE Key_name = 'idx_health_status'
        `);
        
        if (indexes.length > 0) {
            console.log('✅ health_status 索引存在');
        } else {
            console.log('⚠️  health_status 索引不存在');
        }
        console.log();
        
        console.log('='.repeat(60));
        console.log('测试完成！');
        console.log('='.repeat(60));
        console.log();
        console.log('下一步：');
        console.log('1. 重启服务器：pm2 restart seoapi 或 node server.js');
        console.log('2. 打开浏览器访问系统配置页面');
        console.log('3. 查看新的 AI 节点管理界面');
        console.log('4. 点击"刷新状态"按钮测试健康检查');
        console.log('5. 添加或编辑节点，测试权重配置');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await pool.end();
    }
}

// 运行测试
testPhase1Features().catch(console.error);
