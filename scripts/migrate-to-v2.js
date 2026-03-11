/**
 * 数据库迁移脚本
 * 从旧数据库结构迁移到 V2 版本
 */

const { pool } = require('../lib/database');

async function migrateToV2() {
    const connection = await pool.getConnection();
    
    try {
        console.log('========================================');
        console.log('开始数据迁移...');
        console.log('========================================\n');

        // 检查旧表是否存在
        const [oldTables] = await connection.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME IN ('users', 'sessions', 'api_logs')
        `);

        if (oldTables.length === 0) {
            console.log('未发现旧数据表，跳过迁移');
            return;
        }

        console.log(`发现 ${oldTables.length} 个旧数据表，开始迁移...\n`);

        // 1. 迁移用户数据
        console.log('1. 迁移用户数据...');
        try {
            // 检查旧 users 表的字段
            const [oldUserColumns] = await connection.query(`
                SELECT COLUMN_NAME 
                FROM information_schema.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'users'
            `);
            
            const columnNames = oldUserColumns.map(col => col.COLUMN_NAME);
            console.log('   旧 users 表字段:', columnNames.join(', '));

            // 获取旧用户数据
            const [oldUsers] = await connection.query('SELECT * FROM users');
            console.log(`   找到 ${oldUsers.length} 个用户`);

            // 备份旧表
            await connection.query('DROP TABLE IF EXISTS users_backup');
            await connection.query('CREATE TABLE users_backup AS SELECT * FROM users');
            console.log('   ✅ 已备份旧 users 表到 users_backup');

            // 删除旧表
            await connection.query('DROP TABLE IF EXISTS users');
            console.log('   ✅ 已删除旧 users 表');

            // 创建新 users 表（通过 init-database-v2.js 已创建）
            // 这里只需要插入数据

            for (const user of oldUsers) {
                // 构建插入语句，只使用存在的字段
                const fields = [];
                const values = [];
                const placeholders = [];

                if (user.id) {
                    fields.push('id');
                    values.push(user.id);
                    placeholders.push('?');
                }
                if (user.username) {
                    fields.push('username');
                    values.push(user.username);
                    placeholders.push('?');
                }
                if (user.password) {
                    fields.push('password');
                    values.push(user.password);
                    placeholders.push('?');
                }
                if (user.email) {
                    fields.push('email');
                    values.push(user.email);
                    placeholders.push('?');
                }
                if (user.role) {
                    fields.push('role');
                    values.push(user.role);
                    placeholders.push('?');
                }
                if (user.apiKey || user.api_key) {
                    fields.push('api_key');
                    values.push(user.apiKey || user.api_key);
                    placeholders.push('?');
                }
                if (user.defaultModel || user.default_model) {
                    fields.push('default_model');
                    values.push(user.defaultModel || user.default_model);
                    placeholders.push('?');
                }
                if (user.defaultMode || user.default_mode) {
                    fields.push('default_mode');
                    values.push(user.defaultMode || user.default_mode);
                    placeholders.push('?');
                }
                if (user.createdAt || user.created_at) {
                    fields.push('created_at');
                    values.push(user.createdAt || user.created_at);
                    placeholders.push('?');
                }

                if (fields.length > 0) {
                    await connection.query(
                        `INSERT INTO users (${fields.join(', ')}) VALUES (${placeholders.join(', ')})
                         ON DUPLICATE KEY UPDATE username = VALUES(username)`,
                        values
                    );
                }
            }

            console.log(`   ✅ 成功迁移 ${oldUsers.length} 个用户\n`);
        } catch (error) {
            console.log('   ⚠️  用户数据迁移失败（可能表不存在）:', error.message);
        }

        // 2. 迁移会话数据
        console.log('2. 迁移会话数据...');
        try {
            const [oldSessions] = await connection.query('SELECT * FROM sessions');
            console.log(`   找到 ${oldSessions.length} 个会话`);

            // 备份
            await connection.query('DROP TABLE IF EXISTS sessions_backup');
            await connection.query('CREATE TABLE sessions_backup AS SELECT * FROM sessions');
            console.log('   ✅ 已备份旧 sessions 表');

            // 删除旧表
            await connection.query('DROP TABLE IF EXISTS sessions');
            console.log('   ✅ 已删除旧 sessions 表');

            // 插入新数据（只迁移未过期的会话）
            for (const session of oldSessions) {
                const expiresAt = session.expiresAt || session.expires_at;
                if (new Date(expiresAt) > new Date()) {
                    await connection.query(
                        `INSERT INTO sessions (user_id, session_token, ip_address, user_agent, expires_at, created_at)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE session_token = VALUES(session_token)`,
                        [
                            session.userId || session.user_id,
                            session.sessionToken || session.session_token,
                            session.ipAddress || session.ip_address,
                            session.userAgent || session.user_agent,
                            expiresAt,
                            session.createdAt || session.created_at
                        ]
                    );
                }
            }

            console.log('   ✅ 会话数据迁移完成\n');
        } catch (error) {
            console.log('   ⚠️  会话数据迁移失败（可能表不存在）:', error.message);
        }

        // 3. 迁移 API 日志
        console.log('3. 迁移 API 日志...');
        try {
            const [oldLogs] = await connection.query('SELECT * FROM api_logs LIMIT 10000');
            console.log(`   找到 ${oldLogs.length} 条日志（最多迁移10000条）`);

            // 备份
            await connection.query('DROP TABLE IF EXISTS api_logs_backup');
            await connection.query('CREATE TABLE api_logs_backup AS SELECT * FROM api_logs');
            console.log('   ✅ 已备份旧 api_logs 表');

            // 删除旧表
            await connection.query('DROP TABLE IF EXISTS api_logs');
            console.log('   ✅ 已删除旧 api_logs 表');

            // 插入新数据
            for (const log of oldLogs) {
                await connection.query(
                    `INSERT INTO api_logs 
                     (user_id, model, mode, input_length, output_length, similarity, duration, usage, status, ip_address, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        log.userId || log.user_id,
                        log.model,
                        log.mode,
                        log.inputLength || log.input_length,
                        log.outputLength || log.output_length,
                        log.similarity,
                        log.duration,
                        log.usage,
                        log.status || 'success',
                        log.ipAddress || log.ip_address,
                        log.timestamp || log.created_at
                    ]
                );
            }

            console.log('   ✅ API 日志迁移完成\n');
        } catch (error) {
            console.log('   ⚠️  API 日志迁移失败（可能表不存在）:', error.message);
        }

        console.log('========================================');
        console.log('✅ 数据迁移完成！');
        console.log('========================================\n');

        console.log('备份表：');
        console.log('- users_backup');
        console.log('- sessions_backup');
        console.log('- api_logs_backup');
        console.log('\n如果确认迁移成功，可以删除这些备份表\n');

    } catch (error) {
        console.error('❌ 数据迁移失败:', error);
        throw error;
    } finally {
        connection.release();
    }
}

// 执行迁移
migrateToV2()
    .then(() => {
        console.log('数据迁移脚本执行完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('执行失败:', error);
        process.exit(1);
    });
