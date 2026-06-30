// ===== /api/activity =====
// EdgeOne Pages Edge Function
// POST  /api/activity           → 记录一条活动事件（自动归入当日）
// GET   /api/activity?date=2026-06-23 → 获取指定日期的活动日志
//
// KV key: activity:{userId}:{date} → ActivityEvent[]

import { kvGetJSON, kvSetJSON } from './_lib/kv.js';
import { json } from './_lib/respond.js';
import { verifyToken } from './_lib/verifyToken.js';

function activityKey(userId, date) {
  return `activity:${userId}:${date}`;
}

/**
 * ActivityEvent 结构
 * {
 *   type: 'study' | 'review_definition' | 'review_spelling' | 'review_audio' | 'vocabulary' | 'checkin' | 'review_spelling_result' | 'review_audio_result',
 *   startTime: number,    // 进入页面的时间戳 (ms)
 *   endTime: number,      // 离开页面的时间戳 (ms)
 *   duration: number,     // 持续时长 (ms)
 *   details: string,      // 额外信息，如完成数量
 *   date: string          // YYYY-MM-DD
 * }
 */

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

  const { type, startTime, endTime, duration, details, date } = body || {};

  if (!type || !date) {
    return json({ error: 'missing_fields', message: '需要 type 和 date' }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ error: 'invalid_date', message: '日期格式应为 YYYY-MM-DD' }, 400);
  }

  const key = activityKey(userId, date);
  const events = (await kvGetJSON(key)) || [];

  const event = {
    type,
    startTime: startTime || Date.now(),
    endTime: endTime || null,
    duration: duration || 0,
    details: details || '',
    date,
  };

  events.push(event);

  // 每个日期只保留最近 500 条事件
  if (events.length > 500) {
    events.splice(0, events.length - 500);
  }

  await kvSetJSON(key, events);

  return json({ ok: true, event });
}

export async function onRequestGet({ request }) {
  const auth = await verifyToken(request);
  if (auth.error) return json({ error: auth.error, message: auth.message }, auth.status);
  const { userId } = auth.session;

  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const range = url.searchParams.get('range'); // 'week' | 'month'

  if (date) {
    // 查特定日期
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'invalid_date', message: '日期格式应为 YYYY-MM-DD' }, 400);
    }
    const events = (await kvGetJSON(activityKey(userId, date))) || [];
    return json({ userId, date, events });
  }

  if (range === 'week' || range === 'month') {
    // 查一周或一个月
    const now = new Date();
    const results = {};
    const days = range === 'week' ? 7 : 30;

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const events = (await kvGetJSON(activityKey(userId, dateStr))) || [];
      if (events.length > 0) {
        results[dateStr] = events;
      }
    }

    return json({ userId, range, results });
  }

  return json({ error: 'missing_param', message: '需要 date 或 range 参数' }, 400);
}
