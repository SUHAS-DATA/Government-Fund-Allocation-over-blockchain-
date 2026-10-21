import axios from 'axios';

export const DEFAULT_LOCAL_BACKEND = 'http://127.0.0.1:5000';
export const DEFAULT_CLOUD_BACKEND = (
  (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim())
    ? import.meta.env.VITE_API_URL.trim().replace(/\/api\/?$/, '').replace(/\/+$/, '')
    : 'https://government-fund-allocation-over.onrender.com'
);

export const isLocalHostname = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase().trim();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h.endsWith('.local')
  );
};

export const isLocalhostUrl = (urlStr) => {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const u = urlStr.toLowerCase().trim();
  return (
    u.includes('127.0.0.1') ||
    u.includes('localhost') ||
    u.includes('0.0.0.0') ||
    u.includes('[::1]') ||
    /^https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)/i.test(u)
  );
};

export const normalizeApiUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

// Immediate sanity cleanup on deployed remote domains:
// Remove any stale loopback, private-network, or mixed-content HTTP overrides from previous sessions.
if (typeof window !== 'undefined' && !isLocalHostname(window.location.hostname)) {
  try {
    const existing = localStorage.getItem('govtfund_api_host');
    const isRemoteSecure = window.location.protocol === 'https:';
    if (existing && (isLocalhostUrl(existing) || (isRemoteSecure && existing.trim().toLowerCase().startsWith('http://')))) {
      localStorage.removeItem('govtfund_api_host');
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('govtfund_explicit_local_override');
    }
  } catch (e) {}
}

/**
 * Intelligent Dynamic API URL resolver
 * Automatically supports:
 * 1. Intentional user override saved in localStorage ('govtfund_api_host')
 *    - On localhost: respects any saved override (local or cloud).
 *    - On remote/deployed domains (e.g. Vercel): strictly blocks localhost (127.0.0.1, localhost, [::1]),
 *      private IP ranges, and insecure HTTP URLs, purging them to ensure reliable cloud backend access.
 * 2. Local development on localhost/loopback targeting local FastAPI backend (127.0.0.1:5000)
 * 3. Deployed cloud environments (e.g. Vercel) targeting configured VITE_API_URL or hosted cloud backend
 */
export const getApiBaseUrl = () => {
  const isLocalHost = typeof window !== 'undefined' && isLocalHostname(window.location.hostname);

  // 1. User / session override from localStorage ('govtfund_api_host')
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('govtfund_api_host');
    if (saved && saved.trim()) {
      const clean = saved.trim();

      // Guard: On a deployed remote environment (e.g. *.vercel.app),
      // localhost, loopback, private-network, or insecure HTTP targets over HTTPS are strictly prohibited.
      // Unconditionally purge any such override and fallback to cloud backend.
      const isRemoteSecure = !isLocalHost && window.location.protocol === 'https:';
      const isInsecureOrLocal = isLocalhostUrl(clean) || (isRemoteSecure && clean.toLowerCase().startsWith('http://'));

      if (!isLocalHost && isInsecureOrLocal) {
        try {
          localStorage.removeItem('govtfund_api_host');
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('govtfund_explicit_local_override');
          }
        } catch (e) {}
      } else {
        return normalizeApiUrl(clean);
      }
    }
  }

  // 2. Local development on localhost/loopback
  if (isLocalHost) {
    return normalizeApiUrl(DEFAULT_LOCAL_BACKEND);
  }

  // 3. Deployed / remote environments: use configured VITE_API_URL or hosted cloud backend
  return normalizeApiUrl(DEFAULT_CLOUD_BACKEND);
};

