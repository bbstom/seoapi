/**
 * 为 api_keys 表添加模型字段
 * 运行: node scripts/add-token-model-field.js
 */

const { pool } = require('../lib/database');

async function addTokenModelField() {
    console.log('🚀 开始为令牌表添加模型字段...\n');

    try {
        const connection = await pool.getConnection();

        // 添加固定模型字段
        console.log('1️⃣ 添加 fixed_model 字段（固定模型）...');
        try {
            await connection.query(`
                ALTER TABLE api_keys 
                ADD COLUMN fixed_model VARCHAR(100) DEFAULT NULL 
                COMMENT '固定模型（当使用固定节点时可指定模型）'
            `);
            console.log('✅ fixed_model 字段添加成功');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️  fixed_model 字段已存在，跳过');
            } else {
                throw error;
            }
        }

        // 验证字段
        console.log('\n2️⃣ 验证表结构...');
        const [columns] = await connection.query(`
            SHOW COLUMNS FROM api_keys 
            WHERE Field = 'fixed_model'
        `);
        
        if (columns.length > 0) {
            console.log('\n当前字段信息:');
            columns.forEach(col => {
                console.log(`  - ${col.Field}: ${col.Type} (默认: ${col.Default})`);
            });
        }

        connection.release();

        console.log('\n✅ 令牌模型字段添加完成！');
        console.log('\n📋 新增字段说明:');
        console.log('  - fixed_model: 固定模型名称（可选）');
        console.log('    * 当使用固定节点时，可以指定使用该节点的特定模型');
        console.log('    * 如果不指定，使用用户的默认模型');

    } catch (error) {
        console.error('\n❌ 添加字段失败:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// 运行脚本
addTokenModelField().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
});
