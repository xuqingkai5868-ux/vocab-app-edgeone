// ===== POST /api/tts =====
// EdgeOne Pages Edge Function
// 代理 Google Translate TTS，返回 MP3 音频
// 请求体：{ text: "hello", lang: "en" }
// 响应：audio/mpeg（可直接用 Audio 播放）
//
// 为什么走代理而不是前端直连：
//   - Google TTS 没有公开的 CORS 头，前端 fetch 会被拦截
//   - EdgeOne Function 位于服务端，没有 CORS 限制
//   - 可以添加缓存层，减少重复请求
//   - 未来可无缝切换其他 TTS 引擎

import { json } from './_lib/respond.js';

// Google Translate TTS 端点（免费、高音质、广泛使用）
// client=tw-ob 是 Google Translate Web 客户端的标识
const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts';

// 简单内存缓存（V8 Isolate 生命周期内有效）
const audioCache = new Map();

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body 必须是 JSON' }, 400);
  }

  const text = (body?.text || '').trim();
  const lang = body?.lang || 'en';

  if (!text) {
    return json({ error: 'missing_text', message: '需要 text 字段' }, 400);
  }

  // 限制文本长度，防止滥用
  if (text.length > 200) {
    return json({ error: 'text_too_long', message: '文本不能超过 200 个字符' }, 400);
  }

  // 构建缓存键
  const cacheKey = `${lang}:${text.toLowerCase()}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    console.log(`[TTS] 缓存命中: "${text}"`);
    return audioResponse(cached);
  }

  // 构建 Google TTS URL
  const url = `${GOOGLE_TTS_URL}?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;

  try {
    console.log(`[TTS] 请求: "${text}" (${lang})`);

    // 使用 User-Agent 模拟浏览器，避免被 Google 拒绝
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'audio/mpeg,audio/*,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://translate.google.com/',
      },
    });

    if (!resp.ok) {
      console.error(`[TTS] Google 返回 ${resp.status}: "${text}"`);
      return json({ error: 'tts_failed', status: resp.status }, 502);
    }

    // 读取响应体为 ArrayBuffer
    const audioBuffer = await resp.arrayBuffer();

    // 缓存结果（缓存最多 500 条，超出时删除最早的）
    if (audioCache.size >= 500) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    console.log(`[TTS] 成功: "${text}" (${audioBuffer.byteLength} bytes)`);

    return audioResponse(audioBuffer);
  } catch (e) {
    console.error(`[TTS] 请求失败: "${text}"`, e.message);
    return json({ error: 'tts_error', message: e.message }, 502);
  }
}

function audioResponse(audioBuffer) {
  return new Response(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.byteLength),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
