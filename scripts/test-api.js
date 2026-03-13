#!/usr/bin/env node

/**
 * API 连接测试脚本
 * 用于诊断 API 连接和模型列表获取问题
 */

const https = require('https');
const http = require('http');

// 从命令行参数获取配置
const baseUrl = process.argv[2] || 'https://gpt.qt.cool';
const apiKey = process.argv[3] || '';

if (!apiKey) {
    console.error('❌ 请提供 API Key');
    console.log('\n使用方法:');
    console.log('  node scripts/test-api.js <BASE_URL> <API_KEY>');
    console.log('\n示例:');
    console.log('  node scripts/test-api.js https://gpt.qt.cool sk-xxxxx');
    process.exit(1);
}

async function testAPI() {
    console.log('========================================');
    console.log('API 连接测试');
    console.log('========================================');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`API Key: ${apiKey.substring(0, 10)}...`);
    console.log('');

    // 确保 URL 包含 /v1
    let testURL = baseUrl;
    if (!testURL.endsWith('/v1') && !testURL.includes('/v1/')) {
        testURL = testURL.replace(/\/$/, '') + '/v1';
    }

    console.log(`测试 URL: ${testURL}/models`);
    console.log('');

    const url = new URL(`${testURL}/models`);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        timeout: 10000
    };

    console.log('请求配置:');
    console.log(`  Hostname: ${options.hostname}`);
    console.log(`  Port: ${options.port}`);
    console.log(`  Path: ${options.path}`);
    console.log(`  Method: ${options.method}`);
    console.log('');

    return new Promise((resolve) => {
        const startTime = Date.now();

        const req = httpModule.request(options, (res) => {
            const latency = Date.now() - startTime;
            let data = '';

            console.log(`✓ 收到响应`);
            console.log(`  状态码: ${res.statusCode}`);
            console.log(`  延迟: ${latency}ms`);
            console.log(`  响应头:`);
            Object.keys(res.headers).forEach(key => {
                console.log(`    ${key}: ${res.headers[key]}`);
            });
            console.log('');

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log('响应体:');
                console.log('─'.repeat(60));
                
                try {
                    const response = JSON.parse(data);
                    console.log(JSON.stringify(response, null, 2));
                    console.log('─'.repeat(60));
                    console.log('');

                    // 分析响应格式
                    console.log('响应分析:');
                    console.log(`  类型: ${typeof response}`);
                    console.log(`  是否有 object 字段: ${!!response.object}`);
                    console.log(`  object 值: ${response.object}`);
                    console.log(`  是否有 data 字段: ${!!response.data}`);
                    console.log(`  data 类型: ${Array.isArray(response.data) ? 'Array' : typeof response.data}`);
                    console.log(`  是否有 models 字段: ${!!response.models}`);
                    console.log(`  是否有 model 字段: ${!!response.model}`);
                    console.log('');

                    // 提取模型列表
                    let models = [];
                    if (response.object === 'list' && response.data) {
                        models = response.data.map(m => m.id);
                        console.log('✓ 识别为 OpenAI 标准格式');
                    } else if (response.models) {
                        models = response.models;
                        console.log('✓ 识别为 OpenAI 兼容格式 (models 字段)');
                    } else if (response.model) {
                        models = [response.model];
                        console.log('✓ 识别为 OpenAI 兼容格式 (model 字段)');
                    } else if (response.data && Array.isArray(response.data)) {
                        models = response.data.map(m => typeof m === 'string' ? m : m.id || m.model || String(m));
                        console.log('✓ 从 data 数组提取模型');
                    } else {
                        console.log('⚠ 无法识别响应格式');
                    }

                    console.log('');
                    console.log(`找到 ${models.length} 个模型:`);
                    models.forEach((model, idx) => {
                        console.log(`  ${idx + 1}. ${model}`);
                    });

                    resolve({
                        success: true,
                        statusCode: res.statusCode,
                        latency: latency,
                        models: models,
                        rawResponse: response
                    });

                } catch (error) {
                    console.log(data.substring(0, 500));
                    if (data.length > 500) {
                        console.log('... (响应太长，已截断)');
                    }
                    console.log('─'.repeat(60));
                    console.log('');
                    console.log(`❌ JSON 解析失败: ${error.message}`);
                    
                    resolve({
                        success: false,
                        error: 'JSON 解析失败',
                        rawData: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.log(`❌ 请求失败: ${error.message}`);
            resolve({
                success: false,
                error: error.message
            });
        });

        req.on('timeout', () => {
            req.destroy();
            console.log(`❌ 请求超时`);
            resolve({
                success: false,
                error: '请求超时'
            });
        });

        req.end();
    });
}

// 运行测试
testAPI().then(result => {
    console.log('');
    console.log('========================================');
    console.log('测试完成');
    console.log('========================================');
    
    if (result.success) {
        console.log('✓ 测试成功');
        if (result.models && result.models.length > 0) {
            console.log(`✓ 找到 ${result.models.length} 个模型`);
        } else {
            console.log('⚠ 未找到模型列表');
        }
    } else {
        console.log('❌ 测试失败');
        console.log(`错误: ${result.error}`);
    }
    
    process.exit(result.success ? 0 : 1);
});
