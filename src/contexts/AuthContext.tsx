import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserInfo, login as apiLogin } from '../api/auth';
import { clearToken } from '../api/client';

// 本地用户显示名映射（覆盖服务器返回的 name）
const USER_DISPLAY_NAMES: Record<string, string> = {
  di: '薯条',
  kiki: 'Kiki',
};

interface AuthContextType {
  user: UserInfo | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('vocab_user');
    const token = localStorage.getItem('vocab_token');
    if (saved && token) {
      try {
        setUser(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (userId: string, pin: string) => {
    const result = await apiLogin(userId, pin);
    // 本地覆盖用户显示名（防止服务器存的是旧名称）
    const displayName = USER_DISPLAY_NAMES[userId];
    const userWithLocalName = displayName ? { ...result.user, name: displayName } : result.user;
    setUser(userWithLocalName);
    localStorage.setItem('vocab_user', JSON.stringify(userWithLocalName));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    localStorage.removeItem('vocab_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
