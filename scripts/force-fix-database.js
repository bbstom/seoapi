/**
 * 强制修复数据库 - 删除所有表并重建
 */

const { pool } = require('../lib/database');
const { initDatabase } = require('../lib/database');

async function forceFix() {
    console.log('🔧 强制修复数据库...\n');
    
    const connection = await pool.getConnection();
    
    try {
        // 1. 禁用外键检查
        await connection.query('SET FOREIGN_KEY_CHECKS = 0');
        console.log('✅ 已禁用外键检查\n');
        
        // 2. 删除所有表
        console.log('步骤 1: 删除所有表...');
        const tables = ['users', 'sessions', 'api_keys', 'api_logs', 'rewrite_modes', 'api_configs'];
        
        for (const table of tables) {
            try {
                await connection.query(`DROP TABLE IF EXISTS ${table}`);
                console.log(`   ✅ 已删除 ${table}`);
            } catch (error) {
                console.log(`   ⚠️  ${table} 删除失败: ${error.message}`);
            }
        }
        
        // 3. 启用外键检查
        await connection.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('\n✅ 已启用外键检查\n');
        
        connection.release();
        
        // 4. 重新创建所有表
        console.log('步骤 2: 重新创建所有表...');
        await initDatabase();
        console.log('✅ 所有表已创建\n');
        
        // 5. 创建管理员
        console.log('步骤 3: 创建管理员账号...');
        const userManager = require('../lib/userManager');
        await userManager.initDefaultAdmin();
        console.log('✅ 管理员账号已创建\n');
        
        // 6. 验证
        console.log('步骤 4: 验证表结构...\n');
        const connection2 = await pool.getConnection();
        
        for (const table of tables) {
            try {
                const [columns] = await connection2.query(`SHOW COLUMNS FROM ${table}`);
                console.log(`✅ ${table} 表 (${columns.length} 个字段):`);
                columns.slice(0, 5).forEach(col => {
                    console.log(`   - ${col.Field} (${col.Type})`);
                });
                if (columns.length > 5) {
                    console.log(`   ... 还有 ${columns.length - 5} 个字段`);
                }
                console.log('');
            } catch (error) {
                console.log(`❌ ${table} 表不存在\n`);
            }
        }
        
        connection2.release();
        
        console.log('🎉 数据库修复完成！\n');
        console.log('默认管理员账号：');
        console.log('   用户名: admin');
        console.log('   密码: admin123\n');
        
    } catch (error) {
        console.error('❌ 修复失败:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

forceFix()
    .then(() => {
        console.log('✅ 脚本执行完成\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
