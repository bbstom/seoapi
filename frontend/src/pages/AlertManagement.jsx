import { useState, useEffect } from 'react';
import { Bell, Plus, Edit2, Trash2, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Mail, Webhook } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const AlertManagement = ({ showToast }) => {
  const [rules, setRules] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [activeTab, setActiveTab] = useState('rules'); // 'rules' or 'logs'

  // 告警类型定义
  const alertTypes = {
    node_offline: { name: '节点离线', icon: XCircle, color: 'red', defaultThreshold: null },
    high_latency: { name: '响应时间过高', icon: Clock, color: 'orange', defaultThreshold: 5000 },
    low_success_rate: { name: '成功率过低', icon: AlertTriangle, color: 'yellow', defaultThreshold: 95 },
    frequent_failover: { name: '故障转移频繁', icon: RefreshCw, color: 'purple', defaultThreshold: 10 },
    high_connections: { name: '连接数过高', icon: Bell, color: 'blue', defaultThreshold: 100 }
  };

  useEffect(() => {
    loadRules();
    loadLogs();
  }, []);

  const loadRules = async () => {
    try {
      const response = await axios.get(`${API_BASE}/alert-rules`);
      if (response.data.success) {
        setRules(response.data.rules);
      }
    } catch (error) {
      console.error('加载告警规则失败:', error);
      showToast?.('加载告警规则失败', 'error');
    }
  };

  const loadLogs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/alert-logs`, {
        params: { limit: 50 }
      });
      if (response.data.success) {
        setLogs(response.data.logs);
      }
    } catch (error) {
      console.error('加载告警日志失败:', error);
    }
  };

  const deleteRule = async (ruleId) => {
    if (!confirm('确定要删除这个告警规则吗？')) return;
    
    try {
      await axios.delete(`${API_BASE}/alert-rules/${ruleId}`);
      showToast?.('告警规则已删除', 'success');
      loadRules();
    } catch (error) {
      showToast?.('删除失败', 'error');
    }
  };

  const toggleRule = async (rule) => {
    try {
      await axios.put(`${API_BASE}/alert-rules/${rule.id}`, {
        enabled: !rule.enabled
      });
      showToast?.(`告警规则已${!rule.enabled ? '启用' : '禁用'}`, 'success');
      loadRules();
    } catch (error) {
      showToast?.('操作失败', 'error');
    }
  };

  const checkAlerts = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/alert-check`);
      showToast?.('告警检查已完成', 'success');
      loadLogs();
    } catch (error) {
      showToast?.('告警检查失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-yellow-100 text-yellow-700';
      case 'info': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">告警管理</h2>
          <p className="text-sm text-slate-500 mt-1">配置告警规则并查看告警日志</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={checkAlerts}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            手动检查
          </button>
          <button
            onClick={() => {
              setEditingRule(null);
              setShowRuleForm(true);
            }}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            添加规则
          </button>
        </div>
      </div>

      {/* 标签切换 */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-3 font-semibold text-sm transition-all ${
            activeTab === 'rules'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          告警规则
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3 font-semibold text-sm transition-all ${
            activeTab === 'logs'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          告警日志
        </button>
      </div>

      {/* 告警规则列表 */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">暂无告警规则</p>
              <p className="text-sm text-slate-400">点击"添加规则"创建第一个告警规则</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.map((rule) => {
                const typeInfo = alertTypes[rule.alert_type] || {};
                const Icon = typeInfo.icon || Bell;
                return (
                  <div
                    key={rule.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-${typeInfo.color}-100`}>
                          <Icon className={`w-5 h-5 text-${typeInfo.color}-600`} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{typeInfo.name}</h3>
                          <p className="text-xs text-slate-500">{rule.alert_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRule(rule)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            rule.enabled
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {rule.enabled ? '已启用' : '已禁用'}
                        </button>
                      </div>
                    </div>

                    {/* 阈值 */}
                    {rule.threshold && (
                      <div className="mb-3 text-sm">
                        <span className="text-slate-600">阈值：</span>
                        <span className="font-semibold text-slate-900">
                          {rule.alert_type === 'high_latency' ? `${rule.threshold}ms` :
                           rule.alert_type === 'low_success_rate' ? `${rule.threshold}%` :
                           rule.threshold}
                        </span>
                      </div>
                    )}

                    {/* 通知方式 */}
                    <div className="flex items-center gap-3 mb-3 text-xs">
                      {rule.notify_email && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          <Mail className="w-3 h-3" />
                          邮件
                        </span>
                      )}
                      {rule.notify_webhook && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded">
                          <Webhook className="w-3 h-3" />
                          Webhook
                        </span>
                      )}
                      {!rule.notify_email && !rule.notify_webhook && (
                        <span className="text-slate-400">未配置通知</span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setShowRuleForm(true);
                        }}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        编辑
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 告警日志列表 */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">暂无告警日志</p>
              <p className="text-sm text-slate-400">系统运行正常，没有触发告警</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                          {log.severity === 'critical' ? '严重' : log.severity === 'warning' ? '警告' : '信息'}
                        </span>
                        <span className="text-sm font-semibold text-slate-900">{log.rule_name || '未知规则'}</span>
                      </div>
                      <p className="text-sm text-slate-700 mb-2">{log.message}</p>
                      {log.node_name && (
                        <p className="text-xs text-slate-500">节点: {log.node_name}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 text-right ml-4">
                      {formatTime(log.triggered_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 规则表单模态框 */}
      {showRuleForm && (
        <RuleFormModal
          rule={editingRule}
          alertTypes={alertTypes}
          onClose={() => {
            setShowRuleForm(false);
            setEditingRule(null);
          }}
          onSave={() => {
            setShowRuleForm(false);
            setEditingRule(null);
            loadRules();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

// 规则表单模态框组件
const RuleFormModal = ({ rule, alertTypes, onClose, onSave, showToast }) => {
  const [formData, setFormData] = useState({
    alert_type: rule?.alert_type || 'node_offline',
    enabled: rule?.enabled !== undefined ? rule.enabled : true,
    threshold: rule?.threshold || '',
    notify_email: rule?.notify_email || false,
    notify_webhook: rule?.notify_webhook || false,
    webhook_url: rule?.webhook_url || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (rule) {
        // 更新
        await axios.put(`${API_BASE}/alert-rules/${rule.id}`, formData);
        showToast?.('告警规则更新成功', 'success');
      } else {
        // 创建
        await axios.post(`${API_BASE}/alert-rules`, {
          alertType: formData.alert_type,
          enabled: formData.enabled,
          threshold: formData.threshold || null,
          notifyEmail: formData.notify_email,
          notifyWebhook: formData.notify_webhook,
          webhookUrl: formData.webhook_url || null
        });
        showToast?.('告警规则创建成功', 'success');
      }
      onSave();
    } catch (error) {
      showToast?.(error.response?.data?.error || '操作失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedType = alertTypes[formData.alert_type] || {};
  const needsThreshold = ['high_latency', 'low_success_rate', 'frequent_failover', 'high_connections'].includes(formData.alert_type);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-xl font-bold text-slate-900">
            {rule ? '编辑告警规则' : '添加告警规则'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 告警类型 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              告警类型 *
            </label>
            <select
              value={formData.alert_type}
              onChange={(e) => setFormData({ 
                ...formData, 
                alert_type: e.target.value,
                threshold: alertTypes[e.target.value]?.defaultThreshold || ''
              })}
              className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              disabled={!!rule}
            >
              {Object.entries(alertTypes).map(([key, type]) => (
                <option key={key} value={key}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* 阈值 */}
          {needsThreshold && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                阈值 *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                  className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                  placeholder={`默认: ${selectedType.defaultThreshold}`}
                  required
                />
                <span className="text-sm text-slate-600">
                  {formData.alert_type === 'high_latency' ? 'ms' :
                   formData.alert_type === 'low_success_rate' ? '%' :
                   formData.alert_type === 'frequent_failover' ? '次/小时' :
                   formData.alert_type === 'high_connections' ? '个连接' : ''}
                </span>
              </div>
            </div>
          )}

          {/* 启用状态 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">启用此规则</span>
            </label>
          </div>

          {/* 通知方式 */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              通知方式
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notify_email}
                onChange={(e) => setFormData({ ...formData, notify_email: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">邮件通知</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notify_webhook}
                onChange={(e) => setFormData({ ...formData, notify_webhook: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <Webhook className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">Webhook 通知</span>
            </label>

            {formData.notify_webhook && (
              <input
                type="url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                placeholder="https://your-webhook-url.com"
                required={formData.notify_webhook}
              />
            )}
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : rule ? '更新规则' : '创建规则'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertManagement;
