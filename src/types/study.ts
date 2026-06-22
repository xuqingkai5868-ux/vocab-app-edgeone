export type SelfAssessment = 'forgot' | 'vague' | 'known';

export interface StudyRecord {
  id: string;
  wordId: string;
  studyDate: string;
  reviewStage: 0 | 1 | 2 | 3 | 4 | 5;
  isCorrect: boolean | null;
  selfAssessment: SelfAssessment | null;
  studyType: 'learning' | 'review';
  createdAt: string;
}

export interface CheckInRecord {
  id: string;
  date: string;
  isCompleted: boolean;
  studyDuration: number;
  newWordsCount: number;
  reviewWordsCount: number;
  conversationRounds: number;
  checkInAt: string | null;
  motivationId: string | null;
}

export interface DailyPlan {
  date: string;
  newWordsTarget: number;
  reviewWordsTarget: number;
  newWordsCompleted: number;
  reviewWordsCompleted: number;
  studyDuration: number;
  isCompleted: boolean;
}

export interface LearningStats {
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

export type ExamTarget = 'postgraduate' | 'ielts' | 'toefl' | 'cet4' | 'cet6' | 'none';

export interface AppSettings {
  dailyStudyMinutes: number;
  dailyNewWordsTarget: number;
  dailyReviewTarget: number;
  reminderTime: string | null;
  reminderEnabled: boolean;
  examTarget: ExamTarget;
  aiModel: string;
  apiKey: string;
  defaultScenario: string;
  learningMode: 'immersion' | 'quick';
  darkMode: 'system' | 'light' | 'dark';
}
