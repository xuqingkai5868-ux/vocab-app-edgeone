// 统计 API — 利用现有 API 聚合统计数据
import { getState } from './state';
import { getCheckIns } from './checkin';
import { getCurrentYear, getCurrentMonth, getWeekStart, getToday } from '../services/utils/dateUtils';

export interface DashboardStats {
  totalDays: number;
  totalWordsLearned: number;
  totalConversationMinutes: number;
  totalCheckInDays: number;
  streakDays: number;
  monthCheckInDays: number;
  monthTotalDays: number;
  monthNewWords: number;
  monthReviewWords: number;
  weekStudyMinutes: number;
  lastWeekStudyMinutes: number;
  weekNewWords: number;
  lastWeekNewWords: number;
}

export async function getStats(userId: string): Promise<DashboardStats> {
  const now = new Date();
  const year = getCurrentYear();
  const month = getCurrentMonth();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  // 获取当月打卡
  const checkinResp = await getCheckIns(monthStr);
  const records = Object.values(checkinResp.records);

  // 获取学习状态
  const stateResp = await getState(userId);

  // 计算连续打卡
  const completed = records.filter((r) => r.isCompleted);
  let streak = 0;
  const checkinDates = completed.map((r) => r.date).sort().reverse();
  const today = getToday();
  let cursorDate = today;
  for (const d of checkinDates) {
    if (d === cursorDate) {
      streak++;
      const [y, m, day] = cursorDate.split('-').map(Number);
      const prev = new Date(y, m - 1, day - 1);
      cursorDate = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
    } else {
      break;
    }
  }

  const totalCheckInDays = Math.max(
    ...completed.map((r) => parseInt(r.date.replace(/-/g, ''), 10)),
    0
  ) ? completed.length : 0;

  // 本周统计
  const weekStart = getWeekStart(now);
  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
  const weekRecords = records.filter((r) => r.date >= weekStartStr);
  const weekStudyMinutes = weekRecords.reduce((s, r) => s + (r.studyDuration || 0), 0);

  // 上周统计
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekStartStr = `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, '0')}-${String(lastWeekStart.getDate()).padStart(2, '0')}`;
  const lastWeekRecords = records.filter(
    (r) => r.date >= lastWeekStartStr && r.date < weekStartStr
  );
  const lastWeekStudyMinutes = lastWeekRecords.reduce((s, r) => s + (r.studyDuration || 0), 0);

  // 总学习天数
  const allCheckinKeys = Object.keys(checkinResp.records);
  const totalDays = allCheckinKeys.length;

  // 单词总数
  const totalWordsLearned = Object.keys(stateResp.state.states).length;

  return {
    totalDays,
    totalWordsLearned,
    totalConversationMinutes: 0,
    totalCheckInDays,
    streakDays: streak,
    monthCheckInDays: completed.length,
    monthTotalDays: new Date(year, month, 0).getDate(),
    monthNewWords: completed.reduce((s, r) => s + (r.newWordsCount || 0), 0),
    monthReviewWords: completed.reduce((s, r) => s + (r.reviewWordsCount || 0), 0),
    weekStudyMinutes,
    lastWeekStudyMinutes,
    weekNewWords: weekRecords.reduce((s, r) => s + (r.newWordsCount || 0), 0),
    lastWeekNewWords: lastWeekRecords.reduce((s, r) => s + (r.newWordsCount || 0), 0),
  };
}
