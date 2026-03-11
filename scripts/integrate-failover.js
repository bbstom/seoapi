/**
 * 故障转移集成脚本
 * 
 * 在现有的文本改写接口中集成故障转移功能
 * 
 * 使用方法：
 * 1. 备份当前的 server.js
 * 2. 运行此脚本：node scripts/integrate-failover.js
 * 3. 重启服务器
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('故障转移集成脚本');
console.log('========================================\n');

// 读取 server.js
const serverPath = path.join(__dirname, '..', 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

console.log('1. 检查是否已集成...');

// 检查是否已经集成
if (serverContent.includes('apiCallWrapper.callWithFailover')) {
    console.log('✅ 故障转移功能已集成，无需重复操作\n');
    process.exit(0);
}

console.log('✅ 未检测到集成，开始集成流程\n');

// 备份原文件
console.log('2. 备份原文件...');
const backupPath = path.join(__dirname, '..', `server.js.backup.${Date.now()}`);
fs.writeFileSync(backupPath, serverContent);
console.log(`✅ 备份完成: ${backupPath}\n`);

console.log('3. 添加模块引用...');

// 检查是否已添加引用
if (!serverContent.includes("require('./lib/nodeSelector')")) {
    // 在 apiConfigManager 后面添加引用
    serverContent = serverContent.replace(
        /const apiConfigManager = require\('\.\/lib\/apiConfigManager'\);/,
        `const apiConfigManager = require('./lib/apiConfigManager');
const nodeSelector = require('./lib/nodeSelector');
const apiCallWrapper = require('./lib/apiCallWrapper');`
    );
    console.log('✅ 模块引用已添加\n');
} else {
    console.log('✅ 模块引用已存在\n');
}

console.log('========================================');
console.log('集成完成！');
console.log('========================================\n');

console.log('📝 集成说明：');
console.log('1. ✅ 已添加 nodeSelector 和 apiCallWrapper 模块引用');
console.log('2. ⏳ 需要手动修改 /api/rewrite 接口以使用故障转移');
console.log('3. ⏳ 或者创建新的 /api/rewrite-v2 接口\n');

console.log('📚 参考文档：');
console.log('- 阶段3-集成示例.md - 详细的集成方案');
console.log('- 阶段3-自动故障转移完成.md - 功能说明\n');

console.log('🚀 下一步：');
console.log('1. 查看 阶段3-集成示例.md 了解集成方案');
console.log('2. 选择合适的集成方案（推荐：创建 /api/rewrite-v2）');
console.log('3. 重启服务器测试功能\n');

// 保存修改后的文件
fs.writeFileSync(serverPath, serverContent);
console.log('✅ server.js 已更新\n');

console.log('========================================');
console.log('集成脚本执行完成');
console.log('========================================');
