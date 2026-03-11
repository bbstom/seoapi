/**
 * 测试健康检查接口返回的数据
 */

const axios = require('axios');

async function testHealthCheckResponse() {
    console.log('测试健康检查接口返回数据...\n');
    
    try {
        // 需要先登录获取 session
        console.log('1. 登录获取 session...');
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        if (!loginResponse.data.success) {
            console.log('❌ 登录失败');
            return;
        }
        
        const sessionId = loginResponse.data.sessionId;
        console.log('✓ 登录成功，session:', sessionId.substring(0, 20) + '...\n');
        
        // 获取配置列表
        console.log('2. 获取配置列表...');
        const configsResponse = await axios.get('http://localhost:3000/api/api-configs', {
            headers: {
                'Cookie': `sessionId=${sessionId}`
            }
        });
        
        if (!configsResponse.data.success || configsResponse.data.configs.length === 0) {
            console.log('❌ 没有找到配置');
            return;
        }
        
        const config = configsResponse.data.configs[0];
        console.log(`✓ 找到配置: ${config.name} (ID: ${config.id})\n`);
        
        // 执行健康检查
        console.log('3. 执行健康检查...');
        const healthResponse = await axios.post('http://localhost:3000/api/api-configs/health-check', {
            config_id: config.id
        }, {
            headers: {
                'Cookie': `sessionId=${sessionId}`
            }
        });
        
        console.log('✓ 健康检查完成\n');
        console.log('返回数据：');
        console.log(JSON.stringify(healthResponse.data, null, 2));
        
        console.log('\n字段检查：');
        console.log('- success:', healthResponse.data.success ? '✓' : '✗');
        console.log('- online:', healthResponse.data.online !== undefined ? '✓' : '✗');
        console.log('- status:', healthResponse.data.status ? '✓' : '✗');
        console.log('- latency:', healthResponse.data.latency !== undefined ? '✓' : '✗');
        console.log('- authentication:', healthResponse.data.authentication ? '✓' : '✗');
        console.log('- quota_status:', healthResponse.data.quota_status ? '✓' : '✗');
        console.log('- quota_percentage:', healthResponse.data.quota_percentage !== undefined ? '✓' : '✗');
        console.log('- error_message:', healthResponse.data.error_message !== undefined ? '✓' : '✗');
        
        if (!healthResponse.data.quota_status || healthResponse.data.quota_status === 'unknown') {
            console.log('\n⚠️  注意：额度状态为 unknown');
            console.log('这是正常的，因为大多数 API 不在响应头中返回额度信息');
            console.log('只有支持 x-ratelimit-* 响应头的 API 才会显示额度');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

testHealthCheckResponse();
