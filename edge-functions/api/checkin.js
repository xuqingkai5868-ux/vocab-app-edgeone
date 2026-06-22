// ===== /api/checkin =====
// EdgeOne Pages Edge Function (onRequest style)
// POST  /api/checkin           → 创建/更新打卡记录
// GET   /api/checkin?month=2026-06 → 获取当月打卡记录
//
// KV key: checkin:{userId}:{date}

import { kvGetJSON, kvSetJSON, kvKeysByPrefix } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

function checkinKey(userId, date) {
  return `checkin:${userId}:${date}`;
}

export async function onRequestPost({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId } = auth.session;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_request', message: 'Body 必须是 JSON' }, 400);
  }

  const { date, isCompleted, studyDuration, newWordsCount, reviewWordsCount } = body || {};

  if (!date || typeof isCompleted !== 'boolean') {
    return json({ error: 'missing_fields', message: '需要 date 和 isCompleted' }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'invalid_date', message: '日期格式应为 YYYY-MM-DD' }, 400);
  }

  const record = {
    date,
    isCompleted,
    studyDuration: studyDuration || 0,
    newWordsCount: newWordsCount || 0,
    reviewWordsCount: reviewWordsCount || 0,
    checkInAt: isCompleted ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  };

  await kvSetJSON(checkinKey(userId, date), record);

  return json({ ok: true, record });
}

export async function onRequestGet({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);

  const { userId } = auth.session;
  const url = new URL(request.url);
  const month = url.searchParams.get('month');

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return json({ error: 'missing_month', message: '需要 month 参数，格式 YYYY-MM' }, 400);
  }

  const prefix = `checkin:${userId}:${month}`;
  const keys = await kvKeysByPrefix(prefix);

  // 去除前缀，只保留日期部分作为 key
  const records = {};
  for (const key of keys) {
    const record = await kvGetJSON(key);
    if (record) {
      records[record.date] = record;
    }
  }

  return json({ userId, month, records });
}
