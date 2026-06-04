// ===== POST /api/login =====
// Vercel Function (Web fetch-style)
// 4 位 PIN 登录 → 返回 token + user 信息
// 请求体：{ userId: "gao"|"di"|"admin", pin: "1234" }
// 响应：{ token, user: { id, name, role, grade? }, expiresAt }

import { K, kvGet, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request', message: '请求体不是合法 JSON' }, 400);
  }

  const { userId, pin } = body || {};
  if (!userId || !pin) {
    return json({ error: 'missing_credentials', message: '请输入账号和 PIN' }, 400);
  }

  if (!/^[a-z][a-z0-9_]{0,31}$/.test(userId)) {
    return json({ error: 'invalid_user_id' }, 400);
  }

  const storedPin = await kvGet(K.pin(userId));
  if (!storedPin) {
    return json({ error: 'user_not_found', message: '账号不存在' }, 404);
  }

  if (String(storedPin) !== String(pin)) {
    return json({ error: 'wrong_pin', message: 'PIN 不正确' }, 401);
  }

  const userRaw = await kvGet(K.user(userId));
  if (!userRaw) {
    return json({ error: 'user_not_found', message: '账号资料缺失' }, 404);
  }

  const user = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;

  const token = crypto.randomUUID();
  const session = {
    userId,
    role: user.role,
    expiresAt: Date.now() + 30 * 86400000  // 30 天
  };

  await kvSetJSON(K.session(token), session);

  return json({
    token,
    user: {
      id: userId,
      name: user.name,
      role: user.role,
      grade: user.grade || null
    },
    expiresAt: session.expiresAt
  });
}
