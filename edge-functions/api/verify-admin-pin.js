// ===== POST /api/verify-admin-pin =====
// EdgeOne Pages Edge Function
// 验证家长密码（不存储在前端，防止孩子通过源码查看密码）
// 请求体：{ pin: "888888" }
// 响应：{ ok: true/false }

import { K, kvGet, kvSet } from './_lib/kv.js';
import { json } from './_lib/respond.js';

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body 必须是 JSON' }, 400);
  }

  const pin = body && body.pin;
  if (!pin || typeof pin !== 'string') {
    return json({ error: 'missing_pin', message: '需要 pin 字段' }, 400);
  }

  // 从 KV 读取管理员密码
  const storedPin = await kvGet(K.pin('admin'));

  // 兼容旧数据：如果 KV 存的还是旧兜底 'scdq'，迁移到新兜底 '888888'
  if (storedPin === 'scdq') {
    await kvSet(K.pin('admin'), '888888');
    const ok = pin === '888888';
    return json({ ok });
  }

  if (!storedPin) {
    // 如果没设置管理员密码，使用兜底密码 888888（与本地 seed 一致）
    const ok = pin === '888888';
    return json({ ok });
  }

  // 恒定时间比较（防止时序攻击）
  const ok = constantTimeCompare(String(pin), String(storedPin));
  return json({ ok });
}

/** 简单恒定时间字符串比较（防止时序攻击） */
function constantTimeCompare(a, b) {
  let result = 0;
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}
