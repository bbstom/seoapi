/**
 * 测试阶段2的显示效果
 * 
 * 这个脚本会模拟不同的健康状态，让你看到所有的显示效果
 */

const { pool } = require('../lib/database');

async function testPhase2Display() {
    console.log('='.repeat(60));
    console.log('阶段2显示效果测试');
    console.log('='.repeat(60));
    console.log();
    
    try {
        // 获取所有节点
        const [nodes] = await pool.query('SELECT id, name FROM api_configs LIMIT 5');
        
        if (nodes.length === 0) {
            console.log('❌ 没有找到节点，请先添加节点');
            return;
        }
        
        console.log(`找到 ${nodes.length} 个节点，开始模拟不同的健康状态...\n`);
        
        // 模拟不同的健康状态
        const scenarios = [
            {
                name: '健康节点',
                status: 'healthy',
                connectivity: true,
                latency: 245,
                authentication: 'valid',
                quota_status: 'sufficient',
                quota_percentage: 85.5,
                error_message: null
            },
            {
                name: '警告节点（额度不足）',
                status: 'warning',
                connectivity: true,
                latency: 892,
                authentication: 'valid',
                quota_status: 'low',
                quota_percentage: 15.2,
                error_message: null
            },
            {
                name: '异常节点（认证失败）',
                status: 'error',
                connectivity: true,
                latency: 156,
                authentication: 'invalid',
                auth_error_code: 401,
                quota_status: 'unknown',
                quota_percentage: null,
                error_message: 'API Key 无效或已过期'
            },
            {
                name: '异常节点（额度耗尽）',
                status: 'error',
                connectivity: true,
                latency: 234,
                authentication: 'valid',
                quota_status: 'exhausted',
                quota_percentage: 0,
                error_message: '额度已耗尽'
            },
            {
                name: '离线节点',
                status: 'offline',
                connectivity: false,
                latency: 0,
                authentication: 'unknown',
                quota_status: 'unknown',
                quota_percentage: null,
                error_message: '连接超时'
            }
        ];
        
        // 为每个节点设置不同的状态
        for (let i = 0; i < Math.min(nodes.length, scenarios.length); i++) {
            const node = nodes[i];
            const scenario = scenarios[i];
            
            console.log(`${i + 1}. 设置节点 "${node.name}" 为 "${scenario.name}"...`);
            
            // 更新节点状态
            await pool.query(
                `UPDATE api_configs 
                 SET health_status = ?, 
                     avg_latency = ?,
                     last_check_at = NOW()
                 WHERE id = ?`,
                [scenario.status, scenario.latency, node.id]
            );
            
            // 插入健康日志
            await pool.query(
                `INSERT INTO node_health_logs 
                 (node_id, status, connectivity, latency, authentication, auth_error_code,
                  quota_status, quota_percentage, error_message, response_code, response_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    node.id,
                    scenario.status,
                    scenario.connectivity,
                    scenario.latency,
                    scenario.authentication,
                    scenario.auth_error_code || null,
                    scenario.quota_status,
                    scenario.quota_percentage,
                    scenario.error_message,
                    scenario.auth_error_code || (scenario.connectivity ? 200 : null),
                    scenario.latency
                ]
            );
            
            console.log(`   ✓ 状态: ${scenario.status}`);
            console.log(`   ✓ 延迟: ${scenario.latency}ms`);
            console.log(`   ✓ 认证: ${scenario.authentication}`);
            console.log(`   ✓ 额度: ${scenario.quota_status}${scenario.quota_percentage ? ` (${scenario.quota_percentage}%)` : ''}`);
            if (scenario.error_message) {
                console.log(`   ✓ 错误: ${scenario.error_message}`);
            }
            console.log();
        }
        
        console.log('='.repeat(60));
        console.log('✅ 测试数据设置完成！');
        console.log('='.repeat(60));
        console.log();
        console.log('现在打开浏览器查看效果：');
        console.log();
        console.log('1. 进入 AI 节点管理页面');
        console.log('2. 点击"刷新状态"按钮');
        console.log('3. 观察不同节点的显示效果：');
        console.log();
        console.log('   🟢 健康节点：');
        console.log('      - 绿色圆点（带脉冲）');
        console.log('      - 延迟: 245ms');
        console.log('      - ✓ 认证');
        console.log('      - 额度 85.5%');
        console.log();
        console.log('   🟡 警告节点：');
        console.log('      - 黄色圆点');
        console.log('      - 延迟: 892ms');
        console.log('      - ⚠ 额度 15.2%');
        console.log();
        console.log('   🟠 异常节点（认证失败）：');
        console.log('      - 橙色圆点');
        console.log('      - 延迟: 156ms');
        console.log('      - ✗ 认证失败');
        console.log('      - API Key 无效或已过期');
        console.log();
        console.log('   🟠 异常节点（额度耗尽）：');
        console.log('      - 橙色圆点');
        console.log('      - 延迟: 234ms');
        console.log('      - ✗ 额度耗尽');
        console.log();
        console.log('   🔴 离线节点：');
        console.log('      - 红色圆点');
        console.log('      - 延迟: -');
        console.log('      - 连接超时');
        console.log();
        console.log('4. 鼠标悬停在圆点上查看详细信息');
        console.log('5. 查看"延迟"列的详细显示');
        console.log();
        console.log('提示：');
        console.log('- 悬停提示会显示完整的健康信息');
        console.log('- 延迟列会显示认证状态、额度状态和错误信息');
        console.log('- 不同状态用不同颜色区分');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await pool.end();
    }
}

// 运行测试
testPhase2Display().catch(console.error);
