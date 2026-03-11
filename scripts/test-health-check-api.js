/**
 * 测试健康检查 API 接口
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testHealthCheckAPI() {
    console.log('=== 测试健康检查 API 接口 ===\n');
    
    try {
        // 1. 登录
        console.log('1. 登录...');
        const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
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
        
        // 3. 测试每个配置的健康检查
        for (const config of configs) {
            console.log(`测试配置: ${config.name} (ID: ${config.id})`);
            console.log(`  Base URL: ${config.base_url}`);
            console.log(`  Is Active: ${config.is_active}`);
            
            const startTime = Date.now();
            
            try {
                const healthResponse = await axios.post(`${API_BASE}/api/api-configs/health-check`, {
                    config_id: config.id
                }, {
                    headers: { 'x-session-token': token },
                    timeout: 10000
                });
                
                const duration = Date.now() - startTime;
                
                console.log(`  响应数据:`, JSON.stringify(healthResponse.data, null, 2));
                
                if (healthResponse.data.success) {
                    if (healthResponse.data.online) {
                        console.log(`  ✅ 在线 (延迟: ${healthResponse.data.latency}ms, 总耗时: ${duration}ms)`);
                    } else {
                        console.log(`  ❌ 离线 (${healthResponse.data.message})`);
                    }
                } else {
                    console.log(`  ❌ 检查失败: ${healthResponse.data.error}`);
                }
            } catch (error) {
                const duration = Date.now() - startTime;
                console.log(`  ❌ 请求失败 (耗时: ${duration}ms)`);
                console.log(`  错误: ${error.message}`);
                if (error.response) {
                    console.log(`  响应数据:`, error.response.data);
                }
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

testHealthCheckAPI();
