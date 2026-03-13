import { useState, useEffect } from 'react';
import { RefreshCcw, Plus, Edit, Trash2, Save, X, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const ModesPage = () => {
  const [modes, setModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [editingMode, setEditingMode] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState({}); // 控制提示词展开/折叠

  useEffect(() => {
    loadModes();
  }, []);

  const loadModes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/modes`);
      if (response.data.modes) {
        setModes(response.data.modes);
      }
    } catch (error) {
      showAlert('加载模式失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const togglePrompt = (modeId) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [modeId]: !prev[modeId]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in">
      {alert && (
        <div className={`p-4 rounded-2xl ${alert.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {alert.message}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">改写模式管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理文本改写的各种模式和提示词</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加模式
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {modes.map((mode) => (
          <div key={mode.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-slate-800">{mode.name}</h3>
                  <code className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-mono rounded-md border border-blue-200">
                    {mode.id}
                  </code>
                  {mode.antiAI && (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                      ⭐ 反AI检测
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">{mode.description}</p>
                
                {/* 提示词折叠区域 */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => togglePrompt(mode.id)}
                    className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left"
                  >
                    <span className="text-xs text-slate-600 font-semibold">提示词详情</span>
                    {expandedPrompts[mode.id] ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                  
                  {expandedPrompts[mode.id] && (
                    <div className="p-4 bg-white border-t border-slate-200">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                        {mode.prompt}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => setEditingMode(mode)}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="编辑"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`确定要删除模式"${mode.name}"吗？`)) {
                      showAlert('删除功能开发中', 'error');
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modes.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 text-center">
          <RefreshCcw className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">暂无改写模式</p>
          <button
            onClick={() => setIsAdding(true)}
            className="mt-4 px-6 py-2 text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            添加第一个模式
          </button>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          关于改写模式
        </h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• 改写模式定义了 AI 如何处理文本改写任务</li>
          <li>• 每个模式包含特定的提示词上下文，指导 AI 的改写风格</li>
          <li>• <strong>模式ID</strong>（如 <code className="px-1.5 py-0.5 bg-white rounded text-xs">seo_original</code>）用于 API 调用和数据看板中识别模式</li>
          <li>• 标记为"反AI检测"的模式会生成更接近人类写作风格的内容</li>
          <li>• 可以根据不同场景创建多个模式（如：学术、营销、新闻等）</li>
          <li>• 模式配置存储在 config/rewrite-modes.js 文件中</li>
        </ul>
      </div>
    </div>
  );
};

export default ModesPage;
