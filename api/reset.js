// ===== POST /api/reset =====
// Vercel Function (Web fetch-style)
// 重置某用户进度（currentDay → 1, states → {}）
// user 只能重置自己；admin 可重置任意（body 传 userId）
// 请求体（可选）：{ userId: "gao" }

import { K, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function POST(req) {
  const auth = await verifyToken(req);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  let body = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }

  const target = (body && body.userId) || userId;

  if (role !== 'admin' && target !== userId) {
    return json({ error: 'forbidden', message: '只能重置自己的进度' }, 403);
  }

  const empty = {
    currentDay: 1,
    states: {},
    lastUpdated: Date.now()
  };

  await kvSetJSON(K.state(target), empty);
  return json({ ok: true, userId: target, state: empty });
}
