import { useState, useEffect } from 'react';
import { Eye, EyeOff, Save, Settings as SettingsIcon, Zap, CheckCircle, XCircle, Loader, Plus, Trash2, Star, Edit2, X, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const SystemPage = ({ user, showToast, onConfigChange }) => {
  const [activeSubTab, setActiveSubTab] = useState('api-configs');
  const [apiConfigs, setApiConfigs] = useState([]);
  const [defaults, setDefaults] = useState({
    defaultApiConfig: '',
    defaultModel: '',
    defaultMode: ''
  });
  const [showApiKey, setShowApiKey] = useState({});
  const [showModels, setShowModels] = useState({});
  const [models, setModels] = useState([]);
  const [modes, setModes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState({});
  const [editingConfig, setEditingConfig] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [healthStatus, setHealthStatus] = useState({}); // API 健康状态：healthy, warning, error, offline
  const [healthDetails, setHealthDetails] = useState({}); // 健康详情：latency, authentication, quota等

  useEffect(() => {
    loadApiConfigs();
    loadModes();
  }, []);

  useEffect(() => {
    // 当 apiConfigs 加载完成后，加载默认配置
    if (apiConfigs.length > 0) {
      loadDefaults();
    }
  }, [apiConfigs.length]); // 只依赖长度，避免无限循环

  // 自动检查 API 健康状态
  useEffect(() => {
    if (apiConfigs.length > 0 && activeSubTab === 'api-configs') {
      // 首次加载时检查所有 API
      checkAllApiHealth();
      
      // 每 30 秒自动检查一次
      const interval = setInterval(() => {
        checkAllApiHealth();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [apiConfigs.length, activeSubTab]);

  const loadApiConfigs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api-configs`);
      if (response.data.success) {
        setApiConfigs(response.data.configs || []);
      }
    } catch (error) {
      console.error('加载 API 配置失败:', error);
    }
  };

  // 检查单个 API 的健康状态
  const checkApiHealth = async (config) => {
    if (!config.is_active) {
      // 如果配置被禁用，直接标记为离线
      setHealthStatus(prev => ({ ...prev, [config.id]: 'offline' }));
      return;
    }

    // 标记为检查中
    setHealthStatus(prev => ({ ...prev, [config.id]: 'checking' }));

    try {
      const response = await axios.post(`${API_BASE}/api-configs/health-check`, {
        config_id: config.id
      }, {
        timeout: 8000 // 8秒超时（增强检测需要更多时间）
      });

      if (response.data.success) {
        const status = response.data.status || 'offline';
        setHealthStatus(prev => ({ ...prev, [config.id]: status }));
        setHealthDetails(prev => ({
          ...prev,
          [config.id]: {
            latency: response.data.latency,
            authentication: response.data.authentication,
            quota_status: response.data.quota_status,
            quota_percentage: response.data.quota_percentage,
            error_message: response.data.error_message,
            last_check_at: response.data.last_check_at
          }
        }));
      } else {
        setHealthStatus(prev => ({ ...prev, [config.id]: 'offline' }));
      }
    } catch (error) {
      setHealthStatus(prev => ({ ...prev, [config.id]: 'offline' }));
    }
  };

  // 检查所有 API 的健康状态
  const checkAllApiHealth = async () => {
    for (const config of apiConfigs) {
      await checkApiHealth(config);
    }
  };

  const loadDefaults = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth/me`);
      if (response.data.success) {
        const userData = response.data.user;
        const defaultApiConfig = userData.defaultConfigId ? String(userData.defaultConfigId) : '';
        
        // 开发环境才显示调试日志
        if (import.meta.env.DEV) {
          console.log('加载默认配置:', {
            defaultConfigId: userData.defaultConfigId,
            defaultModel: userData.defaultModel,
            defaultMode: userData.defaultMode,
            apiConfigsLength: apiConfigs.length
          });
        }
        
        setDefaults({
          defaultApiConfig: defaultApiConfig,
          defaultModel: userData.defaultModel || '',
          defaultMode: userData.defaultMode || ''
        });
        
        // 如果有默认 API 配置，加载其模型列表
        if (defaultApiConfig && apiConfigs.length > 0) {
          const selectedConfig = apiConfigs.find(c => c.id === parseInt(defaultApiConfig));
          if (import.meta.env.DEV) {
            console.log('找到的配置:', selectedConfig);
          }
          if (selectedConfig && selectedConfig.models) {
            if (import.meta.env.DEV) {
              console.log('设置模型列表:', selectedConfig.models.length, '个模型');
            }
            setModels(selectedConfig.models);
          }
        }
      }
    } catch (error) {
      console.error('加载默认配置失败:', error);
    }
  };

  const loadModels = async () => {
    try {
      const response = await axios.get(`${API_BASE}/models`);
      if (response.data.models && Array.isArray(response.data.models)) {
        const modelList = response.data.models.map(model => {
          if (typeof model === 'string') return model;
          if (model.id) return model.id;
          if (model.name) return model.name;
          return String(model);
        });
        setModels(modelList);
      }
    } catch (error) {
      console.error('加载模型失败:', error);
    }
  };

  const loadModes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/modes`);
      if (response.data.modes && Array.isArray(response.data.modes)) {
        setModes(response.data.modes);
      }
    } catch (error) {
      console.error('加载模式失败:', error);
    }
  };

  const saveApiConfig = async (config) => {
    setLoading(true);
    try {
      if (config.id) {
        // 更新现有配置
        await axios.put(`${API_BASE}/api-configs/${config.id}`, config);
        showToast('API 配置更新成功！', 'success');
      } else {
        // 添加新配置
        await axios.post(`${API_BASE}/api-configs`, config);
        showToast('API 配置添加成功！', 'success');
      }
      loadApiConfigs();
      setEditingConfig(null);
      setIsAdding(false);
    } catch (error) {
      showToast(error.response?.data?.error || '保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteApiConfig = async (configId) => {
    if (!confirm('确定要删除这个 API 配置吗？')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/api-configs/${configId}`);
      showToast('API 配置已删除', 'success');
      loadApiConfigs();
    } catch (error) {
      showToast(error.response?.data?.error || '删除失败', 'error');
    }
  };

  const setDefaultConfig = async (configId) => {
    try {
      await axios.post(`${API_BASE}/api-configs/${configId}/set-default`);
      showToast('默认配置已更新', 'success');
      
      // 重新加载API配置列表
      await loadApiConfigs();
      
      // 同步更新"默认调用配置"页面的选择
      const selectedConfig = apiConfigs.find(c => c.id === configId);
      if (selectedConfig) {
        setDefaults(prev => ({
          ...prev,
          defaultApiConfig: String(configId),
          // 清空默认模型，让用户重新选择
          defaultModel: ''
        }));
        
        // 更新可用模型列表
        if (selectedConfig.models) {
          setModels(selectedConfig.models);
        }
      }
      
      // 触发配置刷新，同步到其他页面
      if (onConfigChange) {
        onConfigChange();
      }
    } catch (error) {
      showToast(error.response?.data?.error || '设置失败', 'error');
    }
  };

  const testApiConnection = async (config) => {
    setTestStatus({ ...testStatus, [config.id]: 'testing' });
    try {
      const response = await axios.post(`${API_BASE}/api-configs/test`, {
        base_url: config.base_url,
        api_key: config.api_key,
        api_type: config.api_type
      });
      
      if (response.data.success) {
        // 测试成功，更新配置的模型列表
        const models = response.data.models || [];
        
        // 保存模型列表到数据库
        await axios.put(`${API_BASE}/api-configs/${config.id}`, {
          ...config,
          models: models
        });
        
        setTestStatus({ ...testStatus, [config.id]: 'success' });
        showToast(`API 连接测试成功！找到 ${models.length} 个模型`, 'success');
        
        // 重新加载配置列表以显示更新后的模型数
        loadApiConfigs();
      } else {
        setTestStatus({ ...testStatus, [config.id]: 'error' });
        showToast('API 连接测试失败', 'error');
      }
    } catch (error) {
      setTestStatus({ ...testStatus, [config.id]: 'error' });
      showToast('API 连接测试失败', 'error');
    }
  };

  const saveDefaults = async () => {
    setLoading(true);
    try {
      // 1. 如果选择了 API 配置，先设置该配置为默认（这会更新 api_configs.is_default）
      if (defaults.defaultApiConfig) {
        await axios.post(`${API_BASE}/api-configs/${defaults.defaultApiConfig}/set-default`);
      }
      
      // 2. 保存用户的默认配置（这会更新 users.default_config_id）
      await axios.post(`${API_BASE}/users/defaults`, {
        defaultApiConfig: defaults.defaultApiConfig,
        defaultModel: defaults.defaultModel,
        defaultMode: defaults.defaultMode
      });
      
      showToast('默认配置保存成功！', 'success');
      
      // 3. 重新加载 API 配置列表和用户信息，确保显示最新状态
      await loadApiConfigs();
      await loadDefaults();
      
      // 4. 触发配置刷新，同步到文本改写页面
      if (onConfigChange) {
        onConfigChange();
      }
    } catch (error) {
      showToast(error.response?.data?.error || '保存失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowApiKey = (configId) => {
    setShowApiKey(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  const toggleShowModels = (configId) => {
    setShowModels(prev => ({
      ...prev,
      [configId]: !prev[configId]
    }));
  };

  const apiTypeNames = {
    'auto': '自动识别（推荐）',
    'openai': 'OpenAI 格式（ChatGPT、GPT-4 等）',
    'anthropic': 'Anthropic Claude',
    'gemini': 'Google Gemini',
    'cohere': 'Cohere',
    'qwen': '阿里云通义千问',
    'wenxin': '百度文心一言',
    'azure-openai': 'Azure OpenAI',
    'deepseek': 'DeepSeek',
    'moonshot': 'Moonshot（月之暗面）',
    'zhipu': '智谱 AI（ChatGLM）',
    'minimax': 'MiniMax',
    'baichuan': '百川智能',
    'yi': '零一万物（Yi）'
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      {/* 子标签导航 */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('api-configs')}
          className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
            activeSubTab === 'api-configs'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          AI 节点管理
        </button>
        <button
          onClick={() => setActiveSubTab('defaults')}
          className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
            activeSubTab === 'defaults'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          默认调用配置
        </button>
      </div>

      {/* AI 节点配置列表 */}
      {activeSubTab === 'api-configs' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">AI 节点列表</h3>
              <p className="text-sm text-slate-500 mt-1">管理多个 AI 服务节点，支持自动故障转移和负载均衡</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={checkAllApiHealth}
                className="px-4 py-3 rounded-xl font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-2"
                title="刷新所有节点状态"
              >
                <RefreshCw className="w-4 h-4" />
                刷新状态
              </button>
              <button
                onClick={() => setIsAdding(true)}
                className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                添加节点
              </button>
            </div>
          </div>

          {/* API 配置列表（表格式） */}
          {apiConfigs.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">节点名称</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">节点地址</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">API Key</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">类型</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">状态</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">延迟</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">优先级</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">权重</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">模型数</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {apiConfigs.map((config) => (
                      <tr key={config.id} className="hover:bg-slate-50 transition-colors">
                        {/* 配置名称 */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            {/* 健康状态圆点 */}
                            <div className="relative group">
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                !config.is_active 
                                  ? 'bg-slate-300' // 禁用：灰色
                                  : healthStatus[config.id] === 'healthy'
                                  ? 'bg-green-500 shadow-sm shadow-green-500/50' // 健康：绿色
                                  : healthStatus[config.id] === 'warning'
                                  ? 'bg-yellow-500 shadow-sm shadow-yellow-500/50' // 警告：黄色
                                  : healthStatus[config.id] === 'error'
                                  ? 'bg-orange-500 shadow-sm shadow-orange-500/50' // 异常：橙色
                                  : healthStatus[config.id] === 'checking'
                                  ? 'bg-blue-400 shadow-sm shadow-blue-400/50' // 检查中：蓝色
                                  : healthStatus[config.id] === 'offline'
                                  ? 'bg-red-500 shadow-sm shadow-red-500/50' // 离线：红色
                                  : 'bg-slate-400' // 未知：浅灰色
                              }`}>
                                {config.is_active && healthStatus[config.id] === 'healthy' && (
                                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-75"></div>
                                )}
                                {config.is_active && healthStatus[config.id] === 'checking' && (
                                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse opacity-75"></div>
                                )}
                              </div>
                              {/* 悬停提示 */}
                              <div className="absolute left-0 top-full mt-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg max-w-xs">
                                <div className="font-semibold mb-1">
                                  {!config.is_active 
                                    ? '已禁用'
                                    : healthStatus[config.id] === 'healthy'
                                    ? '✓ 健康'
                                    : healthStatus[config.id] === 'warning'
                                    ? '⚠ 警告'
                                    : healthStatus[config.id] === 'error'
                                    ? '✗ 异常'
                                    : healthStatus[config.id] === 'checking'
                                    ? '🔄 检查中...'
                                    : healthStatus[config.id] === 'offline'
                                    ? '✗ 离线'
                                    : '未知'}
                                </div>
                                
                                {/* 详细信息 */}
                                {config.is_active && healthDetails[config.id] && (
                                  <div className="space-y-1 text-xs border-t border-slate-600 pt-1 mt-1">
                                    {/* 延迟 */}
                                    {healthDetails[config.id].latency && (
                                      <div>延迟: {healthDetails[config.id].latency}ms</div>
                                    )}
                                    
                                    {/* 认证状态 */}
                                    {healthDetails[config.id].authentication && (
                                      <div className={
                                        healthDetails[config.id].authentication === 'valid' 
                                          ? 'text-green-300' 
                                          : healthDetails[config.id].authentication === 'invalid'
                                          ? 'text-red-300'
                                          : ''
                                      }>
                                        认证: {
                                          healthDetails[config.id].authentication === 'valid' 
                                            ? '✓ 有效' 
                                            : healthDetails[config.id].authentication === 'invalid'
                                            ? '✗ 失败'
                                            : '未知'
                                        }
                                      </div>
                                    )}
                                    
                                    {/* 额度状态 */}
                                    {healthDetails[config.id].quota_status && healthDetails[config.id].quota_status !== 'unknown' && (
                                      <div className={
                                        healthDetails[config.id].quota_status === 'sufficient' 
                                          ? 'text-green-300' 
                                          : healthDetails[config.id].quota_status === 'low'
                                          ? 'text-orange-300'
                                          : healthDetails[config.id].quota_status === 'exhausted'
                                          ? 'text-red-300'
                                          : ''
                                      }>
                                        额度: {
                                          healthDetails[config.id].quota_status === 'sufficient' 
                                            ? `✓ 充足 (${healthDetails[config.id].quota_percentage}%)` 
                                            : healthDetails[config.id].quota_status === 'low'
                                            ? `⚠ 不足 (${healthDetails[config.id].quota_percentage}%)`
                                            : healthDetails[config.id].quota_status === 'exhausted'
                                            ? '✗ 耗尽'
                                            : '未知'
                                        }
                                      </div>
                                    )}
                                    
                                    {/* 错误信息 */}
                                    {healthDetails[config.id].error_message && (
                                      <div className="text-red-300 border-t border-slate-600 pt-1 mt-1">
                                        错误: {healthDetails[config.id].error_message}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <span className="font-semibold text-slate-800">{config.name}</span>
                            {config.is_default && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-md">
                                <Star className="w-3 h-3" />
                                默认
                              </span>
                            )}
                          </div>
                          {config.description && (
                            <p className="text-xs text-slate-500 mt-1">{config.description}</p>
                          )}
                        </td>

                        {/* Base URL */}
                        <td className="px-4 py-4">
                          <span 
                            className="text-sm text-slate-600 font-mono cursor-help" 
                            title={config.base_url}
                          >
                            {config.base_url.substring(0, 5)}...
                          </span>
                        </td>

                        {/* API Key */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-sm text-slate-600 font-mono cursor-help"
                              title={showApiKey[config.id] ? config.api_key : '点击眼睛图标查看完整密钥'}
                            >
                              {showApiKey[config.id] ? `${config.api_key.substring(0, 5)}...` : '•••••...'}
                            </span>
                            <button
                              onClick={() => toggleShowApiKey(config.id)}
                              className="text-slate-400 hover:text-slate-600 transition-colors"
                              title={showApiKey[config.id] ? '隐藏' : '显示'}
                            >
                              {showApiKey[config.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>

                        {/* API 类型 */}
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                            {config.api_type}
                          </span>
                        </td>

                        {/* 状态 */}
                        <td className="px-4 py-4 text-center">
                          {config.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              启用
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-500 text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              禁用
                            </span>
                          )}
                        </td>

                        {/* 延迟 */}
                        <td className="px-4 py-4 text-center">
                          {config.is_active && healthDetails[config.id]?.latency ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                              healthStatus[config.id] === 'healthy' 
                                ? 'bg-emerald-50 text-emerald-700'
                                : healthStatus[config.id] === 'warning'
                                ? 'bg-yellow-50 text-yellow-700'
                                : healthStatus[config.id] === 'error'
                                ? 'bg-orange-50 text-orange-700'
                                : 'bg-slate-50 text-slate-600'
                            }`}>
                              {healthDetails[config.id].latency}ms
                            </span>
                          ) : config.is_active && healthStatus[config.id] === 'checking' ? (
                            <span className="text-xs text-slate-400">检查中...</span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>

                        {/* 优先级 */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                            {config.priority}
                          </span>
                        </td>

                        {/* 权重 */}
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">
                            {config.weight || 1}
                          </span>
                        </td>

                        {/* 模型数 */}
                        <td className="px-4 py-4 text-center">
                          {config.models && Array.isArray(config.models) && config.models.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => toggleShowModels(config.id)}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors cursor-pointer"
                              >
                                {config.models.length} 个模型
                              </button>
                              {showModels[config.id] && (
                                <div className="absolute z-10 mt-8 bg-white border border-slate-200 rounded-lg shadow-xl p-3 max-h-64 overflow-y-auto min-w-[250px]">
                                  <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-between">
                                    <span>可用模型列表</span>
                                    <button
                                      onClick={() => toggleShowModels(config.id)}
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="space-y-1">
                                    {config.models.map((model, idx) => (
                                      <div key={idx} className="text-xs text-slate-700 py-1 px-2 hover:bg-slate-50 rounded flex items-center gap-2">
                                        <span className="text-purple-500">•</span>
                                        <span className="font-mono">{model}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">未获取</span>
                          )}
                        </td>

                        {/* 操作 */}
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1">
                            {!config.is_default && (
                              <button
                                onClick={() => setDefaultConfig(config.id)}
                                className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="设为默认"
                              >
                                <Star className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => testApiConnection(config)}
                              disabled={testStatus[config.id] === 'testing'}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                              title="测试连接"
                            >
                              {testStatus[config.id] === 'testing' ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : testStatus[config.id] === 'success' ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : testStatus[config.id] === 'error' ? (
                                <XCircle className="w-4 h-4 text-red-600" />
                              ) : (
                                <Zap className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingConfig(config)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="编辑"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteApiConfig(config.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 表格底部信息 */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>共 {apiConfigs.length} 个配置</span>
                <span>默认配置：{apiConfigs.find(c => c.is_default)?.name || '未设置'}</span>
              </div>
            </div>
          )}

          {apiConfigs.length === 0 && !isAdding && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
              <SettingsIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">暂无 AI 节点</p>
              <p className="text-sm text-slate-400 mb-4">添加第一个 AI 服务节点</p>
              <button
                onClick={() => setIsAdding(true)}
                className="px-6 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                添加节点
              </button>
            </div>
          )}

          {/* 添加/编辑配置表单 */}
          {(isAdding || editingConfig) && (
            <ApiConfigForm
              config={editingConfig}
              apiTypeNames={apiTypeNames}
              onSave={saveApiConfig}
              onCancel={() => {
                setIsAdding(false);
                setEditingConfig(null);
              }}
              loading={loading}
            />
          )}

          {/* 配置说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h4 className="font-semibold text-blue-900 mb-3">关于 AI 节点管理</h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• 可以添加多个 AI 节点，系统会按优先级和权重自动选择</li>
              <li>• 标记为"默认"的节点会优先使用</li>
              <li>• 优先级数字越大，优先级越高</li>
              <li>• 权重用于负载均衡，权重越高分配的请求越多</li>
              <li>• 主节点失败时，系统会自动切换到备用节点</li>
              <li>• 可以临时禁用某个节点而不删除它</li>
              <li>• 系统会自动检测节点健康状态和响应延迟</li>
            </ul>
          </div>
        </div>
      )}

      {/* 默认调用配置 */}
      {activeSubTab === 'defaults' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Zap className="w-5 h-5 text-indigo-600" />
              默认调用配置
            </h3>
            
            <div className="space-y-4">
              {/* 默认 AI 节点 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  默认 AI 节点
                </label>
                <select
                  value={defaults.defaultApiConfig || ''}
                  onChange={(e) => {
                    const selectedConfigId = e.target.value;
                    const selectedConfig = apiConfigs.find(c => c.id === parseInt(selectedConfigId));
                    
                    setDefaults({ 
                      ...defaults, 
                      defaultApiConfig: selectedConfigId,
                      // 清空默认模型，让用户重新选择
                      defaultModel: ''
                    });
                    
                    // 更新可用模型列表
                    if (selectedConfig && selectedConfig.models) {
                      setModels(selectedConfig.models);
                    } else {
                      setModels([]);
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="">请选择 AI 节点...</option>
                  {apiConfigs.map(config => {
                    const status = !config.is_active 
                      ? '⚪' 
                      : healthStatus[config.id] === 'healthy' 
                      ? '🟢' 
                      : healthStatus[config.id] === 'warning'
                      ? '🟡'
                      : healthStatus[config.id] === 'error'
                      ? '🟠'
                      : healthStatus[config.id] === 'offline' 
                      ? '🔴' 
                      : healthStatus[config.id] === 'checking'
                      ? '🔵'
                      : '⚪';
                    return (
                      <option key={config.id} value={config.id}>
                        {status} {config.name} {config.is_default ? '(默认)' : ''} - {config.models?.length || 0} 个模型
                      </option>
                    );
                  })}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  选择一个 AI 节点作为默认，模型列表将自动更新
                </p>
              </div>
              
              {/* 默认模型 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  默认模型
                </label>
                <select
                  value={defaults.defaultModel}
                  onChange={(e) => setDefaults({ ...defaults, defaultModel: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  disabled={!defaults.defaultApiConfig || models.length === 0}
                >
                  <option value="">请选择模型...</option>
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  {!defaults.defaultApiConfig ? (
                    '请先选择 AI 节点'
                  ) : models.length === 0 ? (
                    '所选 AI 节点没有可用模型，请先测试连接获取模型列表'
                  ) : (
                    '小旋风等外部工具调用时，如果未指定模型，将使用此默认模型'
                  )}
                </p>
              </div>
              
              {/* 默认改写模式 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  默认改写模式
                </label>
                <select
                  value={defaults.defaultMode}
                  onChange={(e) => setDefaults({ ...defaults, defaultMode: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                >
                  <option value="">请选择模式...</option>
                  {modes.map(mode => (
                    <option key={mode.id} value={mode.id}>{mode.name}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  小旋风等外部工具调用时，如果未指定模式，将使用此默认模式
                </p>
              </div>
              
              <button
                onClick={saveDefaults}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {loading ? '保存中...' : '保存默认配置'}
              </button>
            </div>
          </div>

          {/* 配置说明 */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <h4 className="font-semibold text-blue-900 mb-3">关于默认配置</h4>
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• 默认配置用于小旋风等外部工具通过 API 调用本系统时</li>
              <li>• 如果外部工具在调用时指定了模型和模式，将优先使用指定的值</li>
              <li>• 如果外部工具未指定，则使用这里配置的默认值</li>
              <li>• 建议选择常用的模型和模式作为默认值</li>
              <li>• Web 界面的文本改写功能不受此配置影响，可以自由选择</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

// API 配置表单组件
const ApiConfigForm = ({ config, apiTypeNames, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    id: config?.id || null,
    name: config?.name || '',
    base_url: config?.base_url || '',
    api_key: config?.api_key || '',
    api_type: config?.api_type || 'auto',
    is_default: config?.is_default || false,
    is_active: config?.is_active !== undefined ? config.is_active : true,
    priority: config?.priority || 0,
    weight: config?.weight || 1,
    description: config?.description || '',
    models: config?.models || []
  });
  
  // 调试：打印初始配置（仅开发环境）
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('ApiConfigForm 初始化 - config:', config);
      console.log('ApiConfigForm 初始化 - config.models:', config?.models);
      console.log('ApiConfigForm 初始化 - formData.models:', formData.models);
    }
  }, []);
  
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [newModelInput, setNewModelInput] = useState('');
  const [showModelEditor, setShowModelEditor] = useState(false);

  const testConnection = async () => {
    if (!formData.base_url || !formData.api_key) {
      alert('请先填写 Base URL 和 API Key');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const response = await axios.post(`${API_BASE}/api-configs/test`, {
        base_url: formData.base_url,
        api_key: formData.api_key,
        api_type: formData.api_type
      });
      
      if (response.data.success) {
        const modelsList = response.data.models || [];
        setTestResult({ success: true, models: modelsList });
        // 不再自动保存，而是提示用户可以导入
      } else {
        setTestResult({ success: false, error: response.data.error });
      }
    } catch (error) {
      setTestResult({ success: false, error: error.response?.data?.error || '测试失败' });
    } finally {
      setTesting(false);
    }
  };

  // 导入测试获取的模型列表
  const importTestModels = () => {
    if (testResult?.success && testResult.models) {
      setFormData(prev => ({ ...prev, models: testResult.models }));
      setTestResult(null);
      setShowModelEditor(true);
    }
  };

  // 添加模型
  const addModel = () => {
    const trimmedModel = newModelInput.trim();
    if (trimmedModel && !formData.models.includes(trimmedModel)) {
      setFormData(prev => ({ 
        ...prev, 
        models: [...prev.models, trimmedModel] 
      }));
      setNewModelInput('');
    }
  };

  // 删除模型
  const removeModel = (modelToRemove) => {
    setFormData(prev => ({ 
      ...prev, 
      models: prev.models.filter(m => m !== modelToRemove) 
    }));
  };

  // 批量添加模型（每行一个）
  const bulkAddModels = (text) => {
    const newModels = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !formData.models.includes(line));
    
    if (newModels.length > 0) {
      setFormData(prev => ({ 
        ...prev, 
        models: [...prev.models, ...newModels] 
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (import.meta.env.DEV) {
      console.log('提交表单数据:', formData);
      console.log('模型列表:', formData.models);
      console.log('模型数量:', formData.models?.length);
    }
    onSave(formData);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-800 text-base">
          {config ? '编辑 AI 节点' : '添加 AI 节点'}
        </h3>
        <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* 第一行：节点名称 | API 类型 | 测试按钮 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              节点名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="如：主节点"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              API 类型
            </label>
            <select
              value={formData.api_type}
              onChange={(e) => setFormData({ ...formData, api_type: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="auto">自动识别</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="qwen">通义千问</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              &nbsp;
            </label>
            <button
              type="button"
              onClick={testConnection}
              disabled={testing || !formData.base_url || !formData.api_key}
              className="w-full px-3 py-2 rounded-lg font-medium text-sm border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {testing ? (
                <>
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                  测试中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  测试连接
                </>
              )}
            </button>
          </div>
        </div>

        {/* 第二行：节点地址 | API Key */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              节点地址 *
            </label>
            <input
              type="url"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="https://api.openai.com/v1"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              API Key *
            </label>
            <input
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="sk-..."
              required
            />
          </div>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {testResult.success ? (
              <div>
                <p className="font-medium text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  连接成功！找到 {testResult.models.length} 个模型
                </p>
                {testResult.models.length > 0 && (
                  <div className="mt-2">
                    <details className="mb-2">
                      <summary className="text-xs text-green-700 cursor-pointer hover:text-green-800 font-medium">
                        查看模型列表 ({testResult.models.length} 个)
                      </summary>
                      <div className="mt-2 bg-white rounded p-2 max-h-32 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-1">
                          {testResult.models.map((model, idx) => (
                            <div key={idx} className="text-xs text-slate-600 py-0.5 px-1 truncate" title={model}>
                              • {model}
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                    <button
                      type="button"
                      onClick={importTestModels}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      导入这些模型到配置
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-red-800 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {testResult.error}
              </p>
            )}
          </div>
        )}

        {/* 模型列表编辑器 */}
        <div className="border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-slate-700">
              可用模型列表 ({formData.models.length} 个)
            </label>
            <button
              type="button"
              onClick={() => setShowModelEditor(!showModelEditor)}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showModelEditor ? '收起' : '展开编辑'}
            </button>
          </div>

          {showModelEditor && (
            <div className="space-y-2">
              {/* 添加单个模型 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newModelInput}
                  onChange={(e) => setNewModelInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addModel())}
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder="输入模型名称，如：gpt-4"
                />
                <button
                  type="button"
                  onClick={addModel}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  添加
                </button>
              </div>

              {/* 批量添加 */}
              <details className="text-xs">
                <summary className="text-slate-600 cursor-pointer hover:text-slate-800 font-medium">
                  批量添加（每行一个模型）
                </summary>
                <div className="mt-2">
                  <textarea
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
                    rows="4"
                    placeholder="gpt-4&#10;gpt-3.5-turbo&#10;claude-3-opus"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        bulkAddModels(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">粘贴后点击外部区域自动添加</p>
                </div>
              </details>

              {/* 模型列表 */}
              {formData.models.length > 0 ? (
                <div className="max-h-48 overflow-y-auto bg-slate-50 rounded-lg p-2">
                  <div className="space-y-1">
                    {formData.models.map((model, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2 py-1.5 rounded text-xs group hover:bg-slate-50">
                        <span className="font-mono text-slate-700">{model}</span>
                        <button
                          type="button"
                          onClick={() => removeModel(model)}
                          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="删除"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  暂无模型，请添加或通过"测试连接"导入
                </div>
              )}
            </div>
          )}

          {!showModelEditor && formData.models.length > 0 && (
            <div className="text-xs text-slate-600 mt-1">
              {formData.models.slice(0, 3).join(', ')}
              {formData.models.length > 3 && ` 等 ${formData.models.length} 个模型`}
            </div>
          )}
        </div>

        {/* 第三行：优先级 | 权重 | 描述 | 复选框 */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              优先级
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="0"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              权重
            </label>
            <input
              type="number"
              min="1"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="1"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              描述（可选）
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              placeholder="节点说明..."
            />
          </div>

          <div className="md:col-span-5 flex gap-4 pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">设为默认</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">启用</span>
            </label>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-slate-300"
          >
            {loading ? '保存中...' : '保存节点'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-lg font-medium text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
};

export default SystemPage;
