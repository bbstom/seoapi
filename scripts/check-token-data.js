#!/usr/bin/env node

/**
 * 检查令牌数据
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

async function checkTokenData() {
  let connection;
  
  try {
    console.log('========================================');
    console.log('检查令牌数据');
    console.log('========================================\n');
    
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ 数据库连接成功\n');
    
    // 查询所有令牌
    const [tokens] = await connection.execute(
      `SELECT id, name, node_strategy, load_balance_strategy, 
       load_balance_nodes, allowed_models, default_model,
       fixed_node_id, fixed_model
       FROM api_keys 
       ORDER BY id`
    );
    
    console.log(`找到 ${tokens.length} 个令牌:\n`);
    
    for (const token of tokens) {
      console.log(`令牌 ID: ${token.id}`);
      console.log(`  名称: ${token.name}`);
      console.log(`  节点策略: ${token.node_strategy}`);
      console.log(`  负载均衡策略: ${token.load_balance_strategy}`);
      
      // 检查 load_balance_nodes
      console.log(`  负载均衡节点 (原始): ${token.load_balance_nodes}`);
      if (token.load_balance_nodes) {
        try {
          const parsed = JSON.parse(token.load_balance_nodes);
          console.log(`  负载均衡节点 (解析): ${JSON.stringify(parsed)}`);
        } catch (e) {
          console.log(`  ❌ 负载均衡节点解析失败: ${e.message}`);
        }
      }
      
      // 检查 allowed_models
      console.log(`  允许的模型 (原始): ${token.allowed_models}`);
      if (token.allowed_models) {
        try {
          const parsed = JSON.parse(token.allowed_models);
          console.log(`  允许的模型 (解析): ${JSON.stringify(parsed)}`);
        } catch (e) {
          console.log(`  ❌ 允许的模型解析失败: ${e.message}`);
        }
      }
      
      console.log(`  默认模型: ${token.default_model}`);
      console.log(`  固定节点ID: ${token.fixed_node_id}`);
      console.log(`  固定模型: ${token.fixed_model}`);
      console.log('');
    }
    
    console.log('========================================');
    console.log('检查完成');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error('详细错误:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 运行检查
checkTokenData();
