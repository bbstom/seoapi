/**
 * 为 api_keys 表添加节点配置字段
 * 运行: node scripts/add-token-node-config.js
 */

const { pool } = require('../lib/database');

async function addTokenNodeConfig() {
    console.log('🚀 开始为令牌表添加节点配置字段...\n');

    try {
        const connection = await pool.getConnection();

        // 1. 添加节点策略字段
        console.log('1️⃣ 添加 node_strategy 字段（节点选择策略）...');
        try {
            await connection.query(`
                ALTER TABLE api_keys 
                ADD COLUMN node_strategy ENUM('load_balance', 'fixed') DEFAULT 'load_balance' 
                COMMENT '节点选择策略：load_balance=负载均衡，fixed=固定节点'
            `);
            console.log('✅ node_strategy 字段添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️  node_strategy 字段已存在，跳过');
            } else {
                throw error;
            }
        }

        // 2. 添加固定节点ID字段
        console.log('\n2️⃣ 添加 fixed_node_id 字段（固定节点ID）...');
        try {
            await connection.query(`
                ALTER TABLE api_keys 
                ADD COLUMN fixed_node_id INT DEFAULT NULL 
                COMMENT '固定节点ID（当 node_strategy=fixed 时使用）'
            `);
            console.log('✅ fixed_node_id 字段添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️  fixed_node_id 字段已存在，跳过');
            } else {
                throw error;
            }
        }

        // 3. 添加索引
        console.log('\n3️⃣ 添加索引...');
        try {
            await connection.query(`
                ALTER TABLE api_keys 
                ADD INDEX idx_node_strategy (node_strategy)
            `);
            console.log('✅ node_strategy 索引添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_KEYNAME') {
                console.log('⚠️  索引已存在，跳过');
            } else {
                throw error;
            }
        }

        // 4. 验证字段
        console.log('\n4️⃣ 验证表结构...');
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM api_keys 
            WHERE Field IN ('node_strategy', 'fixed_node_id')
        `);
        
        console.log('\n当前字段信息:');
        columns.forEach(col => {
            console.log(`  - ${col.Field}: ${col.Type} (默认: ${col.Default})`);
        });

        connection.release();

        console.log('\n✅ 令牌节点配置字段添加完成！');
        console.log('\n📋 新增字段说明:');
        console.log('  - node_strategy: 节点选择策略');
        console.log('    * load_balance: 使用负载均衡（默认）');
        console.log('    * fixed: 使用固定节点');
        console.log('  - fixed_node_id: 固定节点的ID（仅在 fixed 模式下使用）');

    } catch (error) {
        console.error('\n❌ 添加字段失败:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// 运行脚本
addTokenNodeConfig().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
});
