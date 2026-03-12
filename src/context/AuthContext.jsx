import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { verifyLogin, validateToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // { clientId, fullName, nickname, program, modules }
  const [loading, setLoading] = useState(true);  // initial token check
  const [error, setError] = useState(null);

  // Check for token in URL (?t=xxx) or sessionStorage
  useEffect(() => {
    async function init() {
      try {
        // 1. Check URL token (from PassKit pass link)
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('t');

        if (urlToken) {
          const data = await validateToken(urlToken);
          setUser({
            clientId: data.clientId,
            fullName: data.fullName || data.firstName || 'Member',
            nickname: data.nickname || data.firstName || 'Member',
            program: data.program,
            modules: data.modules || ['dashboard'],
          });
          sessionStorage.setItem('hc_session', JSON.stringify({
            clientId: data.clientId,
            token: urlToken,
          }));
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }

        // 2. Check existing session
        const saved = sessionStorage.getItem('hc_session');
        if (saved) {
          const { clientId, token } = JSON.parse(saved);
          if (token) {
            const data = await validateToken(token);
            setUser({
              clientId: data.clientId,
              fullName: data.fullName || 'Member',
              nickname: data.nickname || 'Member',
              program: data.program,
              modules: data.modules || ['dashboard'],
            });
            return;
          }
        }
      } catch {
        // Token invalid or expired — fall through to login
        sessionStorage.removeItem('hc_session');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const login = useCallback(async (email, pin) => {
    setError(null);
    try {
      const data = await verifyLogin(email, pin);
      setUser({
        clientId: data.clientId,
        fullName: data.fullName,
        nickname: data.nickname,
        program: data.program,
        modules: data.modules || ['dashboard'],
      });
      sessionStorage.setItem('hc_session', JSON.stringify({
        clientId: data.clientId,
      }));
      return data;
    } catch (err) {
      setError(err.message || 'Invalid credentials');
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('hc_session');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
