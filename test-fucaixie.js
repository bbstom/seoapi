/**
 * 测试 fucaixie.xyz API 连接
 */

const Anthropic = require('@anthropic-ai/sdk');

const apiKey = 'sk-YYFmLLtN7zwDQyM8zRHCy60HawG0zTMXgjP0pNpgM5zt2KiU';

// 测试不同的 Base URL
const baseURLs = [
    'https://fucaixie.xyz',
    'https://fucaixie.xyz/v1',
    'https://api.fucaixie.xyz',
    'https://api.fucaixie.xyz/v1'
];

async function testURL(baseURL) {
    console.log(`\n测试: ${baseURL}`);
    console.log('----------------------------------------');
    
    try {
        const client = new Anthropic({
            apiKey: apiKey,
            baseURL: baseURL
        });
        
        const message = await client.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 50,
            messages: [
                { role: 'user', content: '你好' }
            ]
        });
        
        console.log('✅ 成功！');
        console.log(`响应: ${message.content[0].text}`);
        return true;
        
    } catch (error) {
        console.log(`❌ 失败: ${error.message}`);
        if (error.status) {
            console.log(`状态码: ${error.status}`);
        }
        return false;
    }
}

async function runTests() {
    console.log('========================================');
    console.log('fucaixie.xyz API 连接测试');
    console.log('========================================');
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);
    
    for (const baseURL of baseURLs) {
        const success = await testURL(baseURL);
        if (success) {
            console.log('\n========================================');
            console.log('✅ 找到可用的配置！');
            console.log('========================================');
            console.log(`Base URL: ${baseURL}`);
            console.log(`API Key: ${apiKey}`);
            console.log('\n你可以在系统中使用这个配置。');
            return;
        }
    }
    
    console.log('\n========================================');
    console.log('❌ 所有配置都失败了');
    console.log('========================================');
    console.log('\n建议：');
    console.log('1. 检查 API Key 是否正确');
    console.log('2. 确认 API Key 是否已激活');
    console.log('3. 联系服务商确认正确的 Base URL');
    console.log('4. 或使用 https://api123.icu 作为替代');
}

runTests();
