/**
 * 检查 API 配置中的模型列表
 */

const { pool } = require('../lib/database');

async function checkApiConfigsModels() {
    try {
        console.log('=== 检查 API 配置中的模型列表 ===\n');
        
        const [configs] = await pool.query(
            'SELECT id, name, models FROM api_configs ORDER BY id'
        );
        
        if (configs.length === 0) {
            console.log('❌ 没有找到任何 API 配置');
            return;
        }
        
        console.log(`找到 ${configs.length} 个 API 配置:\n`);
        
        configs.forEach(config => {
            console.log(`配置 ID: ${config.id}`);
            console.log(`配置名称: ${config.name}`);
            console.log(`models 字段类型: ${typeof config.models}`);
            console.log(`models 字段值: ${config.models}`);
            
            if (config.models) {
                try {
                    const parsed = JSON.parse(config.models);
                    console.log(`✓ JSON 解析成功`);
                    console.log(`  - 是否为数组: ${Array.isArray(parsed)}`);
                    console.log(`  - 模型数量: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        console.log(`  - 前 5 个模型: ${parsed.slice(0, 5).join(', ')}`);
                    }
                } catch (e) {
                    console.log(`❌ JSON 解析失败: ${e.message}`);
                }
            } else {
                console.log('⚠️  models 字段为空');
            }
            console.log('---\n');
        });
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit(0);
    }
}

checkApiConfigsModels();
