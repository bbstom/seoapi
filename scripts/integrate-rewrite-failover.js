/**
 * 为文本改写接口集成故障转移功能
 * 
 * 这个脚本会修改 /api/rewrite 接口，使其支持自动故障转移
 */

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('为文本改写接口集成故障转移功能');
console.log('========================================\n');

const serverPath = path.join(__dirname, '../server.js');

// 读取 server.js
let serverContent = fs.readFileSync(serverPath, 'utf8');

// 检查是否已经集成
if (serverContent.includes('// 故障转移模式：尝试多个节点')) {
    console.log('✅ 故障转移功能已集成，无需重复操作\n');
    process.exit(0);
}

console.log('📝 开始集成故障转移功能...\n');

// 备份原文件
const backupPath = serverPath + '.backup.' + Date.now();
fs.writeFileSync(backupPath, serverContent);
console.log(`✅ 已备份原文件到: ${backupPath}\n`);

// 查找改写接口中的配置选择逻辑
const searchPattern = /\/\/ 3\. 降级到个人中心的旧配置[\s\S]*?console\.log\(`\[请求 \$\{requestId\}\] 最终 API 类型: \$\{apiType\} \(自动识别\)\`\);/;

const replacementCode = `// 3. 降级到个人中心的旧配置
        if (!apiConfig) {
            console.log(\`[请求 \${requestId}] ⚠️ 未找到外部API配置，使用个人中心配置（旧系统）\`);
            
            if (!req.user.claudeApiKey) {
                console.log(\`[请求 \${requestId}] ❌ 错误: 用户未配置 API Key\`);
                return res.json({
                    errcode: '100203',
                    errmsg: '用户未配置 API Key，请在"系统配置-外部API配置"中添加配置',
                    data: ''
                });
            }
            
            apiKey = req.user.claudeApiKey;
            baseURL = req.user.claudeBaseURL || 'https://api.api123.icu';
            apiType = req.user.apiType || 'auto';
            
            console.log(\`[请求 \${requestId}] ✓ 使用个人中心配置\`);
            console.log(\`[请求 \${requestId}] API 地址: \${baseURL}\`);
        }
        
        // 检测 API 类型
        apiType = detectAPIType(baseURL, apiType);
        console.log(\`[请求 \${requestId}] 最终 API 类型: \${apiType} (自动识别)\`);
        
        // 故障转移模式：尝试多个节点
        let allConfigs = [];
        if (apiConfig) {
            // 如果有选定的配置，先尝试它
            allConfigs.push(apiConfig);
            
            // 获取其他可用配置作为备用
            const otherConfigs = await configManager.getAllConfigs(req.user.username);
            for (const config of otherConfigs) {
                if (config.id !== apiConfig.id && config.isActive) {
                    allConfigs.push(config);
                }
            }
        }
        
        console.log(\`[请求 \${requestId}] 可用节点数: \${allConfigs.length}\`);`;

// 执行替换
if (searchPattern.test(serverContent)) {
    serverContent = serverContent.replace(searchPattern, replacementCode);
    console.log('✅ 已添加故障转移配置选择逻辑\n');
} else {
    console.log('⚠️ 未找到匹配的代码段，请手动集成\n');
    process.exit(1);
}

// 查找 AI 调用部分，添加故障转移逻辑
const callAIPattern = /(\/\/ 调用 AI（使用统一接口，自动适配）[\s\S]*?console\.log\(`\[请求 \$\{requestId\}\] 🚀 开始调用 AI\.\.\.\`\);[\s\S]*?)(const message = await callAI\(baseURL, apiKey, model, prompt, apiType\);)/;

const callAIReplacement = `$1// 故障转移：尝试多个节点
            let message = null;
            let lastError = null;
            let usedNodeName = apiConfig ? apiConfig.name : '个人中心配置';
            
            if (allConfigs.length > 0) {
                // 尝试每个配置
                for (let i = 0; i < allConfigs.length; i++) {
                    const tryConfig = allConfigs[i];
                    try {
                        console.log(\`[请求 \${requestId}] 尝试节点 \${i + 1}/\${allConfigs.length}: \${tryConfig.name}\`);
                        
                        message = await callAI(
                            tryConfig.apiUrl,
                            tryConfig.apiKey,
                            model,
                            prompt,
                            detectAPIType(tryConfig.apiUrl, tryConfig.apiType)
                        );
                        
                        usedNodeName = tryConfig.name;
                        
                        // 如果是故障转移（不是第一个节点）
                        if (i > 0) {
                            console.log(\`[请求 \${requestId}] ✅ 故障转移成功: \${allConfigs[0].name} → \${tryConfig.name}\`);
                            
                            // 记录故障转移日志
                            try {
                                await nodeSelector.logFailover(
                                    req.user.id,
                                    allConfigs[0].id,
                                    tryConfig.id,
                                    lastError?.message || 'API调用失败',
                                    {
                                        requestModel: model,
                                        requestEndpoint: '/api/rewrite',
                                        success: true,
                                        retryCount: i,
                                        fromNodeStatus: 'error',
                                        toNodeStatus: 'healthy'
                                    }
                                );
                            } catch (logError) {
                                console.error(\`[请求 \${requestId}] 记录故障转移日志失败:\`, logError);
                            }
                        }
                        
                        break; // 成功，跳出循环
                    } catch (error) {
                        lastError = error;
                        console.error(\`[请求 \${requestId}] 节点 \${tryConfig.name} 失败:\`, error.message);
                        
                        // 如果还有其他节点，继续尝试
                        if (i < allConfigs.length - 1) {
                            console.log(\`[请求 \${requestId}] 准备尝试下一个节点...\`);
                            continue;
                        } else {
                            // 所有节点都失败了
                            throw error;
                        }
                    }
                }
            } else {
                // 使用个人中心配置（无故障转移）
                message = await callAI(baseURL, apiKey, model, prompt, apiType);
            }`;

if (callAIPattern.test(serverContent)) {
    serverContent = serverContent.replace(callAIPattern, callAIReplacement);
    console.log('✅ 已添加故障转移调用逻辑\n');
} else {
    console.log('⚠️ 未找到 AI 调用代码段\n');
}

// 保存修改后的文件
fs.writeFileSync(serverPath, serverContent);
console.log('✅ 已保存修改\n');

console.log('========================================');
console.log('集成完成！');
console.log('========================================\n');
console.log('下一步：');
console.log('1. 重启服务器: npm start');
console.log('2. 测试故障转移功能');
console.log('3. 查看故障转移历史: 前端 → 监控仪表板 → 故障转移历史\n');
console.log('如有问题，可以从备份恢复:');
console.log(`cp ${backupPath} ${serverPath}\n`);
