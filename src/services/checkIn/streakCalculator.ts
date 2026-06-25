import { CheckInRecord } from '../../types/study';
import { formatDate, subtractDays, getToday } from '../utils/dateUtils';

/**
 * 计算连续打卡天数
 * 
 * 改进：自定义起始日期，默认从今天开始，若今天未打卡则从昨天开始
 * 这样设计让用户不会因为"今天还没打卡"就立刻断签，更自然
 * 
 * @param checkInRecords 打卡记录
 * @param checkInRecordsOfPrevMonth 上个月的打卡记录（跨月时需要）
 * @returns 连续打卡天数
 */
export function calculateStreak(
  checkInRecords: CheckInRecord[],
  additionalRecords?: CheckInRecord[]
): number {
  // 合并当前月 + 上个月的记录
  const allRecords = additionalRecords
    ? [...checkInRecords, ...additionalRecords]
    : checkInRecords;

  const completed = allRecords
    .filter((r) => r.isCompleted)
    // 去重：同一天多条记录只算一次
    .reduce<CheckInRecord[]>((acc, r) => {
      if (!acc.some(existing => existing.date === r.date)) {
        acc.push(r);
      }
      return acc;
    }, [])
    .sort((a, b) => b.date.localeCompare(a.date));

  if (completed.length === 0) return 0;

  // cursor 今天/昨天检查
  const today = new Date();
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(subtractDays(today, 1));

  const hasToday = completed.some(r => r.date === todayStr);
  // 起始点：今天有打卡就从今天开始，否则从昨天开始
  let cursor = hasToday ? today : subtractDays(today, 1);
  let streak = 0;

  // 从最新的打卡记录开始匹配（已完成排序，最前面是最新的）
  for (const record of completed) {
    const cursorStr = formatDate(cursor);
    const recordStr = record.date; // 已经是 YYYY-MM-DD 格式

    if (cursorStr === recordStr) {
      streak++;
      cursor = subtractDays(cursor, 1);
    } else if (recordStr < cursorStr) {
      // 记录日期小于 cursor，说明断签了
      break;
    }
    // 记录日期 > cursor（跨过未打卡的日期），不处理，继续看下一条
  }

  return streak;
}
