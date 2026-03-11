/**
 * 测试 API 健康检查功能
 */

const { pool } = require('../lib/database');
const configManager = require('../lib/configManager');
const apiConfigManager = require('../lib/apiConfigManager');

async function testHealthCheck() {
    console.log('=== 测试 API 健康检查 ===\n');
    
    try {
        // 1. 获取所有 API 配置
        console.log('1. 获取所有 API 配置...');
        const [configs] = await pool.query(
            'SELECT id, user_id, name, base_url, api_key, api_type, is_active FROM api_configs'
        );
        
        console.log(`找到 ${configs.length} 个配置:\n`);
        
        for (const config of configs) {
            console.log(`配置: ${config.name} (ID: ${config.id})`);
            console.log(`  Base URL: ${config.base_url}`);
            console.log(`  API Type: ${config.api_type}`);
            console.log(`  Is Active: ${config.is_active}`);
            
            // 2. 解密 API Key
            const decryptedKey = apiConfigManager.decryptApiKey(config.api_key);
            console.log(`  API Key (前10字符): ${decryptedKey.substring(0, 10)}...`);
            
            // 3. 测试健康检查
            if (config.is_active) {
                console.log(`  正在检查健康状态...`);
                const startTime = Date.now();
                
                try {
                    const result = await configManager.quickHealthCheck(
                        config.base_url,
                        decryptedKey,
                        config.api_type
                    );
                    
                    const duration = Date.now() - startTime;
                    
                    if (result.success) {
                        console.log(`  ✅ 在线 (延迟: ${result.latency}ms, 总耗时: ${duration}ms)`);
                    } else {
                        console.log(`  ❌ 离线 (延迟: ${result.latency}ms, 总耗时: ${duration}ms)`);
                    }
                } catch (error) {
                    console.log(`  ❌ 检查失败: ${error.message}`);
                }
            } else {
                console.log(`  ⚪ 已禁用，跳过检查`);
            }
            
            console.log('');
        }
        
        // 4. 测试完整的 URL 构建
        console.log('4. 测试 URL 构建逻辑...\n');
        
        const testUrls = [
            'https://api.openai.com',
            'https://api.openai.com/',
            'https://api.openai.com/v1',
            'https://api.openai.com/v1/',
            'https://api123.icu',
            'https://api123.icu/v1'
        ];
        
        for (const testUrl of testUrls) {
            let finalUrl = testUrl;
            if (!finalUrl.endsWith('/v1') && !finalUrl.includes('/v1/')) {
                finalUrl = finalUrl.replace(/\/$/, '') + '/v1';
            }
            finalUrl += '/models';
            
            console.log(`原始: ${testUrl}`);
            console.log(`最终: ${finalUrl}\n`);
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('错误详情:', error);
    } finally {
        await pool.end();
    }
}

testHealthCheck();
