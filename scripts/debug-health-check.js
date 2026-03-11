/**
 * 调试健康检查问题
 */

const { pool } = require('../lib/database');
const apiConfigManager = require('../lib/apiConfigManager');
const configManager = require('../lib/configManager');

async function debugHealthCheck() {
    console.log('=== 调试健康检查 ===\n');
    
    try {
        // 1. 获取配置
        console.log('1. 获取配置...');
        const [configs] = await pool.query(
            'SELECT id, user_id, name, base_url, api_key, api_type, is_active FROM api_configs WHERE id = 1'
        );
        
        if (configs.length === 0) {
            console.log('❌ 配置不存在');
            return;
        }
        
        const dbConfig = configs[0];
        console.log('数据库配置:', {
            id: dbConfig.id,
            name: dbConfig.name,
            base_url: dbConfig.base_url,
            api_type: dbConfig.api_type,
            is_active: dbConfig.is_active,
            api_key_length: dbConfig.api_key.length
        });
        console.log('');
        
        // 2. 通过 apiConfigManager 获取配置
        console.log('2. 通过 apiConfigManager.getApiConfig 获取...');
        const apiConfig = await apiConfigManager.getApiConfig(dbConfig.user_id, dbConfig.id);
        
        if (!apiConfig) {
            console.log('❌ apiConfigManager.getApiConfig 返回 null');
            return;
        }
        
        console.log('apiConfigManager 返回的配置:', {
            id: apiConfig.id,
            name: apiConfig.name,
            apiUrl: apiConfig.apiUrl,
            apiKey: apiConfig.apiKey ? `${apiConfig.apiKey.substring(0, 10)}...` : 'undefined',
            apiType: apiConfig.apiType,
            字段类型: {
                apiUrl: typeof apiConfig.apiUrl,
                apiKey: typeof apiConfig.apiKey,
                apiType: typeof apiConfig.apiType,
                base_url: typeof apiConfig.base_url,
                api_key: typeof apiConfig.api_key,
                api_type: typeof apiConfig.api_type
            }
        });
        console.log('');
        
        // 3. 测试健康检查（使用正确的字段）
        console.log('3. 测试健康检查（使用 base_url, api_key, api_type）...');
        
        if (!apiConfig.base_url) {
            console.log('❌ apiConfig.base_url 是 undefined');
            return;
        }
        
        if (!apiConfig.api_key) {
            console.log('❌ apiConfig.api_key 是 undefined');
            return;
        }
        
        const result = await configManager.quickHealthCheck(
            apiConfig.base_url,
            apiConfig.api_key,
            apiConfig.api_type
        );
        
        console.log('健康检查结果:', result);
        
        if (result.success) {
            console.log('✅ API 在线');
        } else {
            console.log('❌ API 离线');
        }
        
    } catch (error) {
        console.error('❌ 调试失败:', error.message);
        console.error('错误堆栈:', error.stack);
    } finally {
        await pool.end();
    }
}

debugHealthCheck();
