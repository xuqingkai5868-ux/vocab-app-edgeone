// 登录 API
import { apiPost, setToken } from './client';

export interface UserInfo {
  id: string;
  name: string;
  role: string;
  grade: string | null;
}

export interface LoginResponse {
  ok: boolean;
  token: string;
  expiresAt: number;
  user: UserInfo;
}

export async function login(userId: string, pin: string): Promise<LoginResponse> {
  const result = await apiPost<LoginResponse>('/login', { userId, pin });
  setToken(result.token);
  return result;
}
