// ===== POST /api/login =====
// EdgeOne Pages Edge Function (onRequest style)
// 验证 4 位 PIN，返回 30 天有效的 session token
// 请求体：{ userId: "gao|di|admin", pin: "1234" }

import { K, kvGet, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';

/**
 * 恒定时间字符串比较，防止时序攻击
 */
function constantTimeCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body 必须是 JSON' }, 400);
  }

  const { userId, pin } = body || {};
  if (!userId || !pin) {
    return json({ error: 'missing_fields', message: '需要 userId 和 pin' }, 400);
  }

  if (!/^[a-z][a-z0-9_]{0,31}$/.test(userId)) {
    return json({ error: 'invalid_user_id' }, 400);
  }

  if (!/^\d{4,8}$/.test(String(pin))) {
    return json({ error: 'invalid_pin', message: 'PIN 必须是 4-8 位数字' }, 400);
  }

  // 读取存储的 PIN
  const storedPin = await kvGet(K.pin(userId));
  if (!storedPin) {
    return json({ error: 'user_not_found', message: '用户不存在或未初始化' }, 404);
  }

  const pinStr = String(pin);
  const storedPinStr = String(storedPin);
  if (!constantTimeCompare(pinStr, storedPinStr)) {
    return json({ error: 'wrong_pin', message: 'PIN 错误' }, 401);
  }

  // 读取用户资料
  const userRaw = await kvGet(K.user(userId));
  const u = userRaw ? (typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw) : null;
  if (!u) {
    return json({ error: 'user_data_missing' }, 500);
  }

  // 创建 session
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const session = {
    token,
    userId,
    role: u.role,
    name: u.name,
    grade: u.grade || null,
    issuedAt: Date.now(),
    expiresAt
  };
  await kvSetJSON(K.session(token), session);

  return json({
    ok: true,
    token,
    expiresAt,
    user: {
      id: userId,
      name: u.name,
      role: u.role,
      grade: u.grade || null
    }
  });
}
