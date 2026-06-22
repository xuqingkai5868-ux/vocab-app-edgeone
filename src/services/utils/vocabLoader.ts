// vocabLoader.ts — 解析 schedule.min.json，提供单词索引和学习计划查询

export interface ScheduleWord {
  theme: string;
  themeIdx: number;
  word: string;
  cn: string;
  phrase: string;
}

export interface ScheduleDay {
  day: number;
  type: string;
  words: ScheduleWord[];
  themes: string[];
}

export interface VocabIndex {
  /** wordId 到单词详情映射，wordId = `${theme}|${word}` */
  byId: Map<string, ScheduleWord>;
  /** 原始 day 列表 */
  days: ScheduleDay[];
}

let vocabCache: VocabIndex | null = null;

/**
 * 加载 schedule.min.json 并构建索引
 */
export async function loadVocab(): Promise<VocabIndex> {
  if (vocabCache) return vocabCache;

  const response = await fetch('/schedule.min.json');
  const data: ScheduleDay[] = await response.json();

  const byId = new Map<string, ScheduleWord>();
  const days: ScheduleDay[] = [];

  for (const day of data) {
    days.push(day);
    for (const w of day.words) {
      const wordId = `${w.theme}|${w.word}`;
      if (!byId.has(wordId)) {
        byId.set(wordId, w);
      }
    }
  }

  vocabCache = { byId, days };
  return vocabCache;
}

/**
 * 获取某天的单词列表
 */
export function getDayWords(day: number, index: VocabIndex): ScheduleWord[] {
  const dayData = index.days.find((d) => d.day === day);
  return dayData?.words || [];
}

/**
 * 获取所有单词（去重）
 */
export function getAllWords(index: VocabIndex): ScheduleWord[] {
  return Array.from(index.byId.values());
}

/**
 * 获取总天数
 */
export function getTotalDays(index: VocabIndex): number {
  return index.days.length;
}

/**
 * 获取当天单词列表
 */
export async function getTodayWords(day: number): Promise<{ newWords: ScheduleWord[]; reviewWordIds: string[] }> {
  const index = await loadVocab();
  const newWords = getDayWords(day, index);
  return { newWords, reviewWordIds: [] };
}

/**
 * 搜索单词
 */
export function searchWords(query: string, index: VocabIndex): ScheduleWord[] {
  const q = query.toLowerCase();
  const results: ScheduleWord[] = [];
  for (const word of index.byId.values()) {
    if (word.word.toLowerCase().includes(q) || word.cn.includes(q)) {
      results.push(word);
    }
  }
  return results;
}
