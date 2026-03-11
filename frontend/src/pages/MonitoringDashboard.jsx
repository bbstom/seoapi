import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, Clock, Server, RefreshCw } from 'lucide-react';
import axios from 'axios';
import StatsCard from '../components/StatsCard';

const API_BASE = '/api';

const MonitoringDashboard = ({ showToast }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [nodesStats, setNodesStats] = useState([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
    // 每30秒自动刷新
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 并行加载数据
      const [overviewRes, nodesRes] = await Promise.all([
        axios.get(`${API_BASE}/stats/overview`, {
          params: dateRange
        }),
        axios.get(`${API_BASE}/stats/nodes`, {
          params: dateRange
        })
      ]);

      if (overviewRes.data.success) {
        setOverview(overviewRes.data.overview);
      }

      if (nodesRes.data.success) {
        setNodesStats(nodesRes.data.nodes);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      showToast?.('加载数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toString() || '0';
  };

  const formatLatency = (ms) => {
    if (!ms) return '0ms';
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return Math.round(ms) + 'ms';
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">监控仪表板</h2>
          <p className="text-sm text-slate-500 mt-1">实时监控AI节点性能和健康状态</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-lg font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新数据
        </button>
      </div>

      {/* 日期范围选择 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-slate-700">时间范围：</label>
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
          <span className="text-slate-500">至</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
          />
        </div>
      </div>

      {loading && !overview ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* 总览统计卡片 */}
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="总请求数"
                value={formatNumber(overview.total_requests || 0)}
                subtitle={`成功 ${overview.success_requests || 0} / 失败 ${overview.failed_requests || 0}`}
                icon={Activity}
                color="indigo"
              />
              <StatsCard
                title="成功率"
                value={`${Number(overview.success_rate || 0).toFixed(1)}%`}
                subtitle={Number(overview.success_rate || 0) >= 95 ? '健康' : '需要关注'}
                icon={CheckCircle}
                color={Number(overview.success_rate || 0) >= 95 ? 'green' : 'yellow'}
              />
              <StatsCard
                title="平均延迟"
                value={formatLatency(overview.avg_latency)}
                subtitle={`最小 ${formatLatency(overview.min_latency)} / 最大 ${formatLatency(overview.max_latency)}`}
                icon={Clock}
                color="blue"
              />
              <StatsCard
                title="在线节点"
                value={`${overview.online_nodes || 0} / ${overview.total_nodes || 0}`}
                subtitle={overview.online_nodes === overview.total_nodes ? '全部在线' : '部分离线'}
                icon={Server}
                color={overview.online_nodes === overview.total_nodes ? 'green' : 'red'}
              />
            </div>
          )}

          {/* 节点性能列表 */}
          {nodesStats.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-900">节点性能统计</h3>
                <p className="text-sm text-slate-500 mt-1">各节点的详细性能数据</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase">节点名称</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase">总请求</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase">成功率</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase">平均延迟</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase">最小延迟</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-600 uppercase">最大延迟</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {nodesStats.map((node) => (
                      <tr key={node.node_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-slate-900">{node.node_name || `节点 ${node.node_id}`}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-slate-700">{formatNumber(node.total_requests)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            Number(node.success_rate || 0) >= 95 
                              ? 'bg-green-100 text-green-800' 
                              : Number(node.success_rate || 0) >= 80
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {Number(node.success_rate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-slate-700">{formatLatency(node.avg_latency)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-slate-500">{formatLatency(node.min_latency)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-slate-500">{formatLatency(node.max_latency)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 空状态 */}
          {!loading && nodesStats.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <Activity className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-2">暂无统计数据</p>
              <p className="text-sm text-slate-400">请先添加AI节点并进行API调用</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MonitoringDashboard;
