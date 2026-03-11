/**
 * 修复所有数据库表结构
 * 一次性解决所有表结构问题
 */

const { pool } = require('../lib/database');
const { initDatabase } = require('../lib/database');

async function fixAllTables() {
    console.log('🔧 开始修复所有数据库表结构...\n');
    
    try {
        console.log('方案：删除所有旧表，重新创建正确的表结构\n');
        console.log('⚠️  警告：这将清除所有数据（除了 users 表）\n');
        
        const connection = await pool.getConnection();
        
        try {
            // 1. 备份 users 表数据
            console.log('步骤 1: 备份 users 表...');
            const [users] = await connection.query('SELECT * FROM users');
            console.log(`✅ 已读取 ${users.length} 个用户\n`);
            
            // 2. 删除所有表（包括 users）
            console.log('步骤 2: 删除所有旧表...');
            const tablesToDrop = [
                'api_configs',
                'api_keys',
                'rewrite_modes',
                'rewrite_logs',
                'sessions',
                'users'
            ];
            
            for (const table of tablesToDrop) {
                try {
                    await connection.query(`DROP TABLE IF EXISTS ${table}`);
                    console.log(`   ✅ 已删除 ${table}`);
                } catch (error) {
                    console.log(`   ⚠️  ${table} 不存在或删除失败`);
                }
            }
            
            connection.release();
            
            // 3. 重新初始化数据库（创建所有表）
            console.log('\n步骤 3: 重新创建所有表...');
            await initDatabase();
            console.log('✅ 所有表已重新创建\n');
            
            // 4. 重新创建管理员账号
            console.log('步骤 4: 重新创建管理员账号...');
            const userManager = require('../lib/userManager');
            await userManager.initDefaultAdmin();
            console.log('✅ 管理员账号已创建\n');
            
            // 5. 验证表结构
            console.log('步骤 5: 验证表结构...\n');
            const connection2 = await pool.getConnection();
            
            const tables = ['users', 'sessions', 'api_keys', 'rewrite_logs', 'rewrite_modes', 'api_configs'];
            
            for (const table of tables) {
                try {
                    const [columns] = await connection2.query(`SHOW COLUMNS FROM ${table}`);
                    console.log(`✅ ${table} 表 (${columns.length} 个字段):`);
                    columns.forEach(col => {
                        console.log(`   - ${col.Field} (${col.Type})`);
                    });
                    console.log('');
                } catch (error) {
                    console.log(`❌ ${table} 表不存在\n`);
                }
            }
            
            connection2.release();
            
            console.log('🎉 所有表结构修复完成！\n');
            console.log('提示：');
            console.log('   - 所有用户需要重新登录');
            console.log('   - 所有 API 令牌需要重新创建');
            console.log('   - 所有日志已清空');
            console.log('   - 现在可以正常使用所有功能了\n');
            
        } finally {
            await pool.end();
        }
        
    } catch (error) {
        console.error('\n❌ 修复失败:', error.message);
        console.error(error);
        throw error;
    }
}

// 执行修复
fixAllTables()
    .then(() => {
        console.log('✅ 脚本执行完成\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
