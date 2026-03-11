/**
 * 用户数据迁移脚本 - 从文件迁移到数据库
 * 运行: node scripts/migrate-users-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../lib/database');

async function migrateUsers() {
    console.log('🚀 开始迁移用户数据到数据库...\n');

    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
    
    if (!fs.existsSync(usersFile)) {
        console.log('📁 用户文件不存在，无需迁移');
        return;
    }

    try {
        const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const usernames = Object.keys(usersData);

        console.log(`📊 找到 ${usernames.length} 个用户\n`);

        let migrated = 0;
        let failed = 0;

        for (const username of usernames) {
            const user = usersData[username];
            
            try {
                console.log(`📄 迁移用户: ${username}`);

                await pool.query(
                    `INSERT INTO users (
                        username, password, api_key, role,
                        claude_api_key, claude_base_url, api_type,
                        default_model, default_mode, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        password = VALUES(password),
                        api_key = VALUES(api_key),
                        role = VALUES(role),
                        claude_api_key = VALUES(claude_api_key),
                        claude_base_url = VALUES(claude_base_url),
                        api_type = VALUES(api_type),
                        default_model = VALUES(default_model),
                        default_mode = VALUES(default_mode)`,
                    [
                        user.username,
                        user.password, // 已经是哈希后的密码
                        user.apiKey,
                        user.role || 'user',
                        user.claudeApiKey || null,
                        user.claudeBaseURL || 'https://api.api123.icu',
                        user.apiType || 'auto',
                        user.defaultModel || 'claude-sonnet-4-5-20250929',
                        user.defaultMode || 'humanlike',
                        user.createdAt || new Date().toISOString()
                    ]
                );

                console.log(`  ✅ 成功\n`);
                migrated++;

            } catch (error) {
                console.error(`  ❌ 失败: ${error.message}\n`);
                failed++;
            }
        }

        console.log('\n📊 迁移完成统计:');
        console.log(`  ✅ 成功迁移: ${migrated} 个用户`);
        console.log(`  ❌ 失败: ${failed} 个用户`);
        
        if (migrated > 0) {
            console.log('\n💡 提示: 迁移完成后，建议备份 data/users.json 文件');
            console.log('   备份命令: cp data/users.json data/users.json.backup');
        }

    } catch (error) {
        console.error('❌ 读取用户文件失败:', error.message);
    }
}

async function main() {
    try {
        await migrateUsers();
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ 迁移失败:', error);
        await pool.end();
        process.exit(1);
    }
}

main();
