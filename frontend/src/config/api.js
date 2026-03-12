/**
 * API 配置
 * 
 * 使用方法：
 * 1. 复制 .env.example 为 .env
 * 2. 设置 VITE_API_BASE_URL
 * 3. 重新构建前端
 */

// 获取环境变量中的 API 地址
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

/**
 * 获取完整的 API URL
 * @param {string} path - API 路径，如 '/api/auth/login'
 * @returns {string} 完整的 API URL
 */
export function getApiUrl(path) {
  // 如果 path 已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // 如果配置了 API_BASE_URL，拼接完整地址
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }
  
  // 否则使用相对路径（同域名或使用 Vite 代理）
  return path;
}

export default {
  baseURL: API_BASE_URL,
  getApiUrl
};
