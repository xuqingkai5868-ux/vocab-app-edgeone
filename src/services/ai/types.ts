export interface AIRequest {
  messages: AIMessage[];
  scenario: string;
  targetWords: string[];
  knownWords: string[];
  userLevel?: 'beginner' | 'intermediate' | 'advanced';
  instructions?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  introducedWords: IntroducedWord[];
  corrections: AICorrection[];
  raw: string;
}

export interface IntroducedWord {
  word: string;
  meaning: string;
  phonetic: string;
  partOfSpeech: string;
  example: string;
  isTargetWord: boolean;
}

export interface AICorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export type AIErrorType = 'NETWORK_TIMEOUT' | 'API_AUTH_FAILED' | 'API_RATE_LIMITED' | 'API_CONTENT_SAFETY' | 'UNKNOWN';

export class AIError extends Error {
  constructor(
    message: string,
    public type: AIErrorType,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}
