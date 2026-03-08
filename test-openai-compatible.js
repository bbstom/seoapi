/**
 * 测试 OpenAI 兼容接口（fucaixie.xyz）
 */

const https = require('https');

const apiKey = 'sk-pO3064DHJ9NtCwYpQ7GFyNTe27ZL2CElLMEYhvq6JiE3dQtC';
const baseURL = 'https://fucaixie.xyz/v1';

async function testOpenAICompatible() {
    console.log('========================================');
    console.log('OpenAI 兼容接口测试');
    console.log('========================================');
    console.log('');
    console.log(`Base URL: ${baseURL}`);
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);
    console.log('');
    
    try {
        // 测试聊天接口
        console.log('发送测试请求...');
        const startTime = Date.now();
        
        const postData = JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'user', content: '请用一句话介绍你自己。' }
            ],
            max_tokens: 100
        });
        
        const url = new URL(`${baseURL}/chat/completions`);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('');
        console.log('========================================');
        console.log('测试结果：✅ 成功');
        console.log('========================================');
        console.log('');
        console.log(`响应时间: ${duration.toFixed(2)} 秒`);
        console.log(`模型: ${response.data.model}`);
        console.log('');
        console.log('响应内容：');
        console.log('----------------------------------------');
        if (response.data.choices && response.data.choices.length > 0) {
            console.log(response.data.choices[0].message.content);
        }
        console.log('----------------------------------------');
        console.log('');
        console.log('✅ OpenAI 兼容接口可用！');
        console.log('');
        console.log('配置信息：');
        console.log(`Base URL: ${baseURL}`);
        console.log(`API Key: ${apiKey}`);
        console.log('');
        console.log('⚠️ 注意：这是 OpenAI 格式接口，需要修改代码支持');
        console.log('');
        
    } catch (error) {
        console.log('');
        console.log('========================================');
        console.log('测试结果：❌ 失败');
        console.log('========================================');
        console.log('');
        console.log('错误信息：');
        console.log(`消息: ${error.message}`);
        console.log('');
        process.exit(1);
    }
}

testOpenAICompatible();
