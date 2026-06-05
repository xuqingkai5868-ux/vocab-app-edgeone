// ===== EdgeOne Pages KV Helper =====
// my_kv 是 EdgeOne Pages 控制台绑定时设置的全局变量名（默认约定：my_kv）
// EdgeOne Edge Function 运行时：V8 Isolate，无 npm，原生 Web Crypto
//
// 关键约定（不要改）：
//   - 控制台绑定 KV 命名空间时，变量名必须填 `my_kv`
//   - my_kv.get(key) 返回 string（不存在返回 null）
//   - my_kv.put(key, value) value 必须是 string
//   - my_kv.list({ prefix, cursor, limit }) 每次最多 256 条，需要循环
//   - my_kv.delete(key) 异步删除
//   - 全局最终一致：写入后 60s 内全球可读到

// Key 命名空间（保持与 Vercel 版完全一致，迁移数据时不需要重写 key）
export const K = {
  user:    (id)    => `user:${id}`,
  pin:     (id)    => `pin:${id}`,
  state:   (id)    => `state:${id}`,
  session: (token) => `session:${token}`
};

// 字符串读写
export async function kvGet(key) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定：请在 EdgeOne Pages 控制台绑定 KV 命名空间，变量名 = my_kv');
  }
  return await my_kv.get(key);
}

export async function kvSet(key, value) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定');
  }
  return await my_kv.put(key, String(value));
}

export async function kvDel(key) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定');
  }
  return await my_kv.delete(key);
}

// JSON 读写（自动序列化/反序列化）
export async function kvGetJSON(key) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定');
  }
  const raw = await my_kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error(`[kvGetJSON] JSON parse failed for key ${key}:`, e);
    return null;
  }
}

export async function kvSetJSON(key, value) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定');
  }
  return await my_kv.put(key, JSON.stringify(value));
}

// 前缀扫描（自动分页，最多扫 max 条，默认 1000）
// EdgeOne KV list 每次最多 256 条，需要 cursor 循环
export async function kvKeysByPrefix(prefix, max = 1000) {
  if (typeof my_kv === 'undefined') {
    throw new Error('my_kv 未绑定');
  }

  // EdgeOne KV list 不支持 wildcard，直接用 prefix 匹配
  // 文档：my_kv.list({ prefix: 'user:', limit: 256 })
  try {
    const keys = [];
    let cursor;

    do {
      const resp = await my_kv.list({
        prefix,
        cursor,
        limit: 256
      });

      if (!resp) break;

      const list = resp.keys || [];
      for (const item of list) {
        const name = typeof item === 'string' ? item : (item.name || item.key || '');
        if (name && name.startsWith(prefix)) {
          keys.push(name);
          if (keys.length >= max) return keys;
        }
      }

      cursor = resp.cursor;
      if (!cursor || resp.list_complete) break;
    } while (cursor);

    return keys;
  } catch (e) {
    console.error('[kvKeysByPrefix] error:', e);
    return [];
  }
}
