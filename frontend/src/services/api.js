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
  timeout: 60000,
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

// Response interceptor with automatic cold-start retry & error handling
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;
    // Detect cold-start or temporary network failure (no response or 502-504 Gateway errors)
    const isColdStartOrNetworkError =
      !error.response ||
      (error.response && error.response.status >= 502 && error.response.status <= 504);

    // Automatically retry idempotent GET requests while Render wakes up
    if (config && isColdStartOrNetworkError && (!config.method || config.method.toLowerCase() === 'get')) {
      config.__retryCount = config.__retryCount || 0;
      const MAX_RETRIES = 3;

      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        const delayMs = config.__retryCount * 2500;
        console.warn(`[API] Cloud server waking up or transient network drop. Retrying ${config.url} (Attempt ${config.__retryCount}/${MAX_RETRIES}) in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

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
