import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as api from './api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const { user } = await api.getMe(); setUser(user); }
    catch { setUser(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = async (username, password) => {
    const res = await api.login({ username, password });
    setUser(res.user);
    return res;
  };
  const register = async (payload) => {
    const res = await api.register(payload);
    setUser(res.user);
    return res;
  };
  const logout = async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
  };
  const updateTeamName = async (teamName) => {
    const res = await api.setTeamName(teamName);
    if (res.ok) setUser((u) => ({ ...u, teamName: res.teamName }));
    return res;
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, updateTeamName, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
