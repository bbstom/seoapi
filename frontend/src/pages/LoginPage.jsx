import { useState } from 'react';
import { Zap, LogIn, AlertCircle } from 'lucide-react';
import axios from 'axios';

const LoginPage = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        // 保存 token 到 localStorage
        localStorage.setItem('sessionToken', response.data.token);
        // 通知父组件登录成功
        onLoginSuccess(response.data.user);
      } else {
        setError(response.data.error || '登录失败');
      }
    } catch (err) {
      setError(err.response?.data?.error || '登录失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* 网格背景 */}
      <div className="fixed inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0"></div>

      {/* 登录卡片 */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8 animate-in slide-in-from-top duration-500">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-500 p-4 rounded-2xl shadow-xl shadow-indigo-200">
              <Zap className="text-white w-10 h-10" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            SEO API
          </h1>
          <p className="text-slate-500 text-sm">
            Claude AI 文本改写服务
          </p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border-2 border-slate-200 p-8 animate-in slide-in-from-bottom duration-500">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <LogIn className="w-5 h-5 text-indigo-600" />
            登录到您的账户
          </h2>

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top duration-300">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="请输入用户名"
                required
                autoFocus
              />
            </div>

            {/* 密码 */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 ml-1">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="请输入密码"
                required
              />
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all bg-gradient-to-r from-indigo-600 to-blue-500 text-white hover:shadow-xl hover:shadow-indigo-500/50 hover:scale-[1.02] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:scale-100 disabled:from-slate-300 disabled:to-slate-300 active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  登录
                </>
              )}
            </button>
          </form>

          {/* 默认账号提示 */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              默认账号：admin / admin123
            </p>
          </div>
        </div>

        {/* 底部信息 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-400">
            © 2024 SEO API. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
