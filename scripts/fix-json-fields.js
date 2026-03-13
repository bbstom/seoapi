#!/usr/bin/env node

/**
 * 修复数据库中损坏的 JSON 字段
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seoapi',
  charset: 'utf8mb4'
};

async function fixJsonFields() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('修复数据库 JSON 字段');
    console.log('========================================');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');
    
    // 1. 检查 api_keys 表的 load_balance_nodes 字段
    console.log('1. 检查 api_keys.load_balance_nodes 字段...');
    const [apiKeys] = await connection.execute(
      'SELECT id, load_balance_nodes FROM api_keys WHERE load_balance_nodes IS NOT NULL'
    );
    
    let fixedCount = 0;
    for (const row of apiKeys) {
      try {
        // 尝试解析 JSON
        JSON.parse(row.load_balance_nodes);
        console.log(`  ✓ Token ${row.id}: JSON 格式正确`);
      } catch (e) {
        console.log(`  ❌ Token ${row.id}: JSON 格式错误`);
        console.log(`     原始值: ${row.load_balance_nodes}`);
        
        // 修复：设置为 NULL
        await connection.execute(
          'UPDATE api_keys SET load_balance_nodes = NULL WHERE id = ?',
          [row.id]
        );
        console.log(`     ✓ 已修复为 NULL`);
        fixedCount++;
      }
    }
    
    console.log(`\n修复了 ${fixedCount} 条记录\n`);
    
    // 2. 检查 api_configs 表的 models 字段
    console.log('2. 检查 api_configs.models 字段...');
    const [apiConfigs] = await connection.execute(
      'SELECT id, name, models FROM api_configs WHERE models IS NOT NULL'
    );
    
    let fixedModelsCount = 0;
    for (const row of apiConfigs) {
      try {
        // 尝试解析 JSON
        JSON.parse(row.models);
        console.log(`  ✓ Config ${row.id} (${row.name}): JSON 格式正确`);
      } catch (e) {
        console.log(`  ❌ Config ${row.id} (${row.name}): JSON 格式错误`);
        console.log(`     原始值: ${row.models}`);
        
        // 修复：设置为空数组
        await connection.execute(
          'UPDATE api_configs SET models = ? WHERE id = ?',
          [JSON.stringify([]), row.id]
        );
        console.log(`     ✓ 已修复为空数组 []`);
        fixedModelsCount++;
      }
    }
    
    console.log(`\n修复了 ${fixedModelsCount} 条记录\n`);
    
    console.log('========================================');
    console.log('修复完成！');
    console.log('========================================');
    console.log(`总共修复: ${fixedCount + fixedModelsCount} 条记录`);
    
  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行修复
fixJsonFields();
