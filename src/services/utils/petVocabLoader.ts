// petVocabLoader.ts — PET 词库加载器（支持动态 wordsPerDay）
// JSON 数据在运行时通过 fetch 懒加载，不内联到 JS Bundle（节省 ~442KB）

export interface PETWord {
  word: string;
  pos: string;
  meaning: string;
  example?: string;
  translation?: string;
}

export interface PETPhrase {
  phrase: string;
  meaning: string;
  source: 'book' | 'cambridge_official';
  associated_word?: string;
}

// 数据加载状态
let _loaded = false;

// Master word list — all 2672 words in shuffled order
export const MASTER_WORDS: PETWord[] = [];

// Master phrase list
export const MASTER_PHRASES: (PETPhrase & { day: number })[] = [];

// 预缓存的词小写版本（提升搜索性能）
const _wordLower: string[] = [];
const _meaningLower: string[] = [];

// 数据初始化 Promise（模块级，只加载一次）
let _initPromise: Promise<void> | null = null;

/**
 * 确保词库已加载。在 App 渲染前调用一次即可。
 */
export function ensureVocabLoaded(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = (async () => {
    try {
      const resp = await fetch('/pet_schedule_v2.json');
      const data: any = await resp.json();

      // 构建主词表（去重）
      const seen = new Set<string>();
      for (const d of data.schedule) {
        for (const w of d.words) {
          const key = w.word.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            MASTER_WORDS.push({ word: w.word, pos: w.pos || '', meaning: w.meaning, example: w.example, translation: w.translation });
          }
        }
      }

      // 预缓存小写（P2-13 优化）
      for (let i = 0; i < MASTER_WORDS.length; i++) {
        _wordLower[i] = MASTER_WORDS[i].word.toLowerCase();
        _meaningLower[i] = MASTER_WORDS[i].meaning.toLowerCase();
      }

      // 构建短语表（去重）
      const seenPhrases = new Set<string>();
      for (const d of data.schedule) {
        for (const p of d.phrases) {
          const key = p.phrase.toLowerCase().trim();
          if (!seenPhrases.has(key)) {
            seenPhrases.add(key);
            MASTER_PHRASES.push({
              phrase: p.phrase,
              meaning: p.meaning || '',
              source: p.source || 'book',
              associated_word: p.associated_word || '',
              day: d.day,
            });
          }
        }
      }

      _loaded = true;
    } catch (e) {
      // 加载失败时重置 _initPromise，让后续调用可以重试
      _initPromise = null;
      console.error('[petVocabLoader] 词库加载失败，可重试:', e);
      throw e;
    }
  })();
  return _initPromise;
}

/** 确保已加载，否则返回空（调用方应在 App 启动时 await ensureVocabLoaded） */
function guardLoaded(): boolean {
  if (!_loaded) {
    console.warn('[petVocabLoader] 词库尚未加载，返回空。请确保 ensureVocabLoaded() 已在 App 启动时调用。');
    return false;
  }
  return true;
}

/**
 * Get total days for a given wordsPerDay setting
 */
export function getTotalDays(wordsPerDay: number): number {
  if (!guardLoaded()) return 1;
  return Math.ceil(MASTER_WORDS.length / wordsPerDay);
}

/**
 * Get words for a specific day based on wordsPerDay setting
 */
export function getDayWords(day: number, wordsPerDay: number): PETWord[] {
  if (!guardLoaded()) return [];
  const start = (day - 1) * wordsPerDay;
  return MASTER_WORDS.slice(start, start + wordsPerDay);
}

/**
 * Get phrases for a specific day's words
 */
export function getDayPhrases(day: number, wordsPerDay: number): PETPhrase[] {
  if (!guardLoaded()) return [];
  const dayWords = getDayWords(day, wordsPerDay);
  const wordSet = new Set(dayWords.map(w => w.word.toLowerCase()));
  return MASTER_PHRASES.filter(p => {
    const assoc = (p.associated_word || '').toLowerCase();
    // 有关联词的短语：按关联词匹配当天单词
    if (assoc) return wordSet.has(assoc);
    // 无关联词的短语：按 day 字段匹配
    if (!assoc && p.day === day) return true;
    return false;
  });
}

/**
 * Search all words — 使用预缓存的小写版本加速
 */
export function searchWords(query: string, wordsPerDay: number): { word: PETWord; day: number }[] {
  if (!guardLoaded() || !MASTER_WORDS.length) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { word: PETWord; day: number }[] = [];
  for (let i = 0; i < MASTER_WORDS.length; i++) {
    if (_wordLower[i]?.includes(q) || _meaningLower[i]?.includes(q)) {
      results.push({ word: MASTER_WORDS[i], day: Math.floor(i / wordsPerDay) + 1 });
      if (results.length >= 50) break;
    }
  }
  return results;
}

/**
 * Get grammar stage for a given day
 */
export function getGrammarStage(day: number, wordsPerDay: number): number {
  if (!guardLoaded()) return 1;
  const totalDays = getTotalDays(wordsPerDay);
  const stageSize = Math.max(1, Math.floor(totalDays / 5));
  return Math.min(Math.floor((day - 1) / stageSize) + 1, 5);
}
