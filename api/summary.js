// ===== GET /api/summary =====
// Vercel Function (Web fetch-style)
// 返回所有用户进度概览，按角色过滤敏感度：
//   admin → 看所有人的 full state（含 currentDay）
//   user  → 看自己 full + 看别人百分比（mastered/fuzzy 计数）
//
// 响应：{ [userId]: { name, role, mastered, fuzzy, currentDay? } }

import { K, kvGet, kvGetJSON, kvKeysByPrefix } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function GET(req) {
  const auth = await verifyToken(req);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  const userKeys = await kvKeysByPrefix('user:');
  const result = {};

  for (const key of userKeys) {
    const id = key.replace('user:', '');
    const uRaw = await kvGet(key);
    if (!uRaw) continue;
    const u = typeof uRaw === 'string' ? JSON.parse(uRaw) : uRaw;

    const state = await kvGetJSON(K.state(id)) || { currentDay: 1, states: {} };
    const mastered = Object.values(state.states || {}).filter(s => s === 'mastered').length;
    const fuzzy = Object.values(state.states || {}).filter(s => s === 'fuzzy').length;

    const isSelf = id === userId;
    const isAdmin = role === 'admin';

    result[id] = {
      name: u.name,
      role: u.role,
      mastered,
      fuzzy,
      currentDay: (isAdmin || isSelf) ? (state.currentDay || 1) : null
    };
  }

  return json(result);
}
