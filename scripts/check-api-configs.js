/**
 * 检查 API 配置状态
 */

const { pool } = require('../lib/database');

async function checkApiConfigs() {
    try {
        console.log('========================================');
        console.log('检查 API 配置状态');
        console.log('========================================\n');
        
        // 1. 检查 api_configs 表
        console.log('1. 检查 api_configs 表:');
        const [configs] = await pool.query('SELECT * FROM api_configs');
        
        if (configs.length === 0) {
            console.log('   ❌ api_configs 表为空，没有任何外部 API 配置');
        } else {
            console.log(`   ✓ 找到 ${configs.length} 个配置:\n`);
            configs.forEach((config, index) => {
                console.log(`   配置 ${index + 1}:`);
                console.log(`     - ID: ${config.id}`);
                console.log(`     - 名称: ${config.name}`);
                console.log(`     - 用户名: ${config.username}`);
                console.log(`     - API URL: ${config.api_url}`);
                console.log(`     - API 类型: ${config.api_type}`);
                console.log(`     - 是否默认: ${config.is_default ? '是' : '否'}`);
                console.log(`     - API Key: ${config.api_key ? '已设置' : '未设置'}`);
                console.log(`     - 可用模型: ${config.available_models ? JSON.parse(config.available_models).length : 0} 个`);
                console.log('');
            });
        }
        
        // 2. 检查 users 表的旧配置
        console.log('\n2. 检查 users 表的旧配置:');
        const [users] = await pool.query('SELECT username, claude_api_key, claude_base_url FROM users');
        
        users.forEach((user, index) => {
            console.log(`   用户 ${index + 1}: ${user.username}`);
            console.log(`     - claude_api_key: ${user.claude_api_key || 'NULL'}`);
            console.log(`     - claude_base_url: ${user.claude_base_url || 'NULL'}`);
            console.log('');
        });
        
        // 3. 给出建议
        console.log('\n========================================');
        console.log('建议:');
        console.log('========================================');
        
        if (configs.length === 0) {
            console.log('❌ 您需要在 Web 界面添加外部 API 配置:');
            console.log('   1. 登录系统 (http://localhost:3000)');
            console.log('   2. 进入"系统配置"页面');
            console.log('   3. 点击"添加配置"按钮');
            console.log('   4. 填写 API 信息并保存');
            console.log('   5. 设置为默认配置');
        } else {
            const hasDefault = configs.some(c => c.is_default);
            if (!hasDefault) {
                console.log('⚠️  您有配置但没有设置默认配置:');
                console.log('   请在 Web 界面将其中一个配置设置为默认');
            } else {
                console.log('✓ 配置正常，系统应该可以正常工作');
            }
        }
        
        console.log('');
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit(0);
    }
}

checkApiConfigs();
