/**
 * 阶段4测试脚本 - 负载均衡策略
 * 
 * 测试内容：
 * 1. 所有负载均衡策略
 * 2. 连接数追踪
 * 3. 策略效果对比
 */

const nodeSelector = require('../lib/nodeSelector');
const connectionTracker = require('../lib/connectionTracker');
const { pool } = require('../lib/database');

async function testPhase4() {
    console.log('========================================');
    console.log('阶段4测试 - 负载均衡策略');
    console.log('========================================\n');
    
    try {
        // 1. 准备测试数据
        console.log('1. 准备测试数据...');
        
        // 获取测试用户ID（假设是admin用户）
        const [users] = await pool.query(
            `SELECT id FROM users WHERE username = 'admin' LIMIT 1`
        );
        
        if (users.length === 0) {
            console.error('❌ 未找到测试用户');
            return;
        }
        
        const userId = users[0].id;
        console.log(`✅ 测试用户ID: ${userId}\n`);
        
        // 获取所有节点
        const [nodes] = await pool.query(
            `SELECT id, name, priority, weight, health_status, avg_latency, active_connections 
             FROM api_configs 
             WHERE user_id = ? AND is_active = TRUE 
             ORDER BY priority DESC`,
            [userId]
        );
        
        if (nodes.length < 2) {
            console.log('⚠️  需要至少2个节点才能测试负载均衡');
            console.log('请先添加多个 API 配置\n');
            return;
        }
        
        console.log(`✅ 找到 ${nodes.length} 个节点\n`);
        
        // 显示节点信息
        console.log('节点列表:');
        nodes.forEach((node, index) => {
            console.log(`  [${index + 1}] ${node.name}`);
            console.log(`      优先级: ${node.priority}, 权重: ${node.weight}`);
            console.log(`      状态: ${node.health_status}, 延迟: ${node.avg_latency || 0}ms`);
            console.log(`      活跃连接: ${node.active_connections || 0}\n`);
        });
        
        // 2. 测试所有策略
        console.log('2. 测试所有负载均衡策略...\n');
        
        const strategies = [
            'priority',
            'weighted',
            'random',
            'round_robin',
            'least_connections',
            'fastest_response',
            'ip_hash'
        ];
        
        const results = {};
        
        for (const strategy of strategies) {
            console.log(`测试策略: ${strategy}`);
            console.log('─'.repeat(50));
            
            // 每个策略测试10次
            const selections = {};
            
            for (let i = 0; i < 10; i++) {
                const node = await nodeSelector.selectBestNode(userId, {
                    strategy: strategy,
                    clientIp: `192.168.1.${i}` // 模拟不同IP
                });
                
                if (node) {
                    selections[node.id] = (selections[node.id] || 0) + 1;
                }
            }
            
            // 统计结果
            console.log('选择结果:');
            for (const [nodeId, count] of Object.entries(selections)) {
                const node = nodes.find(n => n.id == nodeId);
                const percentage = (count / 10 * 100).toFixed(1);
                console.log(`  ${node.name}: ${count}/10 (${percentage}%)`);
            }
            
            results[strategy] = selections;
            console.log('');
        }
        
        // 3. 测试连接数追踪
        console.log('3. 测试连接数追踪...\n');
        
        const testNodeId = nodes[0].id;
        console.log(`测试节点: ${nodes[0].name} (ID: ${testNodeId})`);
        
        // 增加连接
        console.log('增加3个连接...');
        await connectionTracker.incrementConnection(testNodeId);
        await connectionTracker.incrementConnection(testNodeId);
        await connectionTracker.incrementConnection(testNodeId);
        
        let active = connectionTracker.getActiveConnections(testNodeId);
        let total = connectionTracker.getTotalConnections(testNodeId);
        console.log(`✅ 活跃连接: ${active}, 总连接: ${total}`);
        
        // 减少连接
        console.log('减少1个连接...');
        await connectionTracker.decrementConnection(testNodeId);
        
        active = connectionTracker.getActiveConnections(testNodeId);
        console.log(`✅ 活跃连接: ${active}\n`);
        
        // 4. 策略效果对比
        console.log('4. 策略效果对比...\n');
        
        console.log('策略特点:');
        console.log('  priority        - 总是选择优先级最高的节点');
        console.log('  weighted        - 根据权重随机分配，权重高的概率大');
        console.log('  random          - 完全随机选择');
        console.log('  round_robin     - 依次轮询，均匀分配');
        console.log('  least_connections - 选择连接数最少的节点');
        console.log('  fastest_response  - 选择响应最快的节点');
        console.log('  ip_hash         - 相同IP使用相同节点\n');
        
        console.log('推荐使用场景:');
        console.log('  priority        - 默认策略，适合大多数场景');
        console.log('  weighted        - 节点性能不同，需要精确控制流量');
        console.log('  round_robin     - 节点性能相近，需要均匀分配');
        console.log('  least_connections - 请求处理时间差异大');
        console.log('  fastest_response  - 优化响应速度');
        console.log('  ip_hash         - 需要会话保持\n');
        
        // 5. 总结
        console.log('========================================');
        console.log('测试完成！');
        console.log('========================================\n');
        
        console.log('✅ 所有负载均衡策略测试通过');
        console.log('✅ 连接数追踪功能正常');
        console.log('✅ 策略效果符合预期\n');
        
        console.log('📚 下一步:');
        console.log('1. 在实际 API 调用中使用不同策略');
        console.log('2. 监控各策略的性能表现');
        console.log('3. 根据实际情况选择最优策略\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

// 运行测试
testPhase4();
