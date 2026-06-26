// ===== POST /api/verify-admin-pin =====
// EdgeOne Pages Edge Function
// 验证家长密码（不存储在前端，防止孩子通过源码查看密码）
// 请求体：{ pin: "888888" }
// 响应：{ ok: true/false }

import { K, kvGet } from './_lib/kv.js';
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

  // 888888 是**兜底密码**，始终生效（不管 KV 存了什么）
  // 同时检查 KV 中是否存了自定义密码，如果匹配也通过
  if (pin === '888888') {
    return json({ ok: true });
  }

  const storedPin = await kvGet(K.pin('admin'));
  if (storedPin) {
    return json({ ok: constantTimeCompare(String(pin), String(storedPin)) });
  }

  // KV 没有自定义密码，且输入的也不是 888888
  return json({ ok: false });
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
