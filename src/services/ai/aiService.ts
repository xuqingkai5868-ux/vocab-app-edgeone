import { AIRequest, AIResponse, AIError } from './types';
import { buildPrompt } from './promptBuilder';
import { parseResponse } from './responseParser';

const AI_DEFAULT_TIMEOUT = 30000;
const AI_DEFAULT_MAX_RETRIES = 3;
const AI_RETRY_DELAYS = [1000, 2000, 4000];

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendMessage(
  request: AIRequest,
  config: { apiKey: string; model: string; endpoint: string }
): Promise<AIResponse> {
  if (!config.apiKey) {
    throw new AIError('API Key 未配置，请在设置中配置 API Key', 'API_AUTH_FAILED');
  }

  const promptMessages = buildPrompt(
    request.messages,
    request.targetWords,
    request.knownWords,
    request.scenario,
    request.userLevel
  );

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AI_DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const baseURL = config.endpoint.replace(/\/$/, '');
      const response = await fetchWithTimeout(
        `${baseURL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: promptMessages,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        },
        AI_DEFAULT_TIMEOUT
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        if (response.status === 401) {
          throw new AIError('API Key 无效，请检查设置', 'API_AUTH_FAILED');
        } else if (response.status === 429) {
          if (attempt < AI_DEFAULT_MAX_RETRIES) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            await delay(retryAfter * 1000);
            continue;
          }
          throw new AIError('请求过于频繁，请稍后再试', 'API_RATE_LIMITED');
        } else if (response.status >= 400 && response.status < 500) {
          throw new AIError(`API 请求错误: ${response.status} ${errorBody}`, 'UNKNOWN');
        } else {
          throw new AIError(`服务端错误: ${response.status}`, 'UNKNOWN');
        }
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '';
      return parseResponse(rawContent);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof AIError) {
        if (error.type === 'API_AUTH_FAILED' || error.type === 'API_RATE_LIMITED') {
          throw error;
        }
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        if (attempt < AI_DEFAULT_MAX_RETRIES) {
          const retryDelay = AI_RETRY_DELAYS[Math.min(attempt, AI_RETRY_DELAYS.length - 1)];
          await delay(retryDelay);
          continue;
        }
        throw new AIError('请求超时，请检查网络连接后重试', 'NETWORK_TIMEOUT', error);
      }

      if (attempt < AI_DEFAULT_MAX_RETRIES) {
        const retryDelay = AI_RETRY_DELAYS[Math.min(attempt, AI_RETRY_DELAYS.length - 1)];
        await delay(retryDelay);
        continue;
      }
    }
  }

  throw new AIError(
    'AI 暂时不在线，请稍后再试',
    'UNKNOWN',
    lastError
  );
}

export async function healthCheck(config: { apiKey: string; endpoint: string }): Promise<boolean> {
  if (!config.apiKey) return false;
  try {
    const baseURL = config.endpoint.replace(/\/$/, '');
    const response = await fetchWithTimeout(
      `${baseURL}/models`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
      10000
    );
    return response.ok;
  } catch {
    return false;
  }
}
