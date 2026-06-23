import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserInfo, login as apiLogin } from '../api/auth';
import { clearToken } from '../api/client';

interface AuthContextType {
  user: UserInfo | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 自动登录弟弟账号
    apiLogin('di', '5678')
      .then(result => {
        setUser(result.user);
        localStorage.setItem('vocab_user', JSON.stringify(result.user));
      })
      .catch(() => {
        // 登录失败，清掉旧数据
        clearToken();
        localStorage.removeItem('vocab_user');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    clearToken();
    localStorage.removeItem('vocab_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
