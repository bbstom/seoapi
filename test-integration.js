/**
 * 测试集成后的系统
 * 测试 OpenAI 兼容接口是否正常工作
 */

const https = require('https');

const apiKey = 'sk-pO3064DHJ9NtCwYpQ7GFyNTe27ZL2CElLMEYhvq6JiE3dQtC';
const baseURL = 'http://localhost:8000';

async function testRewrite() {
    console.log('========================================');
    console.log('测试改写接口');
    console.log('========================================');
    console.log('');
    
    const postData = JSON.stringify({
        txt: '这是一个测试文本，用于验证系统是否支持 OpenAI 兼容接口。',
        mode: 'seo_fast',
        model: 'claude-opus-4-6'
    });
    
    const options = {
        hostname: 'localhost',
        port: 8000,
        path: '/api/rewrite',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': apiKey,
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    console.log('响应状态码:', res.statusCode);
                    console.log('响应内容:', JSON.stringify(response, null, 2));
                    console.log('');
                    
                    if (response.errcode === '0') {
                        console.log('✅ 测试成功！');
                        console.log('改写后的文本:', response.data);
                    } else {
                        console.log('❌ 测试失败');
                        console.log('错误信息:', response.errmsg);
                    }
                    
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });
        
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

const http = require('http');

console.log('请确保服务已启动（运行 start.bat）');
console.log('并且已在 Web 界面配置：');
console.log('  Claude Base URL: https://fucaixie.xyz/v1');
console.log('  Claude API Key: sk-pO3064DHJ9NtCwYpQ7GFyNTe27ZL2CElLMEYhvq6JiE3dQtC');
console.log('');
console.log('开始测试...');
console.log('');

testRewrite().catch(error => {
    console.error('测试失败:', error.message);
    process.exit(1);
});
