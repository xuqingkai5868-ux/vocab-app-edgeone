// API 客户端基础 — fetch + Bearer Token + 错误处理 + 自动重试

const API_BASE = '/api';

// 重试配置
const RETRY_MAX = 3;
const RETRY_BASE_MS = 1000; // 初始退避 1s

/**
 * API 强制登出事件
 * 当收到 401 时触发，AuthContext 监听此事件自动登出
 */
const FORCE_LOGOUT_EVENT = 'api-force-logout';

export function triggerForceLogout(): void {
  window.dispatchEvent(new CustomEvent(FORCE_LOGOUT_EVENT));
}

export function onForceLogout(handler: () => void): () => void {
  window.addEventListener(FORCE_LOGOUT_EVENT, handler);
  return () => window.removeEventListener(FORCE_LOGOUT_EVENT, handler);
}

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('vocab_token');
}

export function setToken(token: string): void {
  localStorage.setItem('vocab_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('vocab_token');
}

export function hasToken(): boolean {
  return !!localStorage.getItem('vocab_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  attempt = 1
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s 超时

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      // Token 过期或无效 → 触发强制登出（不重试）
      triggerForceLogout();
      const msg = '登录已过期，请重新登录';
      throw new APIError(msg, 401);
    }

    if (!response.ok) {
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        data = { message: response.statusText };
      }
      const msg = (data as { message?: string })?.message || `请求失败 (${response.status})`;
      throw new APIError(msg, response.status, data);
    }

    return response.json() as Promise<T>;
  } catch (e) {
    if (e instanceof APIError) {
      // HTTP 业务错误（非网络错误）— 不重试，直接抛出
      throw e;
    }
    // 网络错误或超时 — 自动重试（指数退避）
    const isTimeout = e instanceof DOMException && e.name === 'AbortError';
    const msg = isTimeout ? '请求超时' : '网络错误，请检查网络连接';

    if (attempt < RETRY_MAX) {
      const delay = RETRY_BASE_MS * Math.pow(2, attempt - 1);
      console.warn(`[API] 请求失败 (attempt ${attempt}/${RETRY_MAX}), ${delay}ms 后重试: ${path}`, msg);
      await new Promise(resolve => setTimeout(resolve, delay));
      return request<T>(path, options, attempt + 1);
    }

    console.error(`[API] 请求已重试 ${RETRY_MAX} 次仍失败: ${path}`);
    throw new APIError(msg, 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}
