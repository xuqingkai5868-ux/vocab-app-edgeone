// 改造后的 checkInService
// 纯函数版本，不依赖任何存储层

export function canCheckIn(params: {
  newWordsCompleted: number;
  reviewWordsCompleted: number;
  studyDurationMinutes: number;
  newWordsTarget: number;
  reviewWordsTarget: number;
}): boolean {
  const { newWordsCompleted, reviewWordsCompleted, studyDurationMinutes, newWordsTarget, reviewWordsTarget } = params;
  // 条件A：新词达标（✓掌握 + △模糊 都算学过）
  if (newWordsCompleted >= newWordsTarget && studyDurationMinutes > 0) return true;
  // 条件B：复习达标
  if (reviewWordsCompleted >= reviewWordsTarget && studyDurationMinutes >= 10) return true;
  return false;
}
