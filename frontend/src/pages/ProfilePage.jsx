import React, { useState, useEffect } from 'react';
import { Copy, RefreshCcw, Key, Lock, User as UserIcon } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

const ProfilePage = ({ user }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [passwords, setPasswords] = useState({ old: '', new: '' });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/auth/me`);
      if (response.data.success) {
        setUserInfo(response.data.user);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      if (error.response?.status === 401) {
        console.log('未登录');
      }
    }
  };

  const changePassword = async () => {
    if (!passwords.old || !passwords.new) {
      showAlert('请输入旧密码和新密码', 'error');
      return;
    }

    if (passwords.new.length < 6) {
      showAlert('新密码长度至少6位', 'error');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/change-password`, {
        oldPassword: passwords.old,
        newPassword: passwords.new
      });
      showAlert('密码修改成功！', 'success');
      setPasswords({ old: '', new: '' });
    } catch (error) {
      showAlert(error.response?.data?.error || '修改失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const regenerateApiKey = async () => {
    if (!confirm('重新生成后，旧的 API Key 将立即失效。确定要继续吗？')) {
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/users/regenerate-key`);
      if (response.data.success) {
        showAlert('API Key 已重新生成！', 'success');
        loadUserInfo();
      }
    } catch (error) {
      showAlert(error.response?.data?.error || '生成失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(userInfo?.apiKey || user?.apiKey || '').then(() => {
      showAlert('API Key 已复制到剪贴板', 'success');
    });
  };

  const showAlert = (message, type) => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in">
      {alert && (
        <div className={`p-4 rounded-2xl ${alert.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {alert.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 个人信息卡片 */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-indigo-600" />
            个人信息
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500">用户名</span>
              <span className="font-semibold text-slate-800">{userInfo?.username || user?.username || '-'}</span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-slate-100">
              <span className="text-slate-500">角色</span>
              <span className="font-semibold text-slate-800">
                {(userInfo?.role || user?.role) === 'admin' ? '管理员' : '普通用户'}
              </span>
            </div>
            
            <div className="py-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-500">API Key</span>
                <button
                  onClick={copyApiKey}
                  className="text-indigo-600 hover:text-indigo-700 transition-colors"
                  title="复制 API Key"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl font-mono text-sm text-slate-700 break-all">
                {userInfo?.apiKey || user?.apiKey || '-'}
              </div>
              <button
                onClick={regenerateApiKey}
                disabled={loading}
                className="mt-3 text-sm text-red-600 hover:text-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCcw className="w-4 h-4" />
                重新生成 API Key
              </button>
            </div>
          </div>
        </div>

        {/* 修改密码卡片 */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            修改密码
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                旧密码
              </label>
              <input
                type="password"
                value={passwords.old}
                onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="请输入旧密码"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                新密码
              </label>
              <input
                type="password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                placeholder="请输入新密码（至少6位）"
              />
            </div>
            
            <button
              onClick={changePassword}
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:bg-slate-300"
            >
              {loading ? '修改中...' : '修改密码'}
            </button>
          </div>
        </div>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Key className="w-5 h-5" />
          关于 API Key
        </h4>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• API Key 用于小旋风等外部工具调用本系统</li>
          <li>• 重新生成后，旧的 API Key 将立即失效</li>
          <li>• 请妥善保管您的 API Key，不要泄露给他人</li>
          <li>• 如需配置外部 AI API（OpenAI、Claude、Gemini 等）或默认调用设置，请前往"系统配置"页面</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfilePage;