export const getApiConnectionDetails = () => {
  const currentBase = getApiBaseUrl();
  const isLocalHost = typeof window !== 'undefined' && isLocalHostname(window.location.hostname);
  const saved = typeof window !== 'undefined' ? localStorage.getItem('govtfund_api_host') : null;

  let mode = 'CLOUD';
  if (saved && saved.trim()) {
    if (isLocalhostUrl(saved)) {
      mode = isLocalHost ? 'LOCAL' : 'CLOUD';
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
    isLocalTarget: isLocalhostUrl(currentBase),
    hasCustomOverride: Boolean(saved && saved.trim() && (isLocalHost || !isLocalhostUrl(saved))),
    defaultCloudUrl: DEFAULT_CLOUD_BACKEND,
    defaultLocalUrl: DEFAULT_LOCAL_BACKEND,
  };
};

export const setApiHost = (host) => {
  if (typeof window === 'undefined') return;
  const isLocalHost = isLocalHostname(window.location.hostname);

  if (!host || !host.trim()) {
    localStorage.removeItem('govtfund_api_host');
    try { sessionStorage.removeItem('govtfund_explicit_local_override'); } catch (e) {}
  } else {
    const clean = host.trim().replace(/\/+$/, '');
    if (!isLocalHost && isLocalhostUrl(clean)) {
      // Disallow setting localhost targets on deployed cloud environments
      localStorage.removeItem('govtfund_api_host');
      try { sessionStorage.removeItem('govtfund_explicit_local_override'); } catch (e) {}
    } else {
      localStorage.setItem('govtfund_api_host', clean);
      if (isLocalhostUrl(clean) && isLocalHost) {
        try { sessionStorage.setItem('govtfund_explicit_local_override', 'true'); } catch (e) {}
      }
    }
  }
  window.dispatchEvent(new CustomEvent('govtfund_api_host_changed', { detail: { host } }));
};

export const resetApiHost = () => {
  setApiHost(null);
  if (typeof sessionStorage !== 'undefined') {
    try { sessionStorage.removeItem('govtfund_explicit_local_override'); } catch (e) {}
  }
};

export const testBackendHealth = async (targetHost = null) => {
  const host = (targetHost || getApiConnectionDetails().currentHost).replace(/\/+$/, '');

  // Guard against attempting to ping local network addresses from HTTPS cloud deployments
  if (typeof window !== 'undefined' && !isLocalHostname(window.location.hostname) && isLocalhostUrl(host)) {
    return {
      success: false,
      latency: 0,
      error: 'Direct local loopback connection blocked on cloud domains',
      hint: 'Deployed cloud portals connect to the cloud backend. Localhost targeting is only available during local development.',
    };
  }

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
      hint = 'Connection attempt was unreachable. Please verify the backend process is running.';
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
    // If apiBase was https://domain/api, ws URL is wss://domain/ws
    return `${wsProto}//${url.host}/ws`;
  } catch (e) {
    if (typeof window !== 'undefined' && window.location.hostname) {
      if (isLocalHostname(window.location.hostname)) {
        return 'ws://127.0.0.1:5000/ws';
      }
      try {
        const cloudUrl = new URL(DEFAULT_CLOUD_BACKEND);
        const wsProto = cloudUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${wsProto}//${cloudUrl.host}/ws`;
      } catch (err) {}
    }
    return 'wss://government-fund-allocation-over.onrender.com/ws';
  }
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 45000, // 45 seconds: accommodates measured cloud container cold initialization and on-chain verification
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

  // Automatically remove Content-Type header when sending FormData
  // so the browser / runtime computes 'multipart/form-data; boundary=...'
  const isFormData = config.data && (
    (typeof FormData !== 'undefined' && config.data instanceof FormData) ||
    (typeof config.data.append === 'function')
  );
  if (isFormData || (config.headers && config.headers['Content-Type'] === 'multipart/form-data')) {
    delete config.headers['Content-Type'];
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
      const respData = error.response.data;
      const respMessage = (respData && (respData.message || respData.detail)) || error.message;
      return Promise.reject(typeof respData === 'object' && respData !== null ? { ...respData, message: respMessage } : { message: respMessage });
    }

    return Promise.reject({
      message: error.message === 'Network Error' || error.code === 'ECONNABORTED'
        ? 'Unable to connect to government server. Please check your internet connection or verify backend availability.'
        : (error.message || 'Network connection failed'),
      isNetworkError: true,
    });
  }
);

export default api;
