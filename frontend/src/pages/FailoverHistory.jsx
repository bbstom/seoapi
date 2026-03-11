import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, ArrowRight } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const FailoverHistory = ({ showToast }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadHistory();
  }, [limit]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/failover-history`, {
        params: { limit }
      });
      
      if (response.data.success) {
        setHistory(response.data.history);
      }
    } catch (error) {
      console.error('加载故障转移历史失败:', error);
      showToast?.('加载故障转移历史失败', 'error');
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

  const formatLatency = (ms) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const successCount = history.filter(h => h.success).length;
  const failureCount = history.filter(h => !h.success).length;
  const successRate = history.length > 0 ? ((successCount / history.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">故障转移历史</h2>
          <p className="text-sm text-slate-500 mt-1">查看节点故障转移的历史记录</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          >
            <option value={20}>最近 20 条</option>
            <option value={50}>最近 50 条</option>
            <option value={100}>最近 100 条</option>
          </select>
          <button
            onClick={loadHistory}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">总记录数</p>
            <p className="text-2xl font-bold text-slate-900">{history.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">成功转移</p>
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">失败转移</p>
            <p className="text-2xl font-bold text-red-600">{failureCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-sm text-slate-600 mb-1">成功率</p>
            <p className="text-2xl font-bold text-blue-600">{successRate}%</p>
          </div>
        </div>
      )}

      {/* 历史记录列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 mb-2">暂无故障转移记录</p>
          <p className="text-sm text-slate-400">当API节点失败时，系统会自动切换到备用节点并记录日志</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {history.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* 转移路径 */}
                    <div className="flex items-center gap-3 mb-2">
                      {log.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-semibold text-slate-700">
                          {log.from_node_name || `节点 ${log.from_node_id}`}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-slate-700">
                          {log.to_node_name || `节点 ${log.to_node_id}`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.success 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.success ? '成功' : '失败'}
                        </span>
                      </div>
                    </div>
                    
                    {/* 失败原因 */}
                    <div className="text-sm text-slate-600 mb-2 ml-8">
                      <span className="font-medium">原因：</span>
                      {log.failure_reason || '未知'}
                    </div>
                    
                    {/* 详细信息 */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 ml-8 flex-wrap">
                      {log.request_model && (
                        <span>模型: {log.request_model}</span>
                      )}
                      {log.retry_count > 0 && (
                        <span>重试: {log.retry_count} 次</span>
                      )}
                      {log.total_latency && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatLatency(log.total_latency)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* 时间 */}
                  <div className="text-xs text-slate-500 text-right ml-4 flex-shrink-0">
                    {formatTime(log.failover_time)}
                  </div>
                </div>
                
                {/* 失败详情 */}
                {log.failure_details && (
                  <details className="mt-3 ml-8">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                      查看详细错误信息
                    </summary>
                    <pre className="mt-2 p-3 bg-slate-100 rounded text-xs overflow-x-auto max-h-40">
                      {log.failure_details}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FailoverHistory;
