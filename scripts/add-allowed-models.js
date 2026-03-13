#!/usr/bin/env node

/**
 * 添加 allowed_models 字段到 api_keys 表
 * 用于存储令牌允许使用的模型列表
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

async function addAllowedModelsField() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('添加 allowed_models 字段');
    console.log('========================================\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');
    
    // 检查字段是否已存在
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM api_keys LIKE 'allowed_models'"
    );
    
    if (columns.length > 0) {
      console.log('ℹ allowed_models 字段已存在，无需添加');
      return;
    }
    
    // 添加字段
    console.log('添加 allowed_models 字段...');
    await connection.execute(`
      ALTER TABLE api_keys 
      ADD COLUMN allowed_models JSON NULL COMMENT '允许使用的模型列表（JSON数组）' 
      AFTER default_model
    `);
    
    console.log('✓ allowed_models 字段添加成功\n');
    
    // 迁移现有的 default_model 数据到 allowed_models
    console.log('迁移现有数据...');
    const [tokens] = await connection.execute(
      'SELECT id, default_model FROM api_keys WHERE default_model IS NOT NULL AND default_model != ""'
    );
    
    let migratedCount = 0;
    for (const token of tokens) {
      await connection.execute(
        'UPDATE api_keys SET allowed_models = ? WHERE id = ?',
        [JSON.stringify([token.default_model]), token.id]
      );
      console.log(`  ✓ Token ${token.id}: ${token.default_model} -> [${token.default_model}]`);
      migratedCount++;
    }
    
    console.log(`\n✓ 迁移了 ${migratedCount} 条记录\n`);
    
    console.log('========================================');
    console.log('完成！');
    console.log('========================================');
    console.log('\n说明：');
    console.log('- allowed_models: 允许使用的模型列表（可多选）');
    console.log('- default_model: 保留作为默认模型（单选）');
    console.log('- 如果设置了 allowed_models，令牌只能使用列表中的模型');
    console.log('- 如果未设置 allowed_models，令牌可以使用所有模型');
    
  } catch (error) {
    console.error('\n❌ 操作失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行
addAllowedModelsField();
