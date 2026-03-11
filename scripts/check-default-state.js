/**
 * 检查默认配置状态
 * 直接查询数据库，查看 users 表的 default_config_id 和 api_configs 表的 is_default
 */

const { pool } = require('../lib/database');

async function checkDefaultState() {
    console.log('=== 检查默认配置状态 ===\n');
    
    try {
        // 1. 查询所有用户的默认配置
        console.log('1. 用户默认配置 (users.default_config_id):');
        const [users] = await pool.query(
            'SELECT id, username, default_config_id, default_model, default_mode FROM users'
        );
        
        users.forEach(user => {
            console.log(`   用户: ${user.username} (ID: ${user.id})`);
            console.log(`   - default_config_id: ${user.default_config_id}`);
            console.log(`   - default_model: ${user.default_model}`);
            console.log(`   - default_mode: ${user.default_mode}`);
            console.log('');
        });
        
        // 2. 查询所有 API 配置的默认状态
        console.log('2. API 配置默认状态 (api_configs.is_default):');
        const [configs] = await pool.query(
            'SELECT id, user_id, name, is_default, is_active, priority FROM api_configs ORDER BY user_id, priority DESC'
        );
        
        configs.forEach(config => {
            console.log(`   配置: ${config.name} (ID: ${config.id}, 用户ID: ${config.user_id})`);
            console.log(`   - is_default: ${config.is_default}`);
            console.log(`   - is_active: ${config.is_active}`);
            console.log(`   - priority: ${config.priority}`);
            console.log('');
        });
        
        // 3. 检查一致性
        console.log('3. 一致性检查:');
        for (const user of users) {
            const userConfigs = configs.filter(c => c.user_id === user.id);
            const defaultConfig = userConfigs.find(c => c.is_default === 1);
            
            console.log(`   用户: ${user.username}`);
            console.log(`   - default_config_id: ${user.default_config_id}`);
            console.log(`   - is_default=1 的配置: ${defaultConfig ? `ID ${defaultConfig.id} (${defaultConfig.name})` : '无'}`);
            
            if (!user.default_config_id && !defaultConfig) {
                console.log(`   ✅ 一致：都没有设置默认配置`);
            } else if (user.default_config_id && defaultConfig && user.default_config_id === defaultConfig.id) {
                console.log(`   ✅ 一致：默认配置都是 ID ${user.default_config_id}`);
            } else {
                console.log(`   ❌ 不一致！`);
            }
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        await pool.end();
    }
}

checkDefaultState();
