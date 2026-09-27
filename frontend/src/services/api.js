import axios from 'axios';

/**
 * Intelligent Dynamic API URL resolver
 * Automatically supports:
 * - Production cloud / Vercel with VITE_API_URL
 * - Localhost single laptop
 * - Multiple laptops / PCs on local Wi-Fi / LAN (resolves to host machine hostname automatically)
 * - Custom overrides via localStorage ('govtfund_api_host')
 */
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('govtfund_api_host');
    if (saved) {
      return saved.endsWith('/api') ? saved : `${saved}/api`;
    }
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname) {
    const host = window.location.hostname;
    // If accessing from another machine on LAN (e.g. 192.168.x.x, 10.x.x.x, etc.)
    if (host !== 'localhost' && host !== '127.0.0.1') {
      const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
      return `${proto}//${host}:5000/api`;
    }
  }

  return 'http://127.0.0.1:5000/api';
};

export const getWsUrl = () => {
  const apiBase = getApiBaseUrl();
  try {
    const url = new URL(apiBase);
    const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
    // If apiBase was http://ip:5000/api, ws URL is ws://ip:5000/ws
    return `${wsProto}//${url.host}/ws`;
  } catch (e) {
    if (typeof window !== 'undefined' && window.location.hostname) {
      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname || '127.0.0.1';
      return `${wsProto}//${host}:5000/ws`;
    }
    return 'ws://127.0.0.1:5000/ws';
  }
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dynamic base URL check on request & attach JWT token
api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  const token = localStorage.getItem('govtfund_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor with error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      if (error.response.status === 401 && !window.location.href.includes('login')) {
        localStorage.removeItem('govtfund_token');
        localStorage.removeItem('govtfund_user');
      }
      return Promise.reject(error.response.data || { message: error.message });
    }
    return Promise.reject({ message: error.message || 'Network connection failed' });
  }
);

export default api;
