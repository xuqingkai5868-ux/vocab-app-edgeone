// ===== /api/state =====
// Vercel Function (Web fetch-style)
// GET  /api/state              → 返回自己的 state
// GET  /api/state?userId=X     → admin 可读任意；user 只能读自己
// PUT  /api/state              → 写自己的 state
// PUT  /api/state {userId, state} → admin 可写任意；user 只能写自己
//
// state 形如：{ currentDay: 1, states: { "theme|word": "mastered"|"fuzzy" } }

import { K, kvSetJSON, kvGetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function GET(req) {
  const auth = await verifyToken(req);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;
  const target = new URL(req.url).searchParams.get('userId') || userId;

  if (role !== 'admin' && target !== userId) {
    return json({ error: 'forbidden', message: '只能查看自己的进度' }, 403);
  }

  const state = await kvGetJSON(K.state(target)) || { currentDay: 1, states: {} };
  return json({ userId: target, state });
}

export async function PUT(req) {
  const auth = await verifyToken(req);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  let body;
  try {
    body = await req.json();
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

  for (const [k, v] of Object.entries(state.states)) {
    if (v !== 'mastered' && v !== 'fuzzy') {
      return json({ error: 'invalid_state_value', key: k, value: v }, 400);
    }
  }

  const payload = {
    currentDay: Math.min(Math.floor(state.currentDay), 1000),
    states: state.states,
    lastUpdated: Date.now()
  };

  await kvSetJSON(K.state(target), payload);
  return json({ ok: true, userId: target, lastUpdated: payload.lastUpdated });
}
