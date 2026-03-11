import { useState, useEffect } from 'react';
import { FileEdit, CheckCircle, XCircle, Clock, TrendingDown, TrendingUp, Filter, Search, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const DashboardPage = ({ showToast }) => {
  const [stats, setStats] = useState({
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    avgDuration: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    recentLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all', // all, success, failed
    model: 'all',
    mode: 'all',
    search: '',
    dateRange: 'all', // all, today, week, month, custom
    startDate: '',
    endDate: ''
  });
  const [tempDateRange, setTempDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [availableModels, setAvailableModels] = useState([]);
  const [availableModes, setAvailableModes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    loadStats();
  }, [currentPage, filters]); // 当页码或过滤条件改变时重新加载

  const loadStats = async () => {
    setLoading(true);
    try {
      // 构建查询参数
      const params = new URLSearchParams({
        page: currentPage,
        limit: pageSize
      });
      
      // 添加过滤条件
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.model !== 'all') params.append('model', filters.model);
      if (filters.mode !== 'all') params.append('mode', filters.mode);
      if (filters.search) params.append('search', filters.search);
      
      // 添加时间过滤
      if (filters.dateRange !== 'all') {
        if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
          params.append('startDate', filters.startDate);
          params.append('endDate', filters.endDate);
        } else {
          params.append('dateRange', filters.dateRange);
        }
      }
      
      // 加载当前页的日志
      const logsResponse = await axios.get(`${API_BASE}/logs?${params.toString()}`);
      const logs = logsResponse.data.logs || [];
      const total = logsResponse.data.total || 0;
      
      setTotalRecords(total);
      
      // 加载统计数据（使用相同的过滤参数）
      const statsResponse = await axios.get(`${API_BASE}/logs/stats?${params.toString()}`);
      const statsData = statsResponse.data;
      
      // 提取可用的模型和模式（从当前页）
      const models = [...new Set(logs.map(log => log.model).filter(Boolean))];
      const modes = [...new Set(logs.map(log => log.mode).filter(Boolean))];

      setAvailableModels(models);
      setAvailableModes(modes);

      setStats({
        totalCalls: statsData.totalCalls || 0,
        successCalls: statsData.successCalls || 0,
        failedCalls: statsData.failedCalls || 0,
        avgDuration: statsData.avgDuration || 0,
        totalInputTokens: statsData.totalInputTokens || 0,
        totalOutputTokens: statsData.totalOutputTokens || 0,
        recentLogs: logs
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
      if (showToast) showToast('加载统计数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 过滤日志（现在由后端处理，前端不需要过滤）
  const filteredLogs = stats.recentLogs;

  // 分页逻辑（现在由后端处理）
  const totalPages = Math.ceil(totalRecords / pageSize);
  const paginatedLogs = filteredLogs; // 直接使用后端返回的数据

  // 重置页码当过滤条件改变时（排除临时日期范围）
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.status, filters.model, filters.mode, filters.search, filters.dateRange, filters.startDate, filters.endDate]);

  const handleRefresh = () => {
    setLoading(true);
    loadStats();
  };

  const handleApplyDateRange = () => {
    setFilters({
      ...filters,
      startDate: tempDateRange.startDate,
      endDate: tempDateRange.endDate
    });
  };

  const handleDateRangeChange = (value) => {
    setFilters({ ...filters, dateRange: value });
    if (value !== 'custom') {
      // 非自定义时间，清空临时日期
      setTempDateRange({ startDate: '', endDate: '' });
    }
  };

  const handleExport = async () => {
    try {
      // 导出所有数据（不分页）
      const params = new URLSearchParams({ limit: 10000 });
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.model !== 'all') params.append('model', filters.model);
      if (filters.mode !== 'all') params.append('mode', filters.mode);
      if (filters.search) params.append('search', filters.search);
      
      // 添加时间过滤
      if (filters.dateRange !== 'all') {
        if (filters.dateRange === 'custom' && filters.startDate && filters.endDate) {
          params.append('startDate', filters.startDate);
          params.append('endDate', filters.endDate);
        } else {
          params.append('dateRange', filters.dateRange);
        }
      }
      
      const response = await axios.get(`${API_BASE}/logs?${params.toString()}`);
      const allLogs = response.data.logs || [];
      
      // 导出为 CSV
      const headers = ['时间', '用户', '模型', '模式', '状态', '耗时(s)', '输入Tokens', '输出Tokens'];
      const rows = allLogs.map(log => {
        const usage = log.usage ? (typeof log.usage === 'string' ? JSON.parse(log.usage) : log.usage) : {};
        return [
          formatDate(log.timestamp),
          log.username || '-',
          log.model || '-',
          log.mode || '-',
          (log.status === 'success' || log.errcode === '0') ? '成功' : '失败',
          log.duration || '-',
          usage.input_tokens || '-',
          usage.output_tokens || '-'
        ];
      });
      
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `活动记录_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      if (showToast) showToast('导出成功', 'success');
    } catch (error) {
      console.error('导出失败:', error);
      if (showToast) showToast('导出失败', 'error');
    }
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
      {/* 紧凑的统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <FileEdit className="w-4 h-4 text-indigo-600" />
            <p className="text-xs text-slate-500 font-medium">总调用次数</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatNumber(stats.totalCalls)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <p className="text-xs text-slate-500 font-medium">成功次数</p>
          </div>
          <p className="text-xl font-bold text-green-600">{formatNumber(stats.successCalls)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <p className="text-xs text-slate-500 font-medium">失败次数</p>
          </div>
          <p className="text-xl font-bold text-red-600">{formatNumber(stats.failedCalls)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-slate-500 font-medium">平均耗时</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{stats.avgDuration}s</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-slate-500 font-medium">总输入 Tokens</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatNumber(stats.totalInputTokens)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <p className="text-xs text-slate-500 font-medium">总输出 Tokens</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{formatNumber(stats.totalOutputTokens)}</p>
        </div>
      </div>

      {/* 过滤和操作栏 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* 第一行：搜索框 + 过滤器 */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="搜索用户、模型或模式..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">全部状态</option>
              <option value="success">✅ 成功</option>
              <option value="failed">❌ 失败</option>
            </select>

            <select
              value={filters.model}
              onChange={(e) => setFilters({ ...filters, model: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">全部模型</option>
              {availableModels.map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>

            <select
              value={filters.mode}
              onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">全部模式</option>
              {availableModes.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => handleDateRangeChange(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">全部时间</option>
              <option value="today">今天</option>
              <option value="week">最近7天</option>
              <option value="month">最近30天</option>
              <option value="custom">自定义时间</option>
            </select>

            <button
              onClick={handleRefresh}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>

            <button
              onClick={handleExport}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          </div>

          {/* 自定义时间范围 */}
          {filters.dateRange === 'custom' && (
            <div className="flex gap-2 items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-sm text-slate-600 font-medium">时间范围：</span>
              <input
                type="date"
                value={tempDateRange.startDate}
                onChange={(e) => setTempDateRange({ ...tempDateRange, startDate: e.target.value })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
              <span className="text-sm text-slate-600">至</span>
              <input
                type="date"
                value={tempDateRange.endDate}
                onChange={(e) => setTempDateRange({ ...tempDateRange, endDate: e.target.value })}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
              />
              <button
                onClick={handleApplyDateRange}
                disabled={!tempDateRange.startDate || !tempDateRange.endDate}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                应用
              </button>
              <button
                onClick={() => {
                  setTempDateRange({ startDate: '', endDate: '' });
                  setFilters({ ...filters, dateRange: 'all', startDate: '', endDate: '' });
                }}
                className="px-4 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 过滤结果提示 */}
        {(filters.status !== 'all' || filters.model !== 'all' || filters.mode !== 'all' || filters.search || filters.dateRange !== 'all') && (
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <Filter className="w-3.5 h-3.5" />
            <span>显示 {totalRecords} 条记录</span>
            <button
              onClick={() => {
                setFilters({ status: 'all', model: 'all', mode: 'all', search: '', dateRange: 'all', startDate: '', endDate: '' });
                setTempDateRange({ startDate: '', endDate: '' });
              }}
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              清除过滤
            </button>
          </div>
        )}
      </div>

      {/* 活动记录表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">时间</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">用户</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">模型</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">模式</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">失败原因</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">耗时</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">输入</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">输出</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length > 0 ? (
                paginatedLogs.map((log, index) => {
                  // 安全解析 usage
                  let usage = {};
                  try {
                    if (log.usage) {
                      usage = typeof log.usage === 'string' ? JSON.parse(log.usage) : log.usage;
                    }
                  } catch (e) {
                    console.error('解析 usage 失败:', e);
                  }
                  
                  const isSuccess = log.status === 'success' || log.errcode === '0';
                  const errorMsg = log.errorMessage || log.error_message || log.error || log.errmsg || '';
                  
                  return (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(log.timestamp || log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">
                        {log.username || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 group relative">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                          {log.model && log.model.length > 8 ? `${log.model.substring(0, 8)}...` : (log.model || '-')}
                        </span>
                        {log.model && log.model.length > 8 && (
                          <div className="invisible group-hover:visible absolute z-10 left-0 top-full mt-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                            {log.model}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                          {log.mode || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              成功
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              失败
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 group relative">
                        {!isSuccess && errorMsg ? (
                          <>
                            <span className="text-xs text-red-600 border-b border-dotted border-red-400">
                              {errorMsg.length > 8 ? `${errorMsg.substring(0, 8)}...` : errorMsg}
                            </span>
                            {errorMsg.length > 8 && (
                              <div className="invisible group-hover:visible absolute z-10 left-0 top-full mt-1 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg max-w-md break-words pointer-events-auto select-text">
                                {errorMsg}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right font-mono">
                        {log.duration ? `${parseFloat(log.duration).toFixed(2)}s` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right font-mono">
                        {(usage.input_tokens || log.inputTokens || log.input_tokens) ? formatNumber(usage.input_tokens || log.inputTokens || log.input_tokens) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right font-mono">
                        {(usage.output_tokens || log.outputTokens || log.output_tokens) ? formatNumber(usage.output_tokens || log.outputTokens || log.output_tokens) : '-'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Filter className="w-12 h-12 text-slate-300" />
                      <p className="text-slate-500">没有找到匹配的记录</p>
                      <button
                        onClick={() => setFilters({ status: 'all', model: 'all', mode: 'all', search: '' })}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        清除过滤条件
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
        </table>

        {/* 分页控件 */}
        {totalRecords > 0 && totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              显示第 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalRecords)} 条，共 {totalRecords} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // 只显示当前页附近的页码
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          currentPage === page
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 hover:bg-white'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return <span key={page} className="px-2 text-slate-400">...</span>;
                  }
                  return null;
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
