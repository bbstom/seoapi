/**
 * 清除 users 表中的旧 API 配置
 * 强制使用新的外部 API 配置系统
 */

const { pool } = require('../lib/database');

async function clearOldConfig() {
    console.log('🔧 清除 users 表中的旧 API 配置...\n');
    
    try {
        // 清除所有用户的旧 API 配置
        const [result] = await pool.query(`
            UPDATE users 
            SET 
                claude_api_key = NULL,
                claude_base_url = 'https://api.api123.icu',
                api_type = 'auto'
        `);
        
        console.log(`✅ 已清除 ${result.affectedRows} 个用户的旧 API 配置\n`);
        
        // 验证
        const [users] = await pool.query(`
            SELECT username, claude_api_key, claude_base_url, api_type 
            FROM users
        `);
        
        console.log('当前用户配置：\n');
        users.forEach(user => {
            console.log(`用户: ${user.username}`);
            console.log(`  claude_api_key: ${user.claude_api_key || '(未设置)'}`);
            console.log(`  claude_base_url: ${user.claude_base_url}`);
            console.log(`  api_type: ${user.api_type}`);
            console.log('');
        });
        
        console.log('🎉 清除完成！\n');
        console.log('提示：');
        console.log('  - 旧的 API 配置已清除');
        console.log('  - 现在系统将只使用"系统配置-外部API配置"中的配置');
        console.log('  - 请在 Web 界面添加外部 API 配置\n');
        
    } catch (error) {
        console.error('❌ 清除失败:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

clearOldConfig()
    .then(() => {
        console.log('✅ 脚本执行完成\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
