// ===== POST /api/reset =====
// EdgeOne Pages Edge Function (onRequest style)
// 重置某用户进度（currentDay → 1, states → {}）
// user 只能重置自己；admin 可重置任意（body 传 userId）
// 请求体（可选）：{ userId: "gao" }

import { K, kvGet, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function onRequestPost({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId, role } = auth.session;

  let body = {};
  try {
    body = await request.json();
  } catch {
    // 允许空 body
  }

  const target = (body && body.userId) || userId;
  if (!/^[a-z][a-z0-9_]{0,31}$/.test(target)) {
    return json({ error: 'invalid_user_id' }, 400);
  }

  if (role !== 'admin' && target !== userId) {
    return json({ error: 'forbidden', message: '只能重置自己的进度' }, 403);
  }
  if (role === 'admin' && target !== userId) {
    const storedAdminPin = await kvGet(K.pin('admin'));
    if (!storedAdminPin || String(body.adminConfirmPin || '') !== String(storedAdminPin)) {
      return json({ error: 'wrong_admin_pin', message: '管理员 PIN 不正确' }, 403);
    }
  }

  const empty = {
    currentDay: 1,
    states: {},
    lastUpdated: Date.now()
  };

  await kvSetJSON(K.state(target), empty);
  return json({ ok: true, userId: target, state: empty });
}
