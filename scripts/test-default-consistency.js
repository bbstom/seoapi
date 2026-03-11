/**
 * 测试默认配置一致性
 * 验证"默认调用配置"和"外部 API 配置"的默认标记是否一致
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000';

async function testDefaultConsistency() {
    console.log('=== 测试默认配置一致性 ===\n');
    
    try {
        // 1. 登录获取 token
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
        console.log(`✅ 找到 ${configs.length} 个配置:`);
        configs.forEach(c => {
            console.log(`   - ID: ${c.id}, 名称: ${c.name}, is_default: ${c.is_default}`);
        });
        console.log('');
        
        // 3. 获取用户信息（包含 defaultConfigId）
        console.log('3. 获取用户信息...');
        const meResponse = await axios.get(`${API_BASE}/api/auth/me`, {
            headers: { 'x-session-token': token }
        });
        
        if (!meResponse.data.success) {
            console.error('❌ 获取用户信息失败');
            return;
        }
        
        const user = meResponse.data.user;
        console.log(`✅ 用户默认配置 ID: ${user.defaultConfigId}`);
        console.log('');
        
        // 4. 检查一致性
        console.log('4. 检查一致性...');
        const defaultConfig = configs.find(c => c.is_default === true);
        
        if (!user.defaultConfigId && !defaultConfig) {
            console.log('✅ 一致：都没有设置默认配置');
        } else if (user.defaultConfigId && defaultConfig && user.defaultConfigId === defaultConfig.id) {
            console.log(`✅ 一致：默认配置都是 ID ${user.defaultConfigId} (${defaultConfig.name})`);
        } else {
            console.log('❌ 不一致！');
            console.log(`   用户的 defaultConfigId: ${user.defaultConfigId}`);
            console.log(`   API 配置中 is_default=true 的: ${defaultConfig ? `ID ${defaultConfig.id} (${defaultConfig.name})` : '无'}`);
        }
        console.log('');
        
        // 5. 测试保存默认配置
        if (configs.length > 0) {
            const testConfigId = configs[0].id;
            console.log(`5. 测试保存默认配置 (选择 ID ${testConfigId})...`);
            
            // 保存默认配置
            const saveResponse = await axios.post(`${API_BASE}/api/users/defaults`, {
                defaultApiConfig: String(testConfigId),
                defaultModel: 'test-model',
                defaultMode: 'test-mode'
            }, {
                headers: { 'x-session-token': token }
            });
            
            if (!saveResponse.data.success) {
                console.error('❌ 保存失败:', saveResponse.data.error);
                return;
            }
            console.log('✅ 保存成功');
            
            // 设置为默认
            const setDefaultResponse = await axios.post(`${API_BASE}/api/api-configs/${testConfigId}/set-default`, {}, {
                headers: { 'x-session-token': token }
            });
            
            if (!setDefaultResponse.data.success) {
                console.error('❌ 设置默认失败:', setDefaultResponse.data.error);
                return;
            }
            console.log('✅ 设置默认成功');
            console.log('');
            
            // 6. 重新检查一致性
            console.log('6. 重新检查一致性...');
            
            // 重新获取配置
            const newConfigsResponse = await axios.get(`${API_BASE}/api/api-configs`, {
                headers: { 'x-session-token': token }
            });
            const newConfigs = newConfigsResponse.data.configs;
            
            // 重新获取用户信息
            const newMeResponse = await axios.get(`${API_BASE}/api/auth/me`, {
                headers: { 'x-session-token': token }
            });
            const newUser = newMeResponse.data.user;
            
            console.log('配置列表:');
            newConfigs.forEach(c => {
                console.log(`   - ID: ${c.id}, 名称: ${c.name}, is_default: ${c.is_default}`);
            });
            console.log(`用户 defaultConfigId: ${newUser.defaultConfigId}`);
            
            const newDefaultConfig = newConfigs.find(c => c.is_default === true);
            
            if (newUser.defaultConfigId === testConfigId && newDefaultConfig && newDefaultConfig.id === testConfigId) {
                console.log(`✅ 一致：默认配置都是 ID ${testConfigId}`);
            } else {
                console.log('❌ 不一致！');
                console.log(`   用户的 defaultConfigId: ${newUser.defaultConfigId}`);
                console.log(`   API 配置中 is_default=true 的: ${newDefaultConfig ? `ID ${newDefaultConfig.id}` : '无'}`);
            }
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

testDefaultConsistency();
