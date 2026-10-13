import axios from 'axios';

export const DEFAULT_LOCAL_BACKEND = 'http://127.0.0.1:5000';
export const DEFAULT_CLOUD_BACKEND = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : 'https://government-fund-allocation-over.onrender.com';

/**
 * Intelligent Dynamic API URL resolver
 * Automatically supports:
 * - Production cloud / Vercel default with VITE_API_URL
 * - Localhost single laptop default
 * - Custom overrides via localStorage ('govtfund_api_host')
 */
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('govtfund_api_host');
    if (saved && saved.trim()) {
      const clean = saved.trim().replace(/\/+$/, '');
      return clean.endsWith('/api') ? clean : `${clean}/api`;
    }
  }

  // If running locally in browser on laptop without explicit override, use local backend
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://127.0.0.1:5000/api';
  }

  // Deployed default (Vercel cloud)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return 'https://government-fund-allocation-over.onrender.com/api';
};

export const getApiConnectionDetails = () => {
  const currentBase = getApiBaseUrl();
  const saved = typeof window !== 'undefined' ? localStorage.getItem('govtfund_api_host') : null;
  const isLocalHost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  let mode = 'CLOUD';
  if (saved && saved.trim()) {
    if (saved.includes('127.0.0.1:5000') || saved.includes('localhost:5000')) {
      mode = 'LOCAL';
    } else if (saved.includes('onrender.com')) {
      mode = 'CLOUD';
    } else {
      mode = 'CUSTOM';
    }
  } else {
    mode = isLocalHost ? 'LOCAL' : 'CLOUD';
  }

  return {
    currentBaseUrl: currentBase,
    currentHost: currentBase.replace(/\/api\/?$/, ''),
    mode,
    isLocalTarget: currentBase.includes('127.0.0.1') || currentBase.includes('localhost'),
    hasCustomOverride: Boolean(saved && saved.trim()),
    defaultCloudUrl: DEFAULT_CLOUD_BACKEND,
    defaultLocalUrl: DEFAULT_LOCAL_BACKEND,
  };
};

export const setApiHost = (host) => {
  if (typeof window === 'undefined') return;
  if (!host || !host.trim()) {
    localStorage.removeItem('govtfund_api_host');
  } else {
    const clean = host.trim().replace(/\/+$/, '');
    localStorage.setItem('govtfund_api_host', clean);
  }
  window.dispatchEvent(new CustomEvent('govtfund_api_host_changed', { detail: { host } }));
};

export const resetApiHost = () => {
  setApiHost(null);
};

export const testBackendHealth = async (targetHost = null) => {
  const host = (targetHost || getApiConnectionDetails().currentHost).replace(/\/+$/, '');
  const url = `${host}/api/health`;
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    if (!res.ok) {
      return {
        success: false,
        latency,
        status: res.status,
        error: `Server returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = await res.json();
    return {
      success: true,
      latency,
      status: res.status,
      data,
    };
  } catch (err) {
    const latency = Date.now() - startTime;
    let hint = '';

    if (err.name === 'AbortError') {
      hint = 'Connection timed out after 7s. Please verify the backend process is running.';
    } else if (typeof window !== 'undefined' && window.location.protocol === 'https:' && (host.startsWith('http://127.0.0.1') || host.startsWith('http://localhost'))) {
      hint = 'Browser security (Private Network Access / Mixed Content): If your browser blocks HTTPS to local HTTP, please ensure your local backend is running, or click the site settings lock icon in the address bar to permit local network requests.';
    } else if (err.message && err.message.toLowerCase().includes('failed to fetch')) {
      hint = 'Connection failed. Verify that "python app.py" is running on port 5000 on your computer.';
    }

    return {
      success: false,
      latency,
      error: err.message || 'Connection failed',
      hint,
    };
  }
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
  timeout: 30000, // 30 seconds to allow on-chain transaction mining without client abort
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

// Response interceptor with fast-fail and selective retry
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const config = error.config;
    // Only retry transient Gateway errors (502, 503, 504) or network drop, NOT application 500 errors
    const status = error.response ? error.response.status : null;
    const isGatewayOrNetworkError = !error.response || (status >= 502 && status <= 504);

    if (config && isGatewayOrNetworkError && (!config.method || config.method.toLowerCase() === 'get')) {
      config.__retryCount = config.__retryCount || 0;
      const MAX_RETRIES = 2; // Reduced from 4 to 2 to eliminate 25s client freezing

      if (config.__retryCount < MAX_RETRIES) {
        config.__retryCount += 1;
        const delayMs = config.__retryCount * 800; // Small delay (800ms, 1600ms)
        console.warn(`[API] Transient gateway drop (${status || 'network error'}). Retrying ${config.url} (Attempt ${config.__retryCount}/${MAX_RETRIES}) in ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return api(config);
      }
    }

    if (error.response) {
      if (error.response.status === 401 && !window.location.href.includes('login') && window.location.pathname !== '/') {
        localStorage.removeItem('govtfund_token');
        localStorage.removeItem('govtfund_user');
        if (typeof window !== 'undefined' && !window.__redirectingToLogin) {
          window.__redirectingToLogin = true;
          window.location.href = '/?session_expired=1';
        }
      }
      return Promise.reject(error.response.data || { message: error.message });
    }
    return Promise.reject({ message: error.message || 'Network connection failed' });
  }
);

export default api;
