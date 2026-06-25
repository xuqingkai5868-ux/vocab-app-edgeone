import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { UserInfo, login as apiLogin } from '../api/auth';
import { clearToken, onForceLogout } from '../api/client';

// 本地用户显示名映射（覆盖服务器返回的 name）
const USER_DISPLAY_NAMES: Record<string, string> = {
  di: '薯条',
  kiki: 'Kiki',
};

// Token 过期时间 key
const TOKEN_EXPIRES_KEY = 'vocab_token_expires';

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

    // 检查 token 是否过期
    if (token) {
      const expiresAt = localStorage.getItem(TOKEN_EXPIRES_KEY);
      if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
        // Token 已过期，清除登录状态
        localStorage.removeItem('vocab_token');
        localStorage.removeItem(TOKEN_EXPIRES_KEY);
        localStorage.removeItem('vocab_user');
        setIsLoading(false);
        return;
      }
    }

    if (saved && token) {
      try {
        const parsed = JSON.parse(saved);
        // 校验必要字段：必须是对象且有有效的 id 字段
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) && typeof parsed.id === 'string' && parsed.id.length > 0) {
          // 应用本地显示名覆盖（防止服务器存的旧名称被缓存）
          const displayName = USER_DISPLAY_NAMES[parsed.id];
          if (displayName && parsed.name !== displayName) {
            parsed.name = displayName;
            localStorage.setItem('vocab_user', JSON.stringify(parsed));
          }
          setUser(parsed);
        }
      } catch { /* ignore */ }
    }
    setIsLoading(false);
  }, []);

  // 监听服务端返回 401 时强制登出
  useEffect(() => {
    return onForceLogout(() => {
      setUser(null);
      clearToken();
      localStorage.removeItem('vocab_user');
      localStorage.removeItem(TOKEN_EXPIRES_KEY);
    });
  }, []);

  const login = useCallback(async (userId: string, pin: string) => {
    const result = await apiLogin(userId, pin);
    // 保存过期时间
    if (result.expiresAt) {
      localStorage.setItem(TOKEN_EXPIRES_KEY, String(result.expiresAt));
    }
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
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
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
