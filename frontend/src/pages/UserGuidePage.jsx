import React from 'react';
import { BookOpen, Zap, Shield, Settings, Key, FileText, GitBranch, AlertCircle } from 'lucide-react';

const UserGuidePage = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">用户指南</h2>
        <p className="text-sm text-slate-500 mt-1">系统功能说明与使用指南</p>
      </div>

      {/* 系统概述 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">系统概述</h3>
        </div>
        <p className="text-slate-600 leading-relaxed">
          SEO API 是一个基于 Claude AI 的文本改写服务系统，支持多种改写模式、多 API 节点管理、智能负载均衡和故障转移。
          系统提供完整的 Web 管理界面和标准 API 接口，可与小旋风等外部工具无缝集成。
        </p>
      </div>

      {/* 核心功能 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">核心功能</h3>
        </div>
        <div className="space-y-4">
          <div className="border-l-4 border-indigo-500 pl-4">
            <h4 className="font-semibold text-slate-800 mb-2">1. 文本改写</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• 支持多种改写模式：标准改写、深度改写、创意改写等</li>
              <li>• 可自定义改写提示词和参数</li>
              <li>• 支持批量改写和长文本处理</li>
              <li>• 实时查看改写进度和结果</li>
            </ul>
          </div>

          <div className="border-l-4 border-blue-500 pl-4">
            <h4 className="font-semibold text-slate-800 mb-2">2. API 节点管理</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• 支持配置多个外部 API 节点</li>
              <li>• 每个节点可独立配置 API Key 和可用模型</li>
              <li>• 实时健康检测和状态监控</li>
              <li>• 支持节点优先级和权重配置</li>
            </ul>
          </div>

          <div className="border-l-4 border-purple-500 pl-4">
            <h4 className="font-semibold text-slate-800 mb-2">3. 智能负载均衡与故障转移</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• 支持两种模式：手动指定节点（禁用故障转移）和默认配置（启用故障转移）</li>
              <li>• 手动指定节点时：只使用指定节点，失败直接返回错误</li>
              <li>• 使用默认配置时：自动故障转移，失败自动切换到其他可用节点</li>
              <li>• 支持轮询、加权轮询等多种负载均衡策略</li>
            </ul>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-semibold text-slate-800 mb-2">4. 令牌管理</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• 为不同应用创建独立的 API 令牌</li>
              <li>• 每个令牌可配置独立的节点策略</li>
              <li>• 支持固定节点或负载均衡模式</li>
              <li>• 实时追踪令牌使用情况和统计</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 使用流程 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <GitBranch className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">使用流程</h3>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">1</div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">配置 API 节点</h4>
              <p className="text-sm text-slate-600">在"API 管理"中添加一个或多个外部 API 节点，配置 API Key 和可用模型列表。</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">2</div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">设置默认配置</h4>
              <p className="text-sm text-slate-600">在"API 管理"中设置默认调用配置，包括默认节点和模型。</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">3</div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">配置改写模式</h4>
              <p className="text-sm text-slate-600">在"改写模式"中自定义改写提示词和参数，或使用系统预设模式。</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">4</div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">创建 API 令牌</h4>
              <p className="text-sm text-slate-600">在"令牌管理"中创建令牌，配置节点策略（负载均衡或固定节点）。</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">5</div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1">开始使用</h4>
              <p className="text-sm text-slate-600">通过 Web 界面或 API 接口进行文本改写，查看数据看板监控使用情况。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 重要规则 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">重要规则</h3>
        </div>
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-amber-900 mb-1">API Key 安全</h4>
                <p className="text-sm text-amber-700">请妥善保管 API Key，不要在公开场合分享。系统会加密存储所有 API Key。</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">节点健康检测</h4>
                <p className="text-sm text-blue-700">系统每 5 分钟自动检测节点健康状态。不健康的节点会自动从负载均衡池中移除。</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Key className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-purple-900 mb-1">故障转移策略</h4>
                <p className="text-sm text-purple-700">
                  <strong>手动指定节点：</strong>前端选择具体节点时，禁用故障转移，只使用指定节点<br/>
                  <strong>使用默认节点：</strong>前端选择"使用默认节点"时，启用故障转移，失败自动切换<br/>
                  <strong>令牌固定节点：</strong>令牌配置固定节点时，禁用故障转移，只使用指定节点
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 mb-1">改写模式</h4>
                <p className="text-sm text-green-700">
                  系统提供多种预设改写模式，也可以自定义提示词。改写质量取决于提示词的设计和所选模型。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 监控与运维 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">监控与运维</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">数据看板</h4>
            <p className="text-sm text-slate-600">实时查看改写请求统计、成功率、失败原因等关键指标。</p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">监控仪表板</h4>
            <p className="text-sm text-slate-600">查看所有节点的健康状态、响应时间、请求分布等实时数据。</p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">故障转移历史</h4>
            <p className="text-sm text-slate-600">记录所有故障转移事件，帮助分析和优化节点配置。</p>
          </div>

          <div className="border border-slate-200 rounded-lg p-4">
            <h4 className="font-semibold text-slate-800 mb-2">告警管理</h4>
            <p className="text-sm text-slate-600">配置告警规则，在节点故障或异常时及时通知。</p>
          </div>
        </div>
      </div>

      {/* 常见问题 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-800">常见问题</h3>
        </div>
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 如何提高改写质量？</h4>
            <p className="text-sm text-slate-600">A: 选择更强大的模型（如 Claude Sonnet 4），优化改写提示词，提供更多上下文信息。</p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 节点显示不健康怎么办？</h4>
            <p className="text-sm text-slate-600">A: 检查 API Key 是否正确，网络连接是否正常，API 配额是否充足。</p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 我选择了某个节点，为什么用的是另一个节点？</h4>
            <p className="text-sm text-slate-600">
              A: 这种情况不应该发生。如果你手动选择了具体节点，系统会禁用故障转移，只使用你指定的节点。
              请检查：1) 前端是否真的选择了具体节点（不是"使用默认节点"）2) 查看服务器日志确认节点选择。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 什么时候会发生故障转移？</h4>
            <p className="text-sm text-slate-600">
              A: 只有在以下情况下才会发生故障转移：1) 前端选择"使用默认节点" 2) 令牌配置为"负载均衡"模式。
              如果手动指定了节点或令牌配置为固定节点，则不会发生故障转移。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 如何选择负载均衡还是固定节点？</h4>
            <p className="text-sm text-slate-600">
              A: <strong>日常使用推荐负载均衡</strong>（选择"使用默认节点"），系统会自动处理故障，提供高可用性。
              <strong>测试调试推荐固定节点</strong>（手动选择具体节点），可以精确控制使用哪个节点，便于排查问题。
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-800 mb-1">Q: 令牌可以修改吗？</h4>
            <p className="text-sm text-slate-600">A: 令牌创建后不可修改，但可以修改令牌的节点配置。如需更换令牌，请删除旧令牌并创建新的。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserGuidePage;
