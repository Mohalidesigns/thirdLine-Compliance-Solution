import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, setRefreshToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY_TOKEN = 'atheris_tenant_token';
const STORAGE_KEY_REFRESH = 'atheris_tenant_refresh_token';
const STORAGE_KEY_USER = 'atheris_tenant_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem(STORAGE_KEY_TOKEN);
      const refresh = localStorage.getItem(STORAGE_KEY_REFRESH);
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_USER) || 'null');
      if (token && saved) {
        setToken(token);
        if (refresh) setRefreshToken(refresh);
        setUser(saved);
      }
    } catch {}
    setLoading(false);
  }, []);

  function save(token, refresh, userData) {
    setToken(token);
    if (refresh) setRefreshToken(refresh);
    setUser(userData);
    try {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      if (refresh) localStorage.setItem(STORAGE_KEY_REFRESH, refresh);
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
    } catch {}
  }

  function clear() {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
      localStorage.removeItem(STORAGE_KEY_USER);
    } catch {}
  }

  async function login(email, password) {
    const res = await api.auth.login(email, password);
    save(res.accessToken, res.refreshToken, res.user);
    return res;
  }

  async function demoLogin() {
    const res = await api.auth.demo();
    save(res.accessToken, res.refreshToken, res.user);
    return res;
  }

  function logout() {
    clear();
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, demoLogin, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
