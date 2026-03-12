/**
 * 数据库升级脚本
 * 用于添加缺失的字段，不删除现有数据
 * 
 * 使用方法：
 * node scripts/upgrade-database.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seoapi',
    port: process.env.DB_PORT || 3306
};

async function upgradeDatabase() {
    let connection;
    
    try {
        console.log('========================================');
        console.log('数据库升级开始');
        console.log('========================================\n');
        
        // 连接数据库
        console.log('1. 连接数据库...');
        connection = await mysql.createConnection(DB_CONFIG);
        console.log('✓ 数据库连接成功\n');
        
        // 检查并添加缺失的字段
        console.log('2. 检查并添加缺失的字段...');
        
        // 检查 api_configs 表
        await addColumnIfNotExists(connection, 'api_configs', 'weight', 'INT DEFAULT 1 AFTER priority');
        await addColumnIfNotExists(connection, 'api_configs', 'avg_latency', 'INT DEFAULT 0 AFTER last_check_at');
        await addColumnIfNotExists(connection, 'api_configs', 'description', 'TEXT AFTER models');
        
        console.log('✓ 所有字段检查完成\n');
        
        // 显示表结构
        console.log('3. 当前表结构：');
        const [columns] = await connection.execute('DESCRIBE api_configs');
        console.table(columns.map(col => ({
            字段: col.Field,
            类型: col.Type,
            允许空: col.Null,
            默认值: col.Default
        })));
        
        console.log('\n========================================');
        console.log('数据库升级完成！');
        console.log('========================================\n');
        
    } catch (error) {
        console.error('\n❌ 升级失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

async function addColumnIfNotExists(connection, tableName, columnName, columnDefinition) {
    try {
        // 检查字段是否存在
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`
        );
        
        if (columns.length === 0) {
            // 字段不存在，添加
            console.log(`  添加字段: ${tableName}.${columnName}`);
            await connection.execute(
                `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`
            );
            console.log(`  ✓ ${tableName}.${columnName} 添加成功`);
        } else {
            console.log(`  ⊘ ${tableName}.${columnName} 已存在，跳过`);
        }
    } catch (error) {
        console.error(`  ✗ ${tableName}.${columnName} 添加失败: ${error.message}`);
        throw error;
    }
}

// 执行升级
if (require.main === module) {
    upgradeDatabase();
}

module.exports = { upgradeDatabase };
