import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserInfo, login as apiLogin } from '../api/auth';
import { clearToken, hasToken } from '../api/client';

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
    // 检查本地是否有 token，如果有尝试恢复 session
    if (hasToken()) {
      // 尝试从 localStorage 恢复用户信息
      const saved = localStorage.getItem('vocab_user');
      if (saved) {
        try {
          setUser(JSON.parse(saved));
        } catch {
          // ignore
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (userId: string, pin: string) => {
    const result = await apiLogin(userId, pin);
    setUser(result.user);
    localStorage.setItem('vocab_user', JSON.stringify(result.user));
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
