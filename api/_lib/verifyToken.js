// 共享 token 验证工具
// Vercel Functions（独立部署）不支持 middleware.js
// 所以每个需要鉴权的 API 在函数体内先调用此工具

import { redis, K } from './kv.js';

export async function verifyToken(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { error: 'unauthorized', status: 401, message: '缺少登录凭证' };
  }

  const sessionRaw = await redis.get(K.session(token));
  if (!sessionRaw) {
    return { error: 'invalid_token', status: 401, message: '登录已失效，请重新登录' };
  }

  let session;
  try {
    session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
  } catch {
    await redis.del(K.session(token));
    return { error: 'corrupted_session', status: 401, message: '会话数据损坏' };
  }

  if (!session.expiresAt || session.expiresAt < Date.now()) {
    await redis.del(K.session(token));
    return { error: 'expired', status: 401, message: '登录已过期，请重新登录' };
  }

  return { session };
}
