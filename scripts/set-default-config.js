/**
 * 将现有配置设置为默认
 */

const { pool } = require('../lib/database');

async function setDefaultConfig() {
    try {
        console.log('========================================');
        console.log('设置默认 API 配置');
        console.log('========================================\n');
        
        // 获取所有配置
        const [configs] = await pool.query('SELECT * FROM api_configs');
        
        if (configs.length === 0) {
            console.log('❌ 没有找到任何配置');
            return;
        }
        
        console.log(`找到 ${configs.length} 个配置:\n`);
        configs.forEach((config, index) => {
            console.log(`${index + 1}. ${config.name} (ID: ${config.id})`);
            console.log(`   URL: ${config.base_url}`);
            console.log(`   默认: ${config.is_default ? '是' : '否'}`);
            console.log('');
        });
        
        // 将第一个配置设置为默认
        const firstConfig = configs[0];
        
        console.log(`将配置 "${firstConfig.name}" (ID: ${firstConfig.id}) 设置为默认...\n`);
        
        // 先取消所有默认
        await pool.query('UPDATE api_configs SET is_default = FALSE');
        
        // 设置第一个为默认
        await pool.query('UPDATE api_configs SET is_default = TRUE WHERE id = ?', [firstConfig.id]);
        
        console.log('✓ 设置成功！\n');
        
        // 验证
        const [updated] = await pool.query('SELECT * FROM api_configs WHERE id = ?', [firstConfig.id]);
        console.log('验证结果:');
        console.log(`  - 名称: ${updated[0].name}`);
        console.log(`  - URL: ${updated[0].base_url}`);
        console.log(`  - 是否默认: ${updated[0].is_default ? '是' : '否'}`);
        console.log('');
        
    } catch (error) {
        console.error('设置失败:', error);
    } finally {
        process.exit(0);
    }
}

setDefaultConfig();
