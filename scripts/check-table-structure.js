/**
 * 检查 api_configs 表结构
 */

const { pool } = require('../lib/database');

async function checkTableStructure() {
    try {
        console.log('========================================');
        console.log('检查 api_configs 表结构');
        console.log('========================================\n');
        
        // 查看表结构
        const [columns] = await pool.query('DESCRIBE api_configs');
        
        console.log('当前表结构:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `(${col.Key})` : ''} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
        });
        
        console.log('\n========================================');
        console.log('查看实际数据:');
        console.log('========================================\n');
        
        const [rows] = await pool.query('SELECT * FROM api_configs');
        console.log('数据行数:', rows.length);
        
        if (rows.length > 0) {
            console.log('\n第一行数据:');
            console.log(JSON.stringify(rows[0], null, 2));
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit(0);
    }
}

checkTableStructure();
