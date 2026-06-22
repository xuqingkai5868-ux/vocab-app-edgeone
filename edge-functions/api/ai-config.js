// ===== /api/ai-config =====
// EdgeOne Pages Edge Function (onRequest style)
// GET  /api/ai-config    → 获取 AI 配置
// PUT  /api/ai-config    → 更新 AI 配置 { apiKey, model, endpoint }
//
// KV key: ai-config:{userId}

import { kvGetJSON, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

function configKey(userId) {
  return `ai-config:${userId}`;
}

export async function onRequestGet({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId } = auth.session;
  const config = await kvGetJSON(configKey(userId));

  // 返回默认配置（不暴露完整 apiKey，只显示掩码）
  const defaultConfig = {
    apiKey: '',
    model: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1',
  };

  const result = config || defaultConfig;
  if (result.apiKey) {
    result.apiKeyMasked = result.apiKey.slice(0, 8) + '...' + result.apiKey.slice(-4);
  }

  return json({ userId, config: result });
}

export async function onRequestPut({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId } = auth.session;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body 必须是 JSON' }, 400);
  }

  const { apiKey, model, endpoint } = body || {};

  // 读取现有配置
  const existing = await kvGetJSON(configKey(userId)) || {};
  const updated = {
    apiKey: apiKey !== undefined ? apiKey : existing.apiKey,
    model: model !== undefined ? model : existing.model,
    endpoint: endpoint !== undefined ? endpoint : existing.endpoint,
  };

  if (!updated.apiKey) {
    return json({ error: 'missing_apiKey', message: '需要 apiKey' }, 400);
  }

  await kvSetJSON(configKey(userId), updated);

  return json({
    ok: true,
    config: {
      ...updated,
      apiKeyMasked: updated.apiKey.slice(0, 8) + '...' + updated.apiKey.slice(-4),
    },
  });
}
