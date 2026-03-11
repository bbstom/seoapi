/**
 * 测试配置加载
 */

const configManager = require('../lib/configManager');

async function testConfigLoading() {
    try {
        console.log('========================================');
        console.log('测试配置加载');
        console.log('========================================\n');
        
        const username = 'admin';
        
        // 1. 测试获取所有配置
        console.log('1. 获取所有配置:');
        const allConfigs = await configManager.getUserConfigs(username);
        console.log(`   找到 ${allConfigs.length} 个配置\n`);
        
        allConfigs.forEach((config, index) => {
            console.log(`   配置 ${index + 1}:`);
            console.log(`     - ID: ${config.id}`);
            console.log(`     - 名称: ${config.name}`);
            console.log(`     - URL: ${config.apiUrl}`);
            console.log(`     - 类型: ${config.apiType}`);
            console.log(`     - 是否默认: ${config.isDefault}`);
            console.log('');
        });
        
        // 2. 测试获取默认配置
        console.log('2. 获取默认配置:');
        const defaultConfig = await configManager.getDefaultConfig(username);
        
        if (defaultConfig) {
            console.log('   ✓ 成功获取默认配置:');
            console.log(`     - ID: ${defaultConfig.id}`);
            console.log(`     - 名称: ${defaultConfig.name}`);
            console.log(`     - URL: ${defaultConfig.apiUrl}`);
            console.log(`     - API Key: ${defaultConfig.apiKey ? '已设置 (长度: ' + defaultConfig.apiKey.length + ')' : '未设置'}`);
            console.log(`     - 类型: ${defaultConfig.apiType}`);
            console.log(`     - 可用模型: ${defaultConfig.availableModels.length} 个`);
        } else {
            console.log('   ❌ 未找到默认配置');
        }
        
        console.log('\n========================================');
        console.log('测试完成');
        console.log('========================================');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        process.exit(0);
    }
}

testConfigLoading();
