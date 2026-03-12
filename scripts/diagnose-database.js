#!/usr/bin/env node

/**
 * 数据库诊断脚本
 * 检查当前数据库结构，对比应有的字段
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

// 期望的表结构
const expectedStructure = {
  api_configs: [
    'id', 'user_id', 'name', 'base_url', 'api_key', 'api_type',
    'is_default', 'is_active', 'priority', 'models', 'description',
    'last_used_at', 'success_count', 'fail_count', 'created_at', 'updated_at',
    'weight', 'health_status', 'last_check_at', 'avg_latency',
    'active_connections', 'total_connections'
  ],
  node_health_logs: [
    'id', 'node_id', 'check_time', 'status', 'connectivity', 'latency',
    'authentication', 'auth_error_code', 'quota_status', 'quota_total',
    'quota_used', 'quota_remaining', 'quota_percentage', 'error_message',
    'response_code', 'response_time'
  ],
  users: [
    'id', 'username', 'password', 'api_key', 'role', 'claude_api_key',
    'claude_base_url', 'api_type', 'default_model', 'default_mode',
    'default_config_id', 'last_login_at', 'login_count', 'created_at', 'updated_at'
  ],
  api_keys: [
    'id', 'username', 'api_key', 'name', 'status', 'created_at', 'last_used_at',
    'node_strategy', 'fixed_node_id', 'fixed_model', 'load_balance_nodes',
    'load_balance_strategy', 'default_model'
  ]
};

async function diagnoseDatabase() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('数据库诊断开始');
    console.log('========================================');
    console.log(`\n数据库: ${dbConfig.host}/${dbConfig.database}`);
    
    // 连接数据库
    console.log('\n1. 连接数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功');
    
    // 检查所有表
    console.log('\n2. 检查表结构...\n');
    
    for (const [tableName, expectedColumns] of Object.entries(expectedStructure)) {
      console.log(`\n检查表: ${tableName}`);
      console.log('─'.repeat(60));
      
      try {
        // 获取表结构
        const [columns] = await connection.execute(
          `SHOW COLUMNS FROM ${tableName}`
        );
        
        const actualColumns = columns.map(col => col.Field);
        
        // 检查缺失的字段
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
        
        // 检查多余的字段
        const extraColumns = actualColumns.filter(col => !expectedColumns.includes(col));
        
        if (missingColumns.length === 0 && extraColumns.length === 0) {
          console.log('✓ 表结构正确');
        } else {
          if (missingColumns.length > 0) {
            console.log(`\n❌ 缺失字段 (${missingColumns.length}):`);
            missingColumns.forEach(col => {
              console.log(`   - ${col}`);
            });
          }
          
          if (extraColumns.length > 0) {
            console.log(`\nℹ 额外字段 (${extraColumns.length}):`);
            extraColumns.forEach(col => {
              console.log(`   - ${col}`);
            });
          }
        }
        
        // 显示字段详情
        console.log(`\n当前字段 (${actualColumns.length}):`);
        columns.forEach(col => {
          const missing = !expectedColumns.includes(col.Field);
          const prefix = missing ? '  ⚠' : '  ✓';
          console.log(`${prefix} ${col.Field} (${col.Type})`);
        });
        
      } catch (error) {
        console.log(`❌ 表不存在或无法访问: ${error.message}`);
      }
    }
    
    // 检查数据
    console.log('\n\n3. 检查数据...\n');
    
    try {
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`✓ users 表: ${users[0].count} 条记录`);
      
      const [apiConfigs] = await connection.execute('SELECT COUNT(*) as count FROM api_configs');
      console.log(`✓ api_configs 表: ${apiConfigs[0].count} 条记录`);
      
      const [apiKeys] = await connection.execute('SELECT COUNT(*) as count FROM api_keys');
      console.log(`✓ api_keys 表: ${apiKeys[0].count} 条记录`);
      
      const [healthLogs] = await connection.execute('SELECT COUNT(*) as count FROM node_health_logs');
      console.log(`✓ node_health_logs 表: ${healthLogs[0].count} 条记录`);
      
    } catch (error) {
      console.log(`❌ 查询数据失败: ${error.message}`);
    }
    
    console.log('\n========================================');
    console.log('诊断完成');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error('\n详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行诊断
diagnoseDatabase();
