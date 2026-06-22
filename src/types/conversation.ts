export interface Conversation {
  id: string;
  date: string;
  scenario: 'daily' | 'campus' | 'interview' | 'travel' | 'shopping';
  duration: number;
  roundCount: number;
  wordsIntroduced: string[];
  messages: Message[];
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  timestamp: string;
  introducedWords?: string[];
  corrections?: Correction[];
}

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}
