/**
 * 修复 sessions 表结构
 * 添加缺失的 token 字段
 */

const { pool } = require('../lib/database');

async function fixSessionsTable() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔧 开始修复 sessions 表结构...\n');
        
        // 1. 检查表是否存在
        const [tables] = await connection.query(
            "SHOW TABLES LIKE 'sessions'"
        );
        
        if (tables.length === 0) {
            console.log('❌ sessions 表不存在，需要先初始化数据库');
            console.log('   运行: node scripts/init-database.js\n');
            return;
        }
        
        console.log('✅ sessions 表存在');
        
        // 2. 检查表结构
        const [columns] = await connection.query(
            "SHOW COLUMNS FROM sessions"
        );
        
        console.log('\n当前表结构：');
        columns.forEach(col => {
            console.log(`   - ${col.Field} (${col.Type})`);
        });
        
        // 3. 检查是否有 token 字段
        const hasToken = columns.some(col => col.Field === 'token');
        
        if (hasToken) {
            console.log('\n✅ token 字段已存在，无需修复');
            return;
        }
        
        console.log('\n❌ 缺少 token 字段，开始修复...');
        
        // 4. 删除旧表，重新创建
        console.log('\n步骤 1: 备份旧数据（如果有）...');
        await connection.query('DROP TABLE IF EXISTS sessions_backup');
        await connection.query('CREATE TABLE sessions_backup AS SELECT * FROM sessions');
        console.log('✅ 已备份到 sessions_backup');
        
        console.log('\n步骤 2: 删除旧表...');
        await connection.query('DROP TABLE sessions');
        console.log('✅ 已删除旧表');
        
        console.log('\n步骤 3: 创建新表（正确结构）...');
        await connection.query(`
            CREATE TABLE sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token VARCHAR(100) UNIQUE NOT NULL,
                username VARCHAR(100) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                INDEX idx_token (token),
                INDEX idx_username (username),
                INDEX idx_expires_at (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ 已创建新表');
        
        // 5. 验证新表结构
        const [newColumns] = await connection.query(
            "SHOW COLUMNS FROM sessions"
        );
        
        console.log('\n新表结构：');
        newColumns.forEach(col => {
            console.log(`   ✅ ${col.Field} (${col.Type})`);
        });
        
        console.log('\n🎉 sessions 表修复完成！');
        console.log('\n提示：');
        console.log('   - 旧数据已备份到 sessions_backup 表');
        console.log('   - 所有用户需要重新登录');
        console.log('   - 现在可以正常使用登录功能了\n');
        
    } catch (error) {
        console.error('\n❌ 修复失败:', error.message);
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

// 执行修复
fixSessionsTable()
    .then(() => {
        console.log('✅ 脚本执行完成\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
