// ===== POST /api/seed =====
// Vercel Function (Web fetch-style)
// 初始化 3 个账号（PIN + 资料 + 空 state）
// 首次 seed：开放（无 admin 存在即可）
// 再次 seed：需要传 adminConfirmPin（admin 账号的 PIN）才能覆盖
//
// 请求体：
// {
//   users: {
//     gao:   { name: "哥哥", role: "user", grade: "高一" },
//     di:    { name: "弟弟", role: "user", grade: "三年级" },
//     admin: { name: "管理员", role: "admin" }
//   },
//   pins: { gao: "1234", di: "5678", admin: "9999" },
//   adminConfirmPin?: "9999"   // 已 seed 过时必填
// }

import { K, kvGet, kvSetJSON, kvGetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const { users, pins, adminConfirmPin } = body || {};
  if (!users || !pins || typeof users !== 'object' || typeof pins !== 'object') {
    return json({ error: 'missing_fields', message: '需要 users 和 pins' }, 400);
  }

  // 检查是否已 seed 过
  const existingAdminUser = await kvGet(K.user('admin'));
  if (existingAdminUser) {
    if (!adminConfirmPin) {
      return json({
        error: 'already_seeded',
        message: '已初始化过，需要传 adminConfirmPin 才能覆盖'
      }, 403);
    }
    const storedAdminPin = await kvGet(K.pin('admin'));
    if (String(adminConfirmPin) !== String(storedAdminPin)) {
      return json({ error: 'wrong_admin_pin' }, 403);
    }
  }

  // 写入 users 和 pins
  for (const [id, user] of Object.entries(users)) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(id)) {
      return json({ error: 'invalid_user_id', id }, 400);
    }
    if (!user || typeof user !== 'object' || !user.name || !user.role) {
      return json({ error: 'invalid_user', id }, 400);
    }
    if (!['user', 'admin'].includes(user.role)) {
      return json({ error: 'invalid_role', id, role: user.role }, 400);
    }
    if (!pins[id] || !/^\d{4,8}$/.test(String(pins[id]))) {
      return json({ error: 'invalid_pin', id, message: 'PIN 必须是 4-8 位数字' }, 400);
    }

    await kvSetJSON(K.user(id), user);
    await kvSetJSON(K.pin(id), String(pins[id]));

    const existingState = await kvGetJSON(K.state(id));
    if (!existingState) {
      await kvSetJSON(K.state(id), {
        currentDay: 1,
        states: {},
        lastUpdated: Date.now()
      });
    }
  }

  return json({
    ok: true,
    seeded: Object.keys(users),
    overwritten: !!existingAdminUser
  });
}
