import { useState } from 'react';
import { FileText, Code, Copy, CheckCircle, AlertCircle, Zap } from 'lucide-react';

const ApiDocsPage = () => {
  const [copiedSection, setCopiedSection] = useState(null);

  const copyCode = (code, section) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  };

  const curlExample = `curl -X POST http://your-domain.com/api/rewrite \\
  -H "Authorization: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "这是需要改写的文本内容",
    "mode": "standard",
    "model": "claude-sonnet-4-5",
    "sim": 1
  }'`;

  const pythonExample = `import requests

url = "http://your-domain.com/api/rewrite"
headers = {
    "Authorization": "your-api-key",
    "Content-Type": "application/json"
}
data = {
    "text": "这是需要改写的文本内容",
    "mode": "standard",
    "model": "claude-sonnet-4-5",
    "sim": 1
}

response = requests.post(url, headers=headers, json=data)
result = response.json()
print(result)`;

  const jsExample = `const axios = require('axios');

const url = 'http://your-domain.com/api/rewrite';
const headers = {
  'Authorization': 'your-api-key',
  'Content-Type': 'application/json'
};
const data = {
  text: '这是需要改写的文本内容',
  mode: 'standard',
  model: 'claude-sonnet-4-5',
  sim: 1
};

axios.post(url, data, { headers })
  .then(response => {
    console.log(response.data);
  })
  .catch(error => {
    console.error(error);
  });`;

  const responseExample = `{
  "errcode": "0",
  "errmsg": "success",
  "data": "这是改写后的文本内容...",
  "like": "0.85",
  "_meta": {
    "duration": "2.34",
    "usage": {
      "input_tokens": 150,
      "output_tokens": 200
    }
  }
}`;

  const xiaoxuanfengConfig = `{
  "api_url": "http://your-domain.com/api/rewrite",
  "api_key": "your-api-key",
  "default_mode": "standard",
  "default_model": "claude-sonnet-4-5"
}`;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">API 文档</h2>
        <p className="text-sm text-slate-500">完整的 API 接口文档和使用示例</p>
      </div>

      {/* 快速开始 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          快速开始
        </h3>
        <div className="space-y-4 text-sm text-slate-600">
          <p>本系统提供 RESTful API 接口，支持文本改写功能。兼容小旋风等主流 SEO 工具。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="font-semibold text-slate-800 mb-2">1. 获取 API Key</p>
              <p className="text-xs text-slate-500">在"个人中心"页面获取您的 API Key</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="font-semibold text-slate-800 mb-2">2. 配置工具</p>
              <p className="text-xs text-slate-500">在小旋风等工具中配置 API 地址和密钥</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl">
              <p className="font-semibold text-slate-800 mb-2">3. 开始使用</p>
              <p className="text-xs text-slate-500">发送请求即可获得改写结果</p>
            </div>
          </div>
        </div>
      </div>

      {/* API 端点 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          API 端点
        </h3>
        
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg">POST</span>
              <code className="text-sm font-mono text-slate-700">/api/rewrite</code>
            </div>
            <p className="text-sm text-slate-600 mb-4">文本改写接口</p>
            
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">请求头 (Headers)</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <code className="text-slate-600">Authorization</code>
                    <span className="text-slate-500">您的 API Key（必填）</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="text-slate-600">Content-Type</code>
                    <span className="text-slate-500">application/json</span>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">请求参数 (Body)</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <code className="text-slate-600">text</code>
                    <span className="text-slate-500">待改写的文本（必填）</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="text-slate-600">mode</code>
                    <span className="text-slate-500">改写模式（可选，默认 standard）</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="text-slate-600">model</code>
                    <span className="text-slate-500">AI 模型（可选，使用默认配置）</span>
                  </div>
                  <div className="flex justify-between">
                    <code className="text-slate-600">sim</code>
                    <span className="text-slate-500">计算相似度（可选，1=是 0=否）</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 代码示例 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Code className="w-5 h-5 text-indigo-600" />
          代码示例
        </h3>
        
        <div className="space-y-6">
          {/* cURL */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-slate-700">cURL</p>
              <button
                onClick={() => copyCode(curlExample, 'curl')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {copiedSection === 'curl' ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    复制
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs">
              <code>{curlExample}</code>
            </pre>
          </div>

          {/* Python */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-slate-700">Python</p>
              <button
                onClick={() => copyCode(pythonExample, 'python')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {copiedSection === 'python' ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    复制
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs">
              <code>{pythonExample}</code>
            </pre>
          </div>

          {/* JavaScript */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-slate-700">JavaScript (Node.js)</p>
              <button
                onClick={() => copyCode(jsExample, 'js')}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                {copiedSection === 'js' ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    复制
                  </>
                )}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs">
              <code>{jsExample}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* 响应示例 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">响应示例</h3>
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm text-slate-600">成功响应 (200 OK)</p>
          <button
            onClick={() => copyCode(responseExample, 'response')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            {copiedSection === 'response' ? (
              <>
                <CheckCircle className="w-3 h-3" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                复制
              </>
            )}
          </button>
        </div>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs">
          <code>{responseExample}</code>
        </pre>
        
        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <p><code className="bg-slate-100 px-2 py-1 rounded">errcode</code>: 错误码，"0" 表示成功</p>
          <p><code className="bg-slate-100 px-2 py-1 rounded">errmsg</code>: 错误信息</p>
          <p><code className="bg-slate-100 px-2 py-1 rounded">data</code>: 改写后的文本</p>
          <p><code className="bg-slate-100 px-2 py-1 rounded">like</code>: 相似度（0-1 之间）</p>
          <p><code className="bg-slate-100 px-2 py-1 rounded">_meta</code>: 元数据（耗时、Token 使用量等）</p>
        </div>
      </div>

      {/* 小旋风配置 */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">小旋风配置示例</h3>
        <p className="text-sm text-slate-600 mb-4">在小旋风中配置本系统作为改写 API：</p>
        
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-slate-700">配置参数</p>
          <button
            onClick={() => copyCode(xiaoxuanfengConfig, 'config')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            {copiedSection === 'config' ? (
              <>
                <CheckCircle className="w-3 h-3" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                复制
              </>
            )}
          </button>
        </div>
        <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs">
          <code>{xiaoxuanfengConfig}</code>
        </pre>
      </div>

      {/* 注意事项 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            最佳实践
          </h4>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• 使用 HTTPS 确保数据传输安全</li>
            <li>• 妥善保管 API Key，不要泄露</li>
            <li>• 合理设置请求频率，避免过载</li>
            <li>• 处理好错误响应和重试逻辑</li>
          </ul>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            常见错误
          </h4>
          <ul className="text-sm text-amber-700 space-y-2">
            <li>• <code className="bg-amber-100 px-1 rounded">100101</code>: API Key 无效</li>
            <li>• <code className="bg-amber-100 px-1 rounded">100102</code>: 请求频率过高</li>
            <li>• <code className="bg-amber-100 px-1 rounded">100103</code>: 参数错误</li>
            <li>• <code className="bg-amber-100 px-1 rounded">100104</code>: 服务器错误</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
