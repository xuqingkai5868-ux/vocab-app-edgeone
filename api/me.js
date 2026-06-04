// ===== GET /api/me =====
// Vercel Function (Web fetch-style)
// 返回当前登录用户的资料
// 响应：{ user: { id, name, role, grade? } }

import { K, kvGet } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

export async function GET(req) {
  const auth = await verifyToken(req);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId } = auth.session;

  const userRaw = await kvGet(K.user(userId));
  if (!userRaw) {
    return json({ error: 'user_not_found' }, 404);
  }

  const u = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
  return json({
    user: {
      id: userId,
      name: u.name,
      role: u.role,
      grade: u.grade || null
    }
  });
}
