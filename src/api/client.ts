// API 客户端基础 — fetch + Bearer Token + 错误处理

const API_BASE = '/api';

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
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

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
