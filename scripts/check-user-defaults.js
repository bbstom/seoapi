/**
 * 检查用户的默认配置
 */

const { pool } = require('../lib/database');

async function checkUserDefaults() {
    try {
        console.log('=== 检查用户默认配置 ===\n');
        
        const [users] = await pool.query(
            'SELECT id, username, default_config_id, default_model, default_mode FROM users'
        );
        
        if (users.length === 0) {
            console.log('❌ 没有找到任何用户');
            return;
        }
        
        console.log(`找到 ${users.length} 个用户:\n`);
        
        for (const user of users) {
            console.log(`用户 ID: ${user.id}`);
            console.log(`用户名: ${user.username}`);
            console.log(`默认 API 配置 ID: ${user.default_config_id || '未设置'}`);
            console.log(`默认模型: ${user.default_model || '未设置'}`);
            console.log(`默认模式: ${user.default_mode || '未设置'}`);
            console.log('---\n');
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit(0);
    }
}

checkUserDefaults();
