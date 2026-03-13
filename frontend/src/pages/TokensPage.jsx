import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Settings, X, Check } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const TokensPage = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [showToken, setShowToken] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [apiConfigs, setApiConfigs] = useState([]);
  const [editingNodeConfig, setEditingNodeConfig] = useState(null);
  const [editingConfig, setEditingConfig] = useState({});

  useEffect(() => {
    loadTokens();
    loadApiConfigs();
  }, []);

  const loadTokens = async () => {
    try {
      const response = await axios.get(`${API_BASE}/tokens`);
      if (response.data.success) {
        const mappedTokens = (response.data.tokens || []).map(t => ({
          id: t.id,
          name: t.name || '未命名令牌',
          token: t.apiKey || t.api_key || '',
          created_at: t.createdAt || t.created_at,
          last_used: t.lastUsedAt || t.last_used_at,
          usage_count: t.usageCount || t.usage_count || 0,
          status: t.status || 'active',
          node_strategy: t.nodeStrategy || t.node_strategy || 'load_balance',
          load_balance_strategy: t.loadBalanceStrategy || t.load_balance_strategy || 'round_robin',
          load_balance_nodes: t.loadBalanceNodes || t.load_balance_nodes || [],
          allowed_models: t.allowedModels || t.allowed_models || [],
          default_model: t.defaultModel || t.default_model || '',
          fixed_node_id: t.fixedNodeId || t.fixed_node_id || null,
          fixed_model: t.fixedModel || t.fixed_model || ''
        }));
        setTokens(mappedTokens);
      }
    } catch (error) {
      console.error('加载令牌失败:', error);
      showAlert('加载令牌失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadApiConfigs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/configs`);
      if (response.data.success) {
        const mappedConfigs = (response.data.configs || []).map(c => ({
          id: c.id,
          name: c.name,
          apiUrl: c.api_url,
          apiType: c.api_type,
          models: c.available_models || c.models || [],
          isDefault: c.is_default,
          isActive: c.is_active !== false,
          createdAt: c.created_at,
          updatedAt: c.updated_at
        }));
        setApiConfigs(mappedConfigs);
      }
    } catch (error) {
      console.error('加载API配置失败:', error);
    }
  };

  const loadNodeModels = async (nodeId) => {
    try {
      const response = await axios.get(`${API_BASE}/configs/${nodeId}/models`);
      if (response.data.success) {
        return response.data.models || [];
      }
    } catch (error) {
      console.error('加载节点模型失败:', error);
    }
    return [];
  };

  const createToken = async () => {
    if (!newTokenName.trim()) {
      showAlert('请输入令牌名称', 'error');
      return;
    }

    try {
      const response = await axios.post(`${API_BASE}/tokens`, {
        name: newTokenName
      });
      
      if (response.data.success) {
        showAlert('令牌创建成功！', 'success');
        setNewTokenName('');
        setIsCreating(false);
        loadTokens();
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '创建失败', 'error');
    }
  };

  const deleteToken = async (tokenId, tokenName) => {
    if (!confirm(`确定要删除令牌"${tokenName}"吗？删除后将无法恢复。`)) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE}/tokens/${tokenId}`);
      if (response.data.success) {
        showAlert('令牌已删除', 'success');
        loadTokens();
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '删除失败', 'error');
    }
  };

  const copyToken = (token) => {
    navigator.clipboard.writeText(token).then(() => {
      showAlert('令牌已复制到剪贴板', 'success');
    });
  };

  const toggleShowToken = (tokenId) => {
    setShowToken(prev => ({
      ...prev,
      [tokenId]: !prev[tokenId]
    }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '从未使用';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '从未使用';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  const updateNodeConfig = async (tokenId, config) => {
    try {
      const response = await axios.put(`${API_BASE}/tokens/${tokenId}/node-config`, {
        nodeStrategy: config.strategy,
        loadBalanceStrategy: config.loadBalanceStrategy,
        loadBalanceNodes: config.loadBalanceNodes,
        allowedModels: config.allowedModels || [],
        defaultModel: config.defaultModel || '',
        fixedNodeId: config.nodeId,
        fixedModel: config.model
      });
      
      if (response.data.success) {
        showAlert('节点配置更新成功', 'success');
        setEditingNodeConfig(null);
        setEditingConfig({});
        loadTokens();
      } else {
        showAlert(response.data.error || '更新失败', 'error');
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '更新失败', 'error');
    }
  };

  const handleStrategyChange = async (tokenId, strategy) => {
    setEditingConfig(prev => {
      const currentConfig = prev[tokenId] || {};
      return {
        ...prev,
        [tokenId]: {
          ...currentConfig,
          strategy,
          // 切换策略时重置相关配置
          loadBalanceStrategy: strategy === 'load_balance' ? 'round_robin' : null,
          loadBalanceNodes: strategy === 'load_balance' ? [] : null,
          nodeId: strategy === 'fixed' ? currentConfig.nodeId : null,
          model: null,
          defaultModel: null
        }
      };
    });
  };

  const handleNodeChange = async (tokenId, nodeId) => {
    if (nodeId) {
      const models = await loadNodeModels(nodeId);
      setEditingConfig(prev => ({
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          nodeId: parseInt(nodeId),
          model: null,
          models
        }
      }));
    } else {
      setEditingConfig(prev => ({
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          nodeId: null,
          model: null,
          models: []
        }
      }));
    }
  };

  const handleLoadBalanceNodesChange = async (tokenId, nodeId) => {
    setEditingConfig(prev => {
      const currentNodes = prev[tokenId]?.loadBalanceNodes || [];
      const nodeIdInt = parseInt(nodeId);
      const newNodes = currentNodes.includes(nodeIdInt)
        ? currentNodes.filter(id => id !== nodeIdInt)
        : [...currentNodes, nodeIdInt];
      
      return {
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          loadBalanceNodes: newNodes
        }
      };
    });
    
    // 异步加载选中节点的模型列表
    const currentNodes = editingConfig[tokenId]?.loadBalanceNodes || [];
    const nodeIdInt = parseInt(nodeId);
    const newNodes = currentNodes.includes(nodeIdInt)
      ? currentNodes.filter(id => id !== nodeIdInt)
      : [...currentNodes, nodeIdInt];
    
    if (newNodes.length > 0) {
      // 加载所有选中节点的模型
      const allModels = await loadMultipleNodeModels(newNodes);
      setEditingConfig(prev => ({
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          availableModels: allModels
        }
      }));
    } else {
      setEditingConfig(prev => ({
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          availableModels: []
        }
      }));
    }
  };
  
  const handleModelSelection = (tokenId, model) => {
    setEditingConfig(prev => {
      const currentModels = prev[tokenId]?.allowedModels || [];
      const newModels = currentModels.includes(model)
        ? currentModels.filter(m => m !== model)
        : [...currentModels, model];
      
      return {
        ...prev,
        [tokenId]: {
          ...prev[tokenId],
          allowedModels: newModels
        }
      };
    });
  };
  
  const loadMultipleNodeModels = async (nodeIds) => {
    try {
      const allModels = new Set();
      
      for (const nodeId of nodeIds) {
        const config = apiConfigs.find(c => c.id === nodeId);
        if (config && config.models && Array.isArray(config.models)) {
          config.models.forEach(model => allModels.add(model));
        }
      }
      
      return Array.from(allModels).sort();
    } catch (error) {
      console.error('加载节点模型失败:', error);
      return [];
    }
  };

  const startEditingNodeConfig = async (token) => {
    setEditingNodeConfig(token.id);
    
    const initialConfig = {
      strategy: token.node_strategy || 'load_balance',
      loadBalanceStrategy: token.load_balance_strategy || 'round_robin',
      loadBalanceNodes: token.load_balance_nodes || [],
      allowedModels: token.allowed_models || [],
      defaultModel: token.default_model || '',
      nodeId: token.fixed_node_id || null,
      model: token.fixed_model || '',
      models: [],
      availableModels: []
    };
    
    setEditingConfig(prev => ({
      ...prev,
      [token.id]: initialConfig
    }));
    
    // 如果是固定节点模式，加载该节点的模型
    if (token.fixed_node_id) {
      const models = await loadNodeModels(token.fixed_node_id);
      setEditingConfig(prev => ({
        ...prev,
        [token.id]: {
          ...prev[token.id],
          models
        }
      }));
    }
    
    // 如果是负载均衡模式且已选择节点，加载这些节点的模型
    if (token.node_strategy === 'load_balance' && token.load_balance_nodes && token.load_balance_nodes.length > 0) {
      const allModels = await loadMultipleNodeModels(token.load_balance_nodes);
      setEditingConfig(prev => ({
        ...prev,
        [token.id]: {
          ...prev[token.id],
          availableModels: allModels
        }
      }));
    }
  };

  const cancelEditing = (tokenId) => {
    setEditingNodeConfig(null);
    setEditingConfig(prev => {
      const newConfig = { ...prev };
      delete newConfig[tokenId];
      return newConfig;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in">
      {alert && (
        <div className={`p-4 rounded-xl ${alert.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {alert.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">API 令牌管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理用于外部工具调用的 API 令牌</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          创建令牌
        </button>
      </div>

      {isCreating && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-bold text-slate-800 mb-3">创建新令牌</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="令牌名称（如：小旋风专用）"
              className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              onKeyPress={(e) => e.key === 'Enter' && createToken()}
            />
            <button
              onClick={createToken}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              创建
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewTokenName('');
              }}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {tokens.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">名称</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">令牌</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">节点策略</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">创建时间</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">最后使用</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">使用次数</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tokens.map((token) => (
                  <React.Fragment key={token.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-600" />
                          <span className="font-medium text-slate-800">{token.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-slate-600 font-mono cursor-help" title={token.token}>
                            {token.token ? (showToken[token.id] ? token.token.substring(0, 15) + '...' : '•••••...') : '无令牌'}
                          </code>
                          <button
                            onClick={() => toggleShowToken(token.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            disabled={!token.token}
                          >
                            {showToken[token.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToken(token.token)}
                            className="p-1 text-indigo-600 hover:text-indigo-700 transition-colors"
                            disabled={!token.token}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            token.node_strategy === 'load_balance' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {token.node_strategy === 'load_balance' ? '负载均衡' : '固定节点'}
                          </span>
                          {token.node_strategy === 'fixed' && token.fixed_node_id && (
                            <div className="text-xs text-slate-500 mt-1">
                              {apiConfigs.find(c => c.id === token.fixed_node_id)?.name || `ID: ${token.fixed_node_id}`}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(token.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(token.last_used)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{token.usage_count.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => startEditingNodeConfig(token)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                            title="配置节点"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteToken(token.id, token.name)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="删除令牌"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editingNodeConfig === token.id && (
                      <tr>
                        <td colSpan="7" className="px-4 py-4 bg-slate-50">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Settings className="w-4 h-4 text-indigo-600" />
                              <h4 className="font-semibold text-slate-700">节点配置</h4>
                            </div>
                            
                            {/* 节点策略选择 */}
                            <div>
                              <label className="block text-xs text-slate-600 mb-1.5">节点策略</label>
                              <select
                                value={editingConfig[token.id]?.strategy || 'load_balance'}
                                onChange={(e) => handleStrategyChange(token.id, e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                              >
                                <option value="load_balance">负载均衡</option>
                                <option value="fixed">固定节点</option>
                              </select>
                            </div>

                            {/* 负载均衡模式配置 */}
                            {editingConfig[token.id]?.strategy === 'load_balance' && (
                              <>
                                {/* 负载均衡策略 */}
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">负载均衡策略</label>
                                  <select
                                    value={editingConfig[token.id]?.loadBalanceStrategy || 'round_robin'}
                                    onChange={(e) => setEditingConfig(prev => ({
                                      ...prev,
                                      [token.id]: { ...prev[token.id], loadBalanceStrategy: e.target.value }
                                    }))}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="round_robin">轮询</option>
                                    <option value="weighted">加权轮询</option>
                                    <option value="least_connections">最少连接</option>
                                    <option value="random">随机</option>
                                  </select>
                                </div>

                                {/* 参与节点多选 */}
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">
                                    参与节点 <span className="text-blue-500">(可选，未选择时使用所有健康节点)</span>
                                  </label>
                                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {apiConfigs.filter(c => c.isActive).map(config => (
                                      <label key={config.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                        <input
                                          type="checkbox"
                                          checked={(editingConfig[token.id]?.loadBalanceNodes || []).includes(config.id)}
                                          onChange={() => handleLoadBalanceNodesChange(token.id, config.id)}
                                          className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                        <span className="text-sm text-slate-700">{config.name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                {/* 允许的模型（多选） */}
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">
                                    允许使用的模型 <span className="text-blue-500">(可多选，不选则允许所有模型)</span>
                                  </label>
                                  {(!editingConfig[token.id]?.loadBalanceNodes || editingConfig[token.id]?.loadBalanceNodes.length === 0) ? (
                                    <div className="text-xs text-slate-400 py-2 px-3 bg-slate-50 rounded-lg">
                                      请先选择参与节点
                                    </div>
                                  ) : (editingConfig[token.id]?.availableModels || []).length === 0 ? (
                                    <div className="text-xs text-amber-600 py-2 px-3 bg-amber-50 rounded-lg">
                                      所选节点暂无可用模型，请先在 API 管理中测试连接获取模型列表
                                    </div>
                                  ) : (
                                    <div className="border border-slate-200 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                                      {(editingConfig[token.id]?.availableModels || []).map(model => (
                                        <label key={model} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-2 rounded">
                                          <input
                                            type="checkbox"
                                            checked={(editingConfig[token.id]?.allowedModels || []).includes(model)}
                                            onChange={() => handleModelSelection(token.id, model)}
                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500/20"
                                          />
                                          <span className="text-sm text-slate-700 font-mono">{model}</span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                  {editingConfig[token.id]?.allowedModels && editingConfig[token.id]?.allowedModels.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                      已选择 {editingConfig[token.id]?.allowedModels.length} 个模型
                                    </p>
                                  )}
                                </div>
                                
                                {/* 默认模型（单选） */}
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">
                                    默认模型 <span className="text-blue-500">(可选，从允许的模型中选择一个作为默认)</span>
                                  </label>
                                  <select
                                    value={editingConfig[token.id]?.defaultModel || ''}
                                    onChange={(e) => setEditingConfig(prev => ({
                                      ...prev,
                                      [token.id]: { ...prev[token.id], defaultModel: e.target.value }
                                    }))}
                                    disabled={!editingConfig[token.id]?.allowedModels || editingConfig[token.id]?.allowedModels.length === 0}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                  >
                                    <option value="">无默认模型</option>
                                    {(editingConfig[token.id]?.allowedModels || []).map(model => (
                                      <option key={model} value={model}>{model}</option>
                                    ))}
                                  </select>
                                  {(!editingConfig[token.id]?.allowedModels || editingConfig[token.id]?.allowedModels.length === 0) && (
                                    <p className="text-xs text-slate-400 mt-1">请先选择允许使用的模型</p>
                                  )}
                                </div>
                              </>
                            )}

                            {/* 固定节点模式配置 */}
                            {editingConfig[token.id]?.strategy === 'fixed' && (
                              <>
                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">API 节点</label>
                                  <select
                                    value={editingConfig[token.id]?.nodeId || ''}
                                    onChange={(e) => handleNodeChange(token.id, e.target.value)}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="">请选择节点</option>
                                    {apiConfigs.filter(c => c.isActive).map(config => (
                                      <option key={config.id} value={config.id}>{config.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs text-slate-600 mb-1.5">使用模型</label>
                                  <select
                                    value={editingConfig[token.id]?.model || ''}
                                    onChange={(e) => setEditingConfig(prev => ({
                                      ...prev,
                                      [token.id]: { ...prev[token.id], model: e.target.value }
                                    }))}
                                    disabled={!editingConfig[token.id]?.nodeId}
                                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                                  >
                                    <option value="">使用默认模型</option>
                                    {(editingConfig[token.id]?.models || []).map(model => (
                                      <option key={model} value={model}>{model}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => {
                                  const config = editingConfig[token.id];
                                  updateNodeConfig(token.id, config);
                                }}
                                className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
                              >
                                <Check className="w-4 h-4" />
                                保存
                              </button>
                              <button
                                onClick={() => cancelEditing(token.id)}
                                className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                              >
                                <X className="w-4 h-4" />
                                取消
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Key className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">暂无 API 令牌</p>
          <p className="text-sm text-slate-400 mb-4">创建令牌后，可用于小旋风等外部工具调用</p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-6 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            创建第一个令牌
          </button>
        </div>
      )}
    </div>
  );
};

export default TokensPage;
