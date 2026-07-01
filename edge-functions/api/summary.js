// ===== GET /api/summary =====
// EdgeOne Pages Edge Function (onRequest style)
// 返回所有用户进度概览，按角色过滤敏感度：
//   admin → 看所有人的 full state（含 currentDay）
//   user  → 看自己 full + 看别人百分比（mastered/fuzzy 计数）
//
// 响应：{ [userId]: { name, role, mastered, fuzzy, currentDay? } }

import { K, kvGet, kvGetJSON, kvKeysByPrefix } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function onRequestGet({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  const userKeys = await kvKeysByPrefix('user:');

  // EdgeOne KV list() 可能不被 V8 Isolate 支持，兜底用记忆中的用户 ID
  const ids = userKeys.length > 0
    ? userKeys.map(k => k.replace('user:', ''))
    : (await Promise.all(['gao', 'di', 'admin'].map(async id => {
        const check = await kvGet(K.user(id));
        return check ? id : null;
      }))).filter(Boolean);

  const result = {};

  for (const id of ids) {
    const uRaw = await kvGet(K.user(id));
    if (!uRaw) continue;
    const u = typeof uRaw === 'string' ? JSON.parse(uRaw) : uRaw;

    const state = await kvGetJSON(K.state(id)) || { currentDay: 1, states: {} };
    // 兼容数字格式（state.js 归一化为 0-4）和旧版字符串格式
    const stateValues = Object.values(state.states || {});
    const mastered = stateValues.filter(s => s === 4 || s === 'mastered').length;
    const fuzzy = stateValues.filter(s => s === 2 || s === 'fuzzy').length;

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
