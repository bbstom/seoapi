/**
 * 日志迁移脚本 - 从文件迁移到数据库
 * 运行: node scripts/migrate-logs-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../lib/database');

async function migrateLogs() {
    console.log('🚀 开始迁移日志到数据库...\n');

    const logsDir = path.join(__dirname, '..', 'logs');
    
    if (!fs.existsSync(logsDir)) {
        console.log('📁 日志目录不存在，无需迁移');
        return;
    }

    const files = fs.readdirSync(logsDir);
    const logFiles = files.filter(f => f.startsWith('api-') && f.endsWith('.log'));

    if (logFiles.length === 0) {
        console.log('📁 没有找到日志文件，无需迁移');
        return;
    }

    console.log(`📊 找到 ${logFiles.length} 个日志文件\n`);

    let totalMigrated = 0;
    let totalFailed = 0;

    for (const file of logFiles) {
        const filePath = path.join(logsDir, file);
        console.log(`📄 处理文件: ${file}`);

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());

            let migrated = 0;
            let failed = 0;

            for (const line of lines) {
                try {
                    const log = JSON.parse(line);

                    await pool.query(
                        `INSERT INTO api_logs (
                            request_id, username, status, base_url, api_type, model, mode,
                            input_length, output_length, duration, api_duration,
                            input_tokens, output_tokens, total_tokens,
                            error_code, error_message, client_ip, user_agent, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            log.requestId,
                            log.username,
                            log.status,
                            log.baseURL,
                            log.apiType,
                            log.model,
                            log.mode,
                            log.inputLength,
                            log.outputLength,
                            log.duration,
                            log.apiDuration,
                            log.inputTokens || 0,
                            log.outputTokens || 0,
                            log.totalTokens || 0,
                            log.errorCode,
                            log.errorMessage,
                            log.clientIP,
                            log.userAgent,
                            log.timestamp
                        ]
                    );

                    migrated++;
                } catch (error) {
                    failed++;
                    // 忽略重复记录错误
                    if (!error.message.includes('Duplicate entry')) {
                        console.error(`  ⚠️  解析日志失败:`, error.message);
                    }
                }
            }

            console.log(`  ✅ 成功: ${migrated} 条, 失败: ${failed} 条\n`);
            totalMigrated += migrated;
            totalFailed += failed;

        } catch (error) {
            console.error(`  ❌ 读取文件失败:`, error.message);
        }
    }

    console.log('\n📊 迁移完成统计:');
    console.log(`  ✅ 成功迁移: ${totalMigrated} 条`);
    console.log(`  ❌ 失败/跳过: ${totalFailed} 条`);
    console.log('\n💡 提示: 迁移完成后，可以删除 logs/ 目录下的 .log 文件');
}

async function main() {
    try {
        await migrateLogs();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        await pool.end();
        process.exit(1);
    }
}

main();
