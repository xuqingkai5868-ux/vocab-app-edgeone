export interface Word {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: PartOfSpeech;
  example: string;
  exampleTranslation: string;
  source: WordSource;
  difficultyLevel: 1 | 2 | 3 | 4 | 5;
  wordBankId: string;
}

export type PartOfSpeech =
  | 'n.'
  | 'v.'
  | 'adj.'
  | 'adv.'
  | 'pron.'
  | 'prep.'
  | 'conj.'
  | 'interj.'
  | 'art.'
  | 'num.'
  | 'phr.';

export type WordSource =
  | 'postgraduate'
  | 'ielts'
  | 'toefl'
  | 'cet4'
  | 'cet6'
  | 'custom';

export interface VocabularyEntry {
  id: string;
  wordId: string;
  tags: string[];
  addedAt: string;
  fromSource: 'conversation' | 'review' | 'manual' | 'search';
  masteryLevel: 0 | 1 | 2 | 3 | 4 | 5;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface WordBank {
  id: string;
  name: string;
  source: string;
  description: string | null;
  createdAt: string;
}
