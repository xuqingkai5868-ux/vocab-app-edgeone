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
  // 条件A：新词达标 + 学习时长 > 0
  if (newWordsCompleted >= newWordsTarget && studyDurationMinutes > 0) return true;
  // 条件B：复习达标 + 学习时长 >= 10
  if (reviewWordsCompleted >= reviewWordsTarget && studyDurationMinutes >= 10) return true;
  // 条件C：学习时长 >= 15
  if (studyDurationMinutes >= 15) return true;
  return false;
}
