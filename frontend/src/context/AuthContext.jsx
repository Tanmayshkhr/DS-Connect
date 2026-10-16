import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getMe } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Keep a stable ref to navigate so logout() doesn't need it as a dep
  const navigateRef = useRef(null);

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (!accessToken) {
      setLoading(false);
      return;
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('user');
      }
    }

    // Silently refresh user from /users/me to pick up any role changes
    getMe()
      .then((freshUser) => {
        setUser(freshUser);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(freshUser));
      })
      .catch(() => {
        // 401 is handled by api.js interceptor (clears tokens + redirects)
      })
      .finally(() => setLoading(false));
  }, []);

  function login(accessToken, refreshToken, userObj) {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    if (userObj) {
      localStorage.setItem('user', JSON.stringify(userObj));
      setUser(userObj);
    }
    setIsAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }

  function hasRole(...allowedRoles) {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
