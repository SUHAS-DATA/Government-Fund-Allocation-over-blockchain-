import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('govtfund_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  // Instant unblock if user is already cached in localStorage
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('govtfund_token');
    const saved = localStorage.getItem('govtfund_user');
    // Only block if token exists but user profile is not yet hydrated
    return !!token && !saved;
  });

  useEffect(() => {
    const token = localStorage.getItem('govtfund_token');
    if (token) {
      API.get('/auth/profile')
        .then((res) => {
          if (res.success) {
            setUser(res.user);
            localStorage.setItem('govtfund_user', JSON.stringify(res.user));
          }
        })
        .catch(() => {
          localStorage.removeItem('govtfund_token');
          localStorage.removeItem('govtfund_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (identifier, password) => {
    const cleanId = String(identifier || '').trim();
    const res = await API.post('/auth/login', {
      identifier: cleanId,
      email: cleanId,
      officer_id: cleanId,
      contractor_id: cleanId,
      username: cleanId,
      password
    });
    if (res.success) {
      localStorage.setItem('govtfund_token', res.token);
      localStorage.setItem('govtfund_user', JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('govtfund_token');
    localStorage.removeItem('govtfund_user');
    setUser(null);
    window.location.hash = '#/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
