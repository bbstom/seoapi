/**
 * 验证默认配置一致性修复
 * 测试前端保存默认配置后，两个表的数据是否一致
 */

const { pool } = require('../lib/database');

async function verifyConsistency() {
    console.log('=== 验证默认配置一致性 ===\n');
    
    try {
        // 查询所有用户
        const [users] = await pool.query(
            'SELECT id, username, default_config_id FROM users'
        );
        
        console.log('当前状态:\n');
        
        for (const user of users) {
            // 获取用户的配置
            const [configs] = await pool.query(
                'SELECT id, name, is_default FROM api_configs WHERE user_id = ? ORDER BY id',
                [user.id]
            );
            
            const defaultConfig = configs.find(c => c.is_default === 1);
            
            console.log(`用户: ${user.username} (ID: ${user.id})`);
            console.log(`  users.default_config_id: ${user.default_config_id}`);
            console.log(`  api_configs 中 is_default=1 的: ${defaultConfig ? `ID ${defaultConfig.id} (${defaultConfig.name})` : '无'}`);
            
            // 列出所有配置
            console.log(`  所有配置:`);
            configs.forEach(c => {
                console.log(`    - ID ${c.id}: ${c.name} (is_default: ${c.is_default})`);
            });
            
            // 检查一致性
            if (!user.default_config_id && !defaultConfig) {
                console.log(`  ✅ 状态一致：都没有设置默认配置`);
            } else if (user.default_config_id && defaultConfig && user.default_config_id === defaultConfig.id) {
                console.log(`  ✅ 状态一致：默认配置都是 ID ${user.default_config_id}`);
            } else {
                console.log(`  ❌ 状态不一致！`);
                console.log(`     users 表指向: ${user.default_config_id}`);
                console.log(`     api_configs 表标记: ${defaultConfig ? defaultConfig.id : '无'}`);
            }
            console.log('');
        }
        
        console.log('\n测试说明:');
        console.log('1. 打开浏览器，访问系统配置页面');
        console.log('2. 切换到"默认调用配置"标签');
        console.log('3. 选择一个 API 配置，保存');
        console.log('4. 切换到"外部 API 配置"标签');
        console.log('5. 检查选择的配置是否显示"默认"标记');
        console.log('6. 再次运行此脚本，验证数据库中的数据是否一致\n');
        
    } catch (error) {
        console.error('❌ 查询失败:', error.message);
    } finally {
        await pool.end();
    }
}

verifyConsistency();
