/**
 * 修复默认配置同步问题
 * 将 users.default_config_id 和 api_configs.is_default 同步
 */

const { pool } = require('../lib/database');

async function fixDefaultSync() {
    console.log('=== 修复默认配置同步 ===\n');
    
    try {
        // 1. 获取所有用户
        const [users] = await pool.query('SELECT id, username, default_config_id FROM users');
        
        for (const user of users) {
            console.log(`处理用户: ${user.username} (ID: ${user.id})`);
            console.log(`  default_config_id: ${user.default_config_id}`);
            
            // 2. 清除该用户所有配置的 is_default 标记
            await pool.query(
                'UPDATE api_configs SET is_default = FALSE WHERE user_id = ?',
                [user.id]
            );
            console.log(`  ✅ 已清除所有配置的 is_default 标记`);
            
            // 3. 如果用户有 default_config_id，设置对应配置的 is_default
            if (user.default_config_id) {
                const [result] = await pool.query(
                    'UPDATE api_configs SET is_default = TRUE WHERE user_id = ? AND id = ?',
                    [user.id, user.default_config_id]
                );
                
                if (result.affectedRows > 0) {
                    console.log(`  ✅ 已设置配置 ID ${user.default_config_id} 为默认`);
                } else {
                    console.log(`  ⚠️  配置 ID ${user.default_config_id} 不存在，清除 default_config_id`);
                    await pool.query(
                        'UPDATE users SET default_config_id = NULL WHERE id = ?',
                        [user.id]
                    );
                }
            } else {
                console.log(`  ℹ️  用户没有设置默认配置`);
            }
            console.log('');
        }
        
        console.log('=== 修复完成 ===\n');
        
        // 4. 验证结果
        console.log('验证结果:');
        for (const user of users) {
            const [userInfo] = await pool.query(
                'SELECT default_config_id FROM users WHERE id = ?',
                [user.id]
            );
            
            const [configs] = await pool.query(
                'SELECT id, name, is_default FROM api_configs WHERE user_id = ?',
                [user.id]
            );
            
            const defaultConfig = configs.find(c => c.is_default === 1);
            
            console.log(`用户: ${user.username}`);
            console.log(`  default_config_id: ${userInfo[0].default_config_id}`);
            console.log(`  is_default=1 的配置: ${defaultConfig ? `ID ${defaultConfig.id} (${defaultConfig.name})` : '无'}`);
            
            if (!userInfo[0].default_config_id && !defaultConfig) {
                console.log(`  ✅ 一致`);
            } else if (userInfo[0].default_config_id && defaultConfig && userInfo[0].default_config_id === defaultConfig.id) {
                console.log(`  ✅ 一致`);
            } else {
                console.log(`  ❌ 仍然不一致`);
            }
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 修复失败:', error.message);
    } finally {
        await pool.end();
    }
}

fixDefaultSync();
