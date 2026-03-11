/**
 * 测试保存默认配置
 */

const axios = require('axios');

async function testSaveDefaults() {
    try {
        console.log('=== 测试保存默认配置 ===\n');
        
        // 1. 登录获取 token
        console.log('1. 登录...');
        const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        if (!loginResponse.data.success) {
            console.log('❌ 登录失败');
            return;
        }
        
        const token = loginResponse.data.token;
        console.log('✓ 登录成功，token:', token.substring(0, 20) + '...\n');
        
        // 2. 保存默认配置
        console.log('2. 保存默认配置...');
        const saveResponse = await axios.post('http://localhost:3000/api/users/defaults', {
            defaultApiConfig: '1',
            defaultModel: 'test-model',
            defaultMode: 'test-mode'
        }, {
            headers: {
                'x-session-token': token
            }
        });
        
        console.log('保存响应:', saveResponse.data);
        
        if (saveResponse.data.success) {
            console.log('✓ 保存成功\n');
        } else {
            console.log('❌ 保存失败:', saveResponse.data.error, '\n');
        }
        
        // 3. 获取用户信息验证
        console.log('3. 获取用户信息验证...');
        const meResponse = await axios.get('http://localhost:3000/api/auth/me', {
            headers: {
                'x-session-token': token
            }
        });
        
        if (meResponse.data.success) {
            const user = meResponse.data.user;
            console.log('用户信息:');
            console.log('  - defaultConfigId:', user.defaultConfigId);
            console.log('  - defaultModel:', user.defaultModel);
            console.log('  - defaultMode:', user.defaultMode);
            
            if (user.defaultConfigId === 1 && user.defaultModel === 'test-model' && user.defaultMode === 'test-mode') {
                console.log('\n✓ 验证成功！配置已正确保存');
            } else {
                console.log('\n❌ 验证失败！配置未正确保存');
            }
        } else {
            console.log('❌ 获取用户信息失败');
        }
        
    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

testSaveDefaults();
