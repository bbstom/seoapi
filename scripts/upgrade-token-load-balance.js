/**
 * 升级令牌表以支持负载均衡节点池和策略
 */

const { pool } = require('../lib/database');

async function upgradeTokenLoadBalance() {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始升级令牌表...');
    
    await connection.beginTransaction();
    
    // 检查字段是否存在的辅助函数
    const columnExists = async (tableName, columnName) => {
      const [rows] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [tableName, columnName]);
      return rows[0].count > 0;
    };
    
    // 1. 添加负载均衡节点池字段（JSON数组）
    if (!await columnExists('api_keys', 'load_balance_nodes')) {
      console.log('添加 load_balance_nodes 字段...');
      await connection.query(`
        ALTER TABLE api_keys 
        ADD COLUMN load_balance_nodes JSON DEFAULT NULL
        COMMENT '负载均衡节点池（节点ID数组）'
      `);
    } else {
      console.log('load_balance_nodes 字段已存在，跳过');
    }
    
    // 2. 添加负载均衡策略字段
    if (!await columnExists('api_keys', 'load_balance_strategy')) {
      console.log('添加 load_balance_strategy 字段...');
      await connection.query(`
        ALTER TABLE api_keys 
        ADD COLUMN load_balance_strategy VARCHAR(50) DEFAULT 'round_robin'
        COMMENT '负载均衡策略：round_robin(轮询), weighted(加权), least_connections(最少连接)'
      `);
    } else {
      console.log('load_balance_strategy 字段已存在，跳过');
    }
    
    // 3. 添加默认模型字段（用于负载均衡模式）
    if (!await columnExists('api_keys', 'default_model')) {
      console.log('添加 default_model 字段...');
      await connection.query(`
        ALTER TABLE api_keys 
        ADD COLUMN default_model VARCHAR(255) DEFAULT NULL
        COMMENT '默认使用的模型'
      `);
    } else {
      console.log('default_model 字段已存在，跳过');
    }
    
    await connection.commit();
    
    console.log('✅ 令牌表升级完成！');
    console.log('');
    console.log('新增字段：');
    console.log('  - load_balance_nodes: 负载均衡节点池（JSON数组）');
    console.log('  - load_balance_strategy: 负载均衡策略');
    console.log('  - default_model: 默认模型');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ 升级失败:', error.message);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

// 执行升级
upgradeTokenLoadBalance().catch(console.error);
