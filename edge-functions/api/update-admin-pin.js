// ===== POST /api/update-admin-pin =====
// EdgeOne Pages Edge Function
// 修改家长密码（需要验证旧密码）
// 请求体：{ currentPin: "888888", newPin: "新密码" }
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

  const { currentPin, newPin } = body || {};
  if (!currentPin || !newPin || typeof currentPin !== 'string' || typeof newPin !== 'string') {
    return json({ error: 'missing_fields', message: '需要 currentPin 和 newPin' }, 400);
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    return json({ error: 'invalid_pin', message: '新密码必须是 4-8 位数字' }, 400);
  }

  // 1. 验证旧密码
  const storedPin = await kvGet(K.pin('admin'));
  if (storedPin) {
    if (currentPin !== storedPin) {
      return json({ ok: false, message: '旧密码不正确' }, 403);
    }
  } else {
    // KV 无密码时，用兜底 888888 验证
    if (currentPin !== '888888') {
      return json({ ok: false, message: '旧密码不正确' }, 403);
    }
  }

  // 2. 更新密码
  await kvSet(K.pin('admin'), newPin);
  return json({ ok: true });
}
