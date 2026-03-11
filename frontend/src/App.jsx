import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FileEdit, BarChart3, Key, Settings, RefreshCcw, User, FileText, LogOut, 
  Sparkles, Zap, ChevronDown, Copy, Menu, X, CheckCircle, XCircle, AlertCircle, Info, Activity, BookOpen
} from 'lucide-react';
import axios from 'axios';
import ProfilePage from './pages/ProfilePage';
import SystemPage from './pages/SystemPage';
import ModesPage from './pages/ModesPage';
import DashboardPage from './pages/DashboardPage';
import TokensPage from './pages/TokensPage';
import ApiDocsPage from './pages/ApiDocsPage';
import UserGuidePage from './pages/UserGuidePage';
import LoginPage from './pages/LoginPage';
import MonitoringDashboard from './pages/MonitoringDashboard';
import FailoverHistory from './pages/FailoverHistory';
import AlertManagement from './pages/AlertManagement';

// API 配置
const API_BASE = '/api';

// 配置 axios 拦截器，自动添加会话 token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      config.headers['x-session-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 全局通知组件
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  };

  const styles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-blue-500 text-white'
  };

  return (
    <div className="fixed top-20 right-8 z-50 animate-in slide-in-from-right duration-300">
      <div className={`${styles[type]} rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-3 min-w-[320px] max-w-md`}>
        <div className="flex-shrink-0">
          {icons[type]}
        </div>
        <p className="flex-1 font-medium text-sm">{message}</p>
        <button 
          onClick={onClose}
          className="flex-shrink-0 hover:bg-white/20 rounded-lg p-1 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const App = () => {
  // 从 localStorage 恢复上次的页面状态
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'rewrite';
  });
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [expandedMenu, setExpandedMenu] = useState('docs'); // 展开的子菜单
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [configRefreshTrigger, setConfigRefreshTrigger] = useState(0); // 配置刷新触发器

  // 保存页面状态到 localStorage
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // 全局通知函数
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // 触发配置刷新
  const triggerConfigRefresh = () => {
    setConfigRefreshTrigger(prev => prev + 1);
  };

  // 检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // 检查 localStorage 中是否有 token
      const token = localStorage.getItem('sessionToken');
      
      if (token) {
        // 有 token，验证是否有效
        const response = await axios.get(`${API_BASE}/auth/me`);
        if (response.data && response.data.success) {
          setUser(response.data.user);
          setLoading(false);
          return;
        }
      }
      
      // 没有 token 或 token 无效，显示登录页面
      setUser(null);
    } catch (error) {
      console.error('认证失败:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 登录成功回调
  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
    } catch (error) {
      console.error('退出失败:', error);
    } finally {
      // 无论成功失败，都清除本地 token 并重置用户状态
      localStorage.removeItem('sessionToken');
      setUser(null);
      setActiveTab('rewrite');
      showToast('已退出登录', 'success');
    }
  };

  const menuItems = [
    { id: 'rewrite', name: '文本改写', icon: FileEdit },
    { id: 'dashboard', name: '数据看板', icon: BarChart3 },
    { id: 'system', name: 'API 管理', icon: Settings },
    { id: 'modes', name: '改写模式', icon: RefreshCcw },
    { id: 'tokens', name: '令牌管理', icon: Key },
    { id: 'monitoring', name: '监控运维', icon: Activity },
    { 
      id: 'docs', 
      name: '系统文档', 
      icon: BookOpen,
      submenu: [
        { id: 'api', name: 'API 文档', icon: FileText },
        { id: 'guide', name: '用户指南', icon: BookOpen }
      ]
    },
    { id: 'profile', name: '个人中心', icon: User },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 如果未登录，显示登录页面
  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* 全局通知 */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      {/* 网格背景 */}
      <div className="fixed inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0"></div>

      {/* 侧边栏 */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-20 relative ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-2 rounded-xl shadow-lg shadow-indigo-200">
              <Zap className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                SEO API
              </span>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)} 
            className="p-1 hover:bg-slate-100 rounded-md transition-colors"
          >
            {isSidebarOpen ? <X className="w-4 h-4 text-slate-400" /> : <Menu className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (item.submenu) {
                    setExpandedMenu(expandedMenu === item.id ? null : item.id);
                  } else {
                    setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-all group ${
                  activeTab === item.id || (item.submenu && item.submenu.some(sub => sub.id === activeTab))
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100' 
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${
                  activeTab === item.id || (item.submenu && item.submenu.some(sub => sub.id === activeTab)) ? 'text-indigo-600' : ''
                }`} />
                {isSidebarOpen && (
                  <>
                    <span className="font-medium text-sm flex-1 text-left">{item.name}</span>
                    {item.submenu && (
                      <ChevronDown className={`w-4 h-4 transition-transform ${expandedMenu === item.id ? 'rotate-180' : ''}`} />
                    )}
                  </>
                )}
              </button>
              {item.submenu && expandedMenu === item.id && isSidebarOpen && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.submenu.map((subItem) => (
                    <button
                      key={subItem.id}
                      onClick={() => setActiveTab(subItem.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
                        activeTab === subItem.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <subItem.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{subItem.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-3 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            {isSidebarOpen && <span className="font-medium text-sm">退出登录</span>}
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* 顶部栏 */}
        <header className="h-20 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="animate-in">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              {menuItems.find(m => m.id === activeTab)?.name}
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              工作台 / {menuItems.find(m => m.id === activeTab)?.name}
            </p>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden md:flex bg-slate-100/80 px-4 py-2 rounded-full items-center gap-3 border border-slate-200/50">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping absolute inset-0"></div>
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full relative"></div>
              </div>
              <span className="text-xs font-semibold text-slate-600">服务正常运行</span>
            </div>
            <div className="w-10 h-10 rounded-xl border-2 border-white shadow-md ring-1 ring-slate-100 bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'rewrite' && <RewritePage user={user} showToast={showToast} configRefreshTrigger={configRefreshTrigger} />}
          {activeTab === 'dashboard' && <DashboardPage showToast={showToast} />}
          {activeTab === 'tokens' && <TokensPage showToast={showToast} />}
          {activeTab === 'system' && <SystemPage user={user} showToast={showToast} onConfigChange={triggerConfigRefresh} />}
          {activeTab === 'modes' && <ModesPage showToast={showToast} />}
          {activeTab === 'monitoring' && <MonitoringPage showToast={showToast} />}
          {activeTab === 'api' && <ApiDocsPage showToast={showToast} />}
          {activeTab === 'guide' && <UserGuidePage showToast={showToast} />}
          {activeTab === 'profile' && <ProfilePage user={user} showToast={showToast} />}
        </div>
      </main>
    </div>
  );
};

// 文本改写页面组件（全新优化版）文本改写页面组件（全新优化版 - 上下布局）
const RewritePage = ({ user, showToast, configRefreshTrigger }) => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteMode, setRewriteMode] = useState('');
  const [selectedApiConfig, setSelectedApiConfig] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [apiConfigs, setApiConfigs] = useState([]);
  const [models, setModels] = useState([]);
  const [modes, setModes] = useState([]);
  const [stats, setStats] = useState(null);
  const [typingEffect, setTypingEffect] = useState(false);

  useEffect(() => {
    loadApiConfigs();
    loadModes();
  }, []);

  // 监听配置刷新触发器
  useEffect(() => {
    if (configRefreshTrigger > 0) {
      loadApiConfigs();
    }
  }, [configRefreshTrigger]);

  const loadApiConfigs = async () => {
    try {
      // 加载API配置列表
      const configsResponse = await axios.get(`${API_BASE}/api-configs`);
      if (configsResponse.data.success) {
        setApiConfigs(configsResponse.data.configs || []);
      }

      // 加载默认配置
      const defaultsResponse = await axios.get(`${API_BASE}/auth/me`);
      if (defaultsResponse.data.success) {
        const userData = defaultsResponse.data.user;
        
        // 设置默认API配置
        const defaultConfigId = userData.defaultConfigId ? String(userData.defaultConfigId) : '';
        setSelectedApiConfig(defaultConfigId);
        
        // 设置默认模式
        setRewriteMode(userData.defaultMode || '');
        
        // 加载默认配置的模型列表
        if (defaultConfigId && configsResponse.data.configs) {
          const defaultConfig = configsResponse.data.configs.find(c => c.id === parseInt(defaultConfigId));
          if (defaultConfig && defaultConfig.models) {
            setModels(defaultConfig.models);
            // 设置默认模型
            setSelectedModel(userData.defaultModel || (defaultConfig.models[0] || ''));
          }
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  const loadModes = async () => {
    try {
      const response = await axios.get(`${API_BASE}/modes`);
      if (response.data.modes) {
        setModes(response.data.modes);
        // 不自动设置模式，让用户选择或使用默认配置
      }
    } catch (error) {
      console.error('加载模式失败:', error);
    }
  };

  const handleRewrite = async () => {
    if (!inputText.trim()) {
      showToast('请输入要改写的文本', 'warning');
      return;
    }
    
    setIsRewriting(true);
    setOutputText('');
    setStats(null);
    setTypingEffect(true);

    try {
      // 构建请求参数，空值表示使用默认配置
      const requestData = {
        text: inputText,
        sim: 1
      };
      
      // 只有手动指定时才传递这些参数
      if (rewriteMode) requestData.mode = rewriteMode;
      if (selectedApiConfig) requestData.config_id = parseInt(selectedApiConfig);
      if (selectedModel) requestData.model = selectedModel;

      const response = await axios.post(`${API_BASE}/rewrite`, requestData, {
        headers: {
          'Authorization': user?.apiKey
        }
      });

      if (response.data.errcode === '0') {
        // 打字机效果
        const fullText = response.data.data;
        let currentIndex = 0;
        const typingSpeed = Math.max(1, Math.floor(fullText.length / 100));
        
        const typeInterval = setInterval(() => {
          if (currentIndex < fullText.length) {
            setOutputText(fullText.substring(0, currentIndex + typingSpeed));
            currentIndex += typingSpeed;
          } else {
            setOutputText(fullText);
            setTypingEffect(false);
            clearInterval(typeInterval);
          }
        }, 10);
        
        const meta = response.data._meta || {};
        const usage = meta.usage || {};
        
        setStats({
          duration: meta.duration ? parseFloat(meta.duration).toFixed(2) : '-',
          similarity: response.data.like ? (parseFloat(response.data.like) * 100).toFixed(1) : '-',
          inputTokens: usage.input_tokens || '-',
          outputTokens: usage.output_tokens || '-'
        });
        
        showToast('改写成功！', 'success');
      } else {
        throw new Error(response.data.errmsg || '改写失败');
      }
    } catch (error) {
      showToast(error.message || '请求失败', 'error');
      setTypingEffect(false);
    } finally {
      setIsRewriting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      showToast('已复制到剪贴板', 'success');
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  };

  const loadExample = () => {
    const examples = [
      '人工智能技术正在快速发展，它已经深入到我们生活的方方面面。从智能手机到自动驾驶汽车，从医疗诊断到金融分析，AI的应用无处不在。',
      '随着互联网的普及，电子商务已经成为现代商业的重要组成部分。越来越多的消费者选择在线购物，这不仅方便快捷，而且选择更加丰富。',
      '健康的生活方式包括均衡的饮食、适量的运动和充足的睡眠。保持良好的生活习惯可以有效预防许多疾病，提高生活质量。'
    ];
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setInputText(randomExample);
    showToast('已加载示例文本', 'info');
  };

  // 计算字数统计
  const inputStats = {
    chars: inputText.length,
    words: inputText.trim() ? inputText.trim().split(/\s+/).length : 0,
    lines: inputText.split('\n').length
  };

  const outputStats = {
    chars: outputText.length,
    words: outputText.trim() ? outputText.trim().split(/\s+/).length : 0,
    lines: outputText.split('\n').length
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in">
      {/* 顶部工具栏 */}
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            改写配置
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> 改写模式
              </label>
              <div className="relative">
                <select 
                  value={rewriteMode}
                  onChange={(e) => setRewriteMode(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:border-indigo-300"
                >
                  <option value="">使用默认模式</option>
                  {modes.map(mode => (
                    <option key={mode.id} value={mode.id}>
                      {mode.name} - {mode.description} {mode.antiAI ? '⭐' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-indigo-500" /> API 节点
              </label>
              <div className="relative">
                <select 
                  value={selectedApiConfig}
                  onChange={(e) => {
                    const configId = e.target.value;
                    setSelectedApiConfig(configId);
                    
                    // 更新模型列表
                    if (configId) {
                      const config = apiConfigs.find(c => c.id === parseInt(configId));
                      if (config && config.models) {
                        setModels(config.models);
                        setSelectedModel(config.models[0] || '');
                      }
                    } else {
                      setModels([]);
                      setSelectedModel('');
                    }
                  }}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:border-indigo-300"
                >
                  <option value="">使用默认节点</option>
                  {apiConfigs.filter(c => c.is_active).map(config => (
                    <option key={config.id} value={config.id}>
                      {config.name} {config.is_default ? '(默认)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-indigo-500" /> AI 模型
              </label>
              <div className="relative">
                <select 
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer hover:border-indigo-300"
                  disabled={!selectedApiConfig && models.length === 0}
                >
                  <option value="">使用默认模型</option>
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
          <button
            onClick={loadExample}
            className="text-xs font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-all flex items-center gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            加载示例
          </button>
          <button
            onClick={() => setInputText('')}
            className="text-xs font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-2"
          >
            <X className="w-3.5 h-3.5" />
            清空输入
          </button>
          {outputText && (
            <button
              onClick={() => setOutputText('')}
              className="text-xs font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all flex items-center gap-2"
            >
              <X className="w-3.5 h-3.5" />
              清空输出
            </button>
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-300/50">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-sm font-bold text-slate-700">原始文本</span>
            <div className="flex items-center gap-4 ml-4 text-xs text-slate-500">
              <span>{inputStats.chars} 字符</span>
              <span>{inputStats.words} 词</span>
              <span>{inputStats.lines} 行</span>
            </div>
          </div>
        </div>
        <textarea 
          className="w-full p-6 text-sm text-slate-700 focus:outline-none resize-none placeholder:text-slate-300 leading-relaxed min-h-[200px] max-h-[400px]"
          placeholder="在此输入或粘贴需要改写的文本内容...&#10;&#10;支持长文本改写，系统会自动分段处理"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        />
      </div>

      {/* 改写按钮 */}
      <div className="flex justify-center">
        <button 
          onClick={handleRewrite}
          disabled={isRewriting || !inputText.trim()}
          className="group relative px-12 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:scale-100 disabled:from-slate-200 disabled:to-slate-200 active:scale-95 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative flex items-center gap-3">
            {isRewriting ? (
              <>
                <RefreshCcw className="w-5 h-5 animate-spin" />
                <span className="animate-pulse">AI 正在改写中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
                <span>开始 AI 改写</span>
                <Zap className="w-4 h-4 group-hover:animate-bounce" />
              </>
            )}
          </div>
        </button>
      </div>

      {/* 输出区域 */}
      {(outputText || isRewriting) && (
        <div className="bg-white rounded-2xl shadow-lg shadow-indigo-200/50 border border-indigo-200 overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-300/50 animate-in">
          <div className="px-6 py-4 border-b border-indigo-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/50 to-blue-50/30">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-sm font-bold text-slate-700">改写结果</span>
              {outputText && (
                <div className="flex items-center gap-4 ml-4 text-xs text-slate-500">
                  <span>{outputStats.chars} 字符</span>
                  <span>{outputStats.words} 词</span>
                  <span>{outputStats.lines} 行</span>
                </div>
              )}
            </div>
            {outputText && !typingEffect && (
              <button 
                onClick={copyToClipboard}
                className="text-indigo-600 hover:text-indigo-700 transition-all hover:scale-110 active:scale-95 p-2 rounded-lg hover:bg-indigo-50 flex items-center gap-2 text-xs font-medium"
              >
                <Copy className="w-4 h-4" />
                复制
              </button>
            )}
          </div>
          <div className="p-6 min-h-[200px] max-h-[400px] overflow-y-auto">
            {isRewriting ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-indigo-600 mb-6">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="font-medium animate-pulse">AI 正在生成改写内容...</span>
                </div>
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg w-full"></div>
                  <div className="h-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg w-5/6"></div>
                  <div className="h-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg w-4/6"></div>
                  <div className="h-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg w-5/6"></div>
                  <div className="h-4 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-lg w-3/6"></div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {outputText}
                {typingEffect && <span className="inline-block w-0.5 h-4 bg-indigo-600 animate-pulse ml-1"></span>}
              </div>
            )}
          </div>
          
          {stats && !typingEffect && (
            <div className="px-6 py-4 border-t border-indigo-100 bg-gradient-to-r from-indigo-50/30 to-blue-50/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-xl bg-white/50 hover:bg-white transition-all group hover:scale-105">
                  <div className="text-xs text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">处理耗时</div>
                  <div className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stats.duration}s</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/50 hover:bg-white transition-all group hover:scale-105">
                  <div className="text-xs text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">相似度</div>
                  <div className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stats.similarity}%</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/50 hover:bg-white transition-all group hover:scale-105">
                  <div className="text-xs text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">输入 Token</div>
                  <div className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stats.inputTokens}</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-white/50 hover:bg-white transition-all group hover:scale-105">
                  <div className="text-xs text-slate-500 mb-1 group-hover:text-indigo-600 transition-colors">输出 Token</div>
                  <div className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{stats.outputTokens}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 使用提示 */}
      {!outputText && !isRewriting && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800 mb-2">使用提示</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>支持长文本改写，系统会自动分段处理并保持上下文连贯</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>可以选择不同的改写模式和 AI 模型以获得最佳效果</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>改写结果会显示相似度、Token 使用量等详细统计信息</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span>点击"加载示例"可以快速体验改写功能</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 监控运维页面组件
const MonitoringPage = ({ showToast }) => {
  const [activeSubTab, setActiveSubTab] = useState('dashboard');

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in">
      {/* 子标签导航 */}
      <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveSubTab('dashboard')}
            className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
              activeSubTab === 'dashboard'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            监控仪表板
          </button>
          <button
            onClick={() => setActiveSubTab('failover')}
            className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
              activeSubTab === 'failover'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            故障转移历史
          </button>
          <button
            onClick={() => setActiveSubTab('alerts')}
            className={`px-6 py-3 font-semibold text-sm transition-all whitespace-nowrap ${
              activeSubTab === 'alerts'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            告警管理
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeSubTab === 'dashboard' && <MonitoringDashboard showToast={showToast} />}
      {activeSubTab === 'failover' && <FailoverHistory showToast={showToast} />}
      {activeSubTab === 'alerts' && <AlertManagement showToast={showToast} />}
    </div>
  );
};

export default App;
