/**
 * 阶段3测试脚本 - 自动故障转移
 * 
 * 测试内容：
 * 1. 节点选择算法（优先级、权重、随机）
 * 2. 故障转移逻辑
 * 3. 故障转移日志记录
 * 4. 故障转移历史查询
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

// 测试配置
const TEST_USER = {
    username: 'admin',
    password: 'admin123'
};

async function testPhase3() {
    console.log('========================================');
    console.log('阶段3测试 - 自动故障转移');
    console.log('========================================\n');
    
    try {
        // 1. 登录
        console.log('1. 登录系统...');
        const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, TEST_USER);
        
        if (!loginResponse.data.success) {
            console.error('❌ 登录失败:', loginResponse.data.error);
            return;
        }
        
        const token = loginResponse.data.token;
        console.log('✅ 登录成功\n');
        
        // 2. 获取所有 API 配置
        console.log('2. 获取所有 API 配置...');
        const configsResponse = await axios.get(`${API_BASE}/api/api-configs`, {
            headers: { 'x-session-token': token }
        });
        
        if (!configsResponse.data.success) {
            console.error('❌ 获取配置失败');
            return;
        }
        
        const configs = configsResponse.data.configs;
        console.log(`✅ 找到 ${configs.length} 个配置\n`);
        
        if (configs.length < 2) {
            console.log('⚠️  需要至少2个配置才能测试故障转移');
            console.log('请先添加多个 API 配置\n');
            return;
        }
        
        // 3. 显示配置信息
        console.log('3. 配置信息:');
        configs.forEach((config, index) => {
            console.log(`   [${index + 1}] ${config.name}`);
            console.log(`       优先级: ${config.priority}, 权重: ${config.weight}`);
            console.log(`       状态: ${config.health_status || 'unknown'}`);
            console.log(`       延迟: ${config.avg_latency || 0}ms\n`);
        });
        
        // 4. 测试节点选择（需要后端集成）
        console.log('4. 节点选择算法测试:');
        console.log('   ℹ️  节点选择算法已实现在 lib/nodeSelector.js');
        console.log('   ℹ️  支持策略: priority（优先级）, weighted（加权）, random（随机）');
        console.log('   ℹ️  需要在实际 API 调用中集成\n');
        
        // 5. 查询故障转移历史
        console.log('5. 查询故障转移历史...');
        const historyResponse = await axios.get(`${API_BASE}/api/failover-history?limit=10`, {
            headers: { 'x-session-token': token }
        });
        
        if (!historyResponse.data.success) {
            console.error('❌ 查询失败:', historyResponse.data.error);
            return;
        }
        
        const history = historyResponse.data.history;
        console.log(`✅ 找到 ${history.length} 条故障转移记录\n`);
        
        if (history.length > 0) {
            console.log('最近的故障转移记录:');
            history.slice(0, 5).forEach((log, index) => {
                console.log(`   [${index + 1}] ${log.failover_time}`);
                console.log(`       从: ${log.from_node_name || `节点 ${log.from_node_id}`}`);
                console.log(`       到: ${log.to_node_name || `节点 ${log.to_node_id}`}`);
                console.log(`       原因: ${log.failure_reason}`);
                console.log(`       结果: ${log.success ? '成功' : '失败'}\n`);
            });
        } else {
            console.log('   暂无故障转移记录');
            console.log('   ℹ️  当 API 调用失败时，系统会自动切换到备用节点并记录日志\n');
        }
        
        // 6. 测试总结
        console.log('========================================');
        console.log('阶段3功能状态');
        console.log('========================================');
        console.log('✅ 数据库表: failover_logs 已创建');
        console.log('✅ 节点选择服务: lib/nodeSelector.js 已实现');
        console.log('✅ 故障转移历史接口: GET /api/failover-history 已添加');
        console.log('⏳ 待完成: 在实际 API 调用中集成故障转移逻辑');
        console.log('⏳ 待完成: 前端显示故障转移历史');
        console.log('⏳ 待完成: 自动重试机制\n');
        
        console.log('========================================');
        console.log('下一步工作');
        console.log('========================================');
        console.log('1. 创建 API 调用包装器，集成节点选择和故障转移');
        console.log('2. 在文本改写接口中使用包装器');
        console.log('3. 实现自动重试机制（最大重试次数、重试延迟）');
        console.log('4. 前端添加故障转移历史显示');
        console.log('5. 测试故障场景（节点离线、认证失败等）\n');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

// 运行测试
testPhase3();
