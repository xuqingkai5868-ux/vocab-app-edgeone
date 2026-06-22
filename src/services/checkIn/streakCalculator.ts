import { CheckInRecord } from '../../types/study';
import { formatDate, subtractDays } from '../utils/dateUtils';

export function calculateStreak(checkInRecords: CheckInRecord[]): number {
  const completed = checkInRecords
    .filter((r) => r.isCompleted)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (completed.length === 0) return 0;

  let streak = 0;
  let cursor = new Date();

  for (const record of completed) {
    const [year, month, day] = record.date.split('-').map(Number);
    const recordDate = new Date(year, month - 1, day);

    const cursorStr = formatDate(cursor);
    const recordStr = formatDate(recordDate);

    if (cursorStr === recordStr) {
      streak++;
      cursor = subtractDays(cursor, 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getMonthCheckInDays(
  records: CheckInRecord[],
  year: number,
  month: number
): number {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return records.filter(
    (r) => r.date.startsWith(monthStr) && r.isCompleted
  ).length;
}
