// TTS API 客户端
// 调用 /api/tts Edge Function 代理获取 Google TTS 音频

// 内存缓存：避免同一单词重复请求
const audioCache = new Map<string, ArrayBuffer>();

// 当前正在进行的请求（防并发）
const pendingRequests = new Map<string, Promise<ArrayBuffer>>();

export interface TtsResult {
  success: boolean;
  audio?: ArrayBuffer;
  error?: string;
}

/**
 * 通过 EdgeOne Function 代理获取 TTS 音频（Google TTS）
 * 使用 POST /api/tts，返回 MP3 二进制数据
 */
export async function fetchTtsAudio(text: string, lang = 'en'): Promise<TtsResult> {
  const cacheKey = `${lang}:${text.toLowerCase()}`;

  // 1. 内存缓存命中
  const cached = audioCache.get(cacheKey);
  if (cached) {
    return { success: true, audio: cached };
  }

  // 2. 去重：同一文本的并发请求复用同一个 Promise
  const pending = pendingRequests.get(cacheKey);
  if (pending) {
    try {
      const buf = await pending;
      return { success: true, audio: buf };
    } catch {
      // 并发请求也失败了，继续走下面的逻辑重新请求
      pendingRequests.delete(cacheKey);
    }
  }

  // 3. 发起请求
  const promise = doFetchTts(text, lang, cacheKey);
  pendingRequests.set(cacheKey, promise);

  try {
    const buf = await promise;
    return { success: true, audio: buf };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

async function doFetchTts(text: string, lang: string, cacheKey: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  // 10 秒超时
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errMsg = `TTS 服务返回 ${response.status}`;
      try {
        const err = await response.json();
        errMsg = err.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    const audioBuffer = await response.arrayBuffer();

    // 缓存（最多 300 条）
    if (audioCache.size >= 300) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    return audioBuffer;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 播放 ArrayBuffer 音频
 * 返回一个 Promise，在播放完成或失败时 resolve
 */
export function playAudioBuffer(buffer: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('音频播放失败'));
      };

      audio.play().catch((e) => {
        URL.revokeObjectURL(url);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/** 清除 TTS 缓存（内存不足或测试时使用） */
export function clearTtsCache() {
  audioCache.clear();
  pendingRequests.clear();
}
