// 统一封装 Redis 调用（Vercel 自动注入的 REDIS_URL = Redis Cloud TCP 地址）
// 用 ioredis 标准 Redis 协议（@upstash/redis 不支持 TCP）
// 兼容多种 env var 命名
// key 命名空间：user:xxx / pin:xxx / state:xxx / session:xxx

import Redis from 'ioredis';

const url = process.env.KV_REST_API_URL
         || process.env.UPSTASH_REDIS_REST_URL
         || process.env.REDIS_URL;

if (!url) {
  throw new Error('Missing Redis env vars. 需在 Vercel 项目设置 REDIS_URL（或绑 Redis 数据库）。');
}

// Serverless 优化：每个 Function 调用都新建连接（冷启动）；不维持长连接
// ioredis 在 Vercel Functions 里：connectTimeout 3s、commandTimeout 5s、maxRetriesPerRequest 1
// 避免 10s Function 超时
const client = new Redis(url, {
  connectTimeout: 3000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 1,
  lazyConnect: false,
  enableReadyCheck: true,
  // Redis Cloud 默认不强制 TLS（看 URL 是 redis:// 还是 rediss://）
  tls: url.startsWith('rediss://') ? {} : undefined
});

client.on('error', (err) => {
  console.error('[redis] error:', err.message);
});

export const redis = client;

export const K = {
  user: (id) => `user:${id}`,
  pin: (id) => `pin:${id}`,
  state: (id) => `state:${id}`,
  session: (token) => `session:${token}`
};

export async function kvGet(key) {
  return await redis.get(key);
}

export async function kvSet(key, value) {
  return await redis.set(key, value);
}

export async function kvDel(key) {
  return await redis.del(key);
}

export async function kvGetJSON(key) {
  const raw = await redis.get(key);
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

export async function kvSetJSON(key, value) {
  return await redis.set(key, JSON.stringify(value));
}

export async function kvKeysByPrefix(prefix) {
  // ioredis scan 签名：scan(cursor, 'MATCH', pattern, 'COUNT', count) → [nextCursor, string[]]
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
    cursor = next;
    for (const k of batch) keys.push(k);
  } while (cursor !== '0');
  return keys;
}
