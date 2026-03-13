#!/usr/bin/env node

/**
 * 添加节点信息字段到 api_logs 表
 * 用于在数据看板中显示 API 节点信息
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

async function addNodeInfoFields() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('添加节点信息字段到 api_logs 表');
    console.log('========================================\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');
    
    // 检查 node_id 字段是否已存在
    const [nodeIdColumns] = await connection.execute(
      "SHOW COLUMNS FROM api_logs LIKE 'node_id'"
    );
    
    if (nodeIdColumns.length === 0) {
      console.log('添加 node_id 字段...');
      await connection.execute(`
        ALTER TABLE api_logs 
        ADD COLUMN node_id INT NULL COMMENT 'API节点ID' 
        AFTER base_url
      `);
      console.log('✓ node_id 字段添加成功');
      
      // 添加索引
      await connection.execute(`
        ALTER TABLE api_logs 
        ADD INDEX idx_node_id (node_id)
      `);
      console.log('✓ node_id 索引添加成功');
    } else {
      console.log('ℹ node_id 字段已存在');
    }
    
    // 检查 node_name 字段是否已存在
    const [nodeNameColumns] = await connection.execute(
      "SHOW COLUMNS FROM api_logs LIKE 'node_name'"
    );
    
    if (nodeNameColumns.length === 0) {
      console.log('\n添加 node_name 字段...');
      await connection.execute(`
        ALTER TABLE api_logs 
        ADD COLUMN node_name VARCHAR(100) NULL COMMENT 'API节点名称' 
        AFTER node_id
      `);
      console.log('✓ node_name 字段添加成功');
    } else {
      console.log('\nℹ node_name 字段已存在');
    }
    
    console.log('\n========================================');
    console.log('完成！');
    console.log('========================================');
    console.log('\n说明：');
    console.log('- node_id: API节点ID（关联 api_configs 表）');
    console.log('- node_name: API节点名称（冗余字段，方便查询）');
    console.log('- 现有日志的节点信息为 NULL，新日志会自动记录');
    console.log('\n下一步：');
    console.log('1. 重启后端服务：pm2 restart seoapi');
    console.log('2. 重新构建前端：cd frontend && npm run build');
    
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
addNodeInfoFields();
