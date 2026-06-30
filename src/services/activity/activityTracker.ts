// 活动追踪器 — 自动记录用户在各个环节的操作时间和轨迹
import { logActivity } from '../../api/activity';

type ActivityType = 'study' | 'review_definition' | 'review_spelling' | 'review_audio' | 'vocabulary' | 'checkin';

const trackers: Record<string, { type: ActivityType; startTime: number }> = {};

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 当用户进入某个活动页时调用
 * 默认使用 type 作为 key，确保 start 和 stop 的 key 一致
 */
export function startTracking(type: ActivityType, key?: string) {
  trackers[key ?? type] = { type, startTime: Date.now() };
}

/**
 * 当用户离开活动页时调用，自动计算时长并上报
 */
export async function stopTracking(key = 'default', details = ''): Promise<void> {
  const t = trackers[key];
  if (!t) return;

  const endTime = Date.now();
  const duration = endTime - t.startTime;
  delete trackers[key];

  // 少于 3 秒的记录不上报（可能是误触）
  if (duration < 3000) return;

  try {
    await logActivity({
      type: t.type,
      startTime: t.startTime,
      endTime,
      duration,
      details,
      date: getToday(),
    });
  } catch {
    // 静默失败，不打扰用户
  }
}

/**
 * 获取当前所有追踪 session 的总耗时（用于打卡等外部统计）
 */
export function getActiveTracking(): { type: ActivityType; elapsed: number } | null {
  const keys = Object.keys(trackers);
  if (keys.length === 0) return null;
  // 汇总所有活跃追踪器的耗时
  const totalElapsed = keys.reduce((sum, k) => sum + (Date.now() - trackers[k].startTime), 0);
  return { type: trackers[keys[0]].type, elapsed: totalElapsed };
}
