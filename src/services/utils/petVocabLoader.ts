// petVocabLoader.ts — PET 词库加载器（支持动态 wordsPerDay）
import petScheduleData from '../../../pet_schedule_v2.json';

export interface PETWord {
  word: string;
  pos: string;
  meaning: string;
}

export interface PETPhrase {
  phrase: string;
  meaning: string;
  source: 'book' | 'cambridge_official';
  associated_word?: string;
}

// Master word list — all 2672 words in shuffled order
const scheduleData = petScheduleData as any;
export const MASTER_WORDS: PETWord[] = [];
const seen = new Set<string>();
for (const d of scheduleData.schedule) {
  for (const w of d.words) {
    const key = w.word.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      MASTER_WORDS.push({ word: w.word, pos: w.pos || '', meaning: w.meaning });
    }
  }
}

// Master phrase list
export const MASTER_PHRASES: (PETPhrase & { day: number })[] = [];
const seenPhrases = new Set<string>();
for (const d of scheduleData.schedule) {
  for (const p of d.phrases) {
    const key = p.phrase.toLowerCase().trim();
    if (!seenPhrases.has(key)) {
      seenPhrases.add(key);
      MASTER_PHRASES.push({
        phrase: p.phrase,
        meaning: p.meaning || '',
        source: p.source || 'book',
        associated_word: p.associated_word || '',
        day: d.day
      });
    }
  }
}

/**
 * Get total days for a given wordsPerDay setting
 */
export function getTotalDays(wordsPerDay: number): number {
  return Math.ceil(MASTER_WORDS.length / wordsPerDay);
}

/**
 * Get words for a specific day based on wordsPerDay setting
 */
export function getDayWords(day: number, wordsPerDay: number): PETWord[] {
  const start = (day - 1) * wordsPerDay;
  return MASTER_WORDS.slice(start, start + wordsPerDay);
}

/**
 * Get phrases for a specific day's words
 */
export function getDayPhrases(day: number, wordsPerDay: number): PETPhrase[] {
  const dayWords = getDayWords(day, wordsPerDay);
  const wordSet = new Set(dayWords.map(w => w.word.toLowerCase()));
  return MASTER_PHRASES.filter(p => {
    const assoc = (p.associated_word || '').toLowerCase();
    return assoc && wordSet.has(assoc);
  });
}

// Pre-built flat array for search performance (built once at module load)
export const ALL_FLAT_WORDS: PETWord[] = [...MASTER_WORDS];

/**
 * Search all words
 */
export function searchWords(query: string, wordsPerDay: number): { word: PETWord; day: number }[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: { word: PETWord; day: number }[] = [];
  for (let i = 0; i < ALL_FLAT_WORDS.length; i++) {
    const w = ALL_FLAT_WORDS[i];
    if (w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)) {
      results.push({ word: w, day: Math.floor(i / wordsPerDay) + 1 });
      if (results.length >= 50) break;
    }
  }
  return results;
}

/**
 * Get grammar stage for a given day
 */
export function getGrammarStage(day: number, wordsPerDay: number): number {
  const totalDays = getTotalDays(wordsPerDay);
  const stageSize = Math.max(1, Math.floor(totalDays / 5));
  return Math.min(Math.floor((day - 1) / stageSize) + 1, 5);
}
