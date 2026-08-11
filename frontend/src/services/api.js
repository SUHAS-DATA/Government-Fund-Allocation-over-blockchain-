import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
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
      if (error.response.status === 401 && !window.location.pathname.includes('/login')) {
        localStorage.removeItem('govtfund_token');
        localStorage.removeItem('govtfund_user');
      }
      return Promise.reject(error.response.data || { message: error.message });
    }
    return Promise.reject({ message: error.message || 'Network connection failed' });
  }
);

export default api;
