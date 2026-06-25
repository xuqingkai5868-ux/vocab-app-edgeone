// ===== /api/state =====
// EdgeOne Pages Edge Function (onRequest style)
// GET  /api/state              → 返回自己的 state
// GET  /api/state?userId=X     → admin 可读任意；user 只能读自己
// PUT  /api/state              → 写自己的 state
// PUT  /api/state {userId, state} → admin 可写任意；user 只能写自己
//
// state 形如：{ currentDay: 1, states: { "theme|word": "mastered"|"fuzzy" } }

import { K, kvSetJSON, kvGetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function onRequestGet({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;
  const target = new URL(request.url).searchParams.get('userId') || userId;

  if (role !== 'admin' && target !== userId) {
    return json({ error: 'forbidden', message: '只能查看自己的进度' }, 403);
  }

  const state = await kvGetJSON(K.state(target)) || { currentDay: 1, states: {} };
  return json({ userId: target, state });
}

export async function onRequestPut({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const { userId: target, state } = body || {};
  if (!target || !state || typeof state !== 'object') {
    return json({ error: 'missing_fields', message: '需要 userId 和 state' }, 400);
  }

  if (role !== 'admin' && target !== userId) {
    return json({ error: 'forbidden', message: '只能修改自己的进度' }, 403);
  }

  if (typeof state.currentDay !== 'number' || state.currentDay < 1) {
    return json({ error: 'invalid_currentDay' }, 400);
  }
  if (typeof state.states !== 'object' || state.states === null) {
    return json({ error: 'invalid_states' }, 400);
  }

  // 兼容三种格式：
  // - 旧版字符串: 'mastered'(4), 'fuzzy'(2)
  // - 新版数字: 0-4
  // - 其他字符串/数字: 转为数字 0-4
  const normalizedStates = {};
  for (const [k, v] of Object.entries(state.states)) {
    let nv;
    if (typeof v === 'number') {
      nv = Math.max(0, Math.min(4, Math.floor(v)));
    } else if (v === 'mastered') {
      nv = 4;
    } else if (v === 'fuzzy') {
      nv = 2;
    } else {
      // 其他字符串值 → 0（未学）
      nv = 0;
    }
    normalizedStates[k] = nv;
  }

  const payload = {
    currentDay: Math.min(Math.floor(state.currentDay), 1000),
    states: normalizedStates,
    lastUpdated: Date.now()
  };

  await kvSetJSON(K.state(target), payload);
  return json({ ok: true, userId: target, lastUpdated: payload.lastUpdated });
}
