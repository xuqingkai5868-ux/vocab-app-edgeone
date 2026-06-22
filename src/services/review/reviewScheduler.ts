import { SelfAssessment } from '../../types/study';
import { addDays, formatDate } from '../utils/dateUtils';

export const REVIEW_INTERVALS = [1, 2, 4, 7, 15] as const;
export const MAX_REVIEW_STAGE = 5;

export interface NextReviewResult {
  nextStage: number;
  nextReviewDate: string;
}

export function calculateNextReview(
  currentStage: number,
  selfAssessment: SelfAssessment
): NextReviewResult {
  let nextStage: number;

  switch (selfAssessment) {
    case 'known':
      nextStage = Math.min(currentStage + 1, MAX_REVIEW_STAGE);
      break;
    case 'vague':
      nextStage = currentStage;
      break;
    case 'forgot':
      nextStage = Math.max(currentStage - 1, 0);
      break;
    default:
      nextStage = currentStage;
  }

  const intervalIndex = Math.min(nextStage, REVIEW_INTERVALS.length - 1);
  const daysToAdd = REVIEW_INTERVALS[intervalIndex];
  const nextReviewDate = formatDate(addDays(new Date(), daysToAdd));

  return { nextStage, nextReviewDate };
}

export function getInitialReviewDate(): string {
  return formatDate(addDays(new Date(), REVIEW_INTERVALS[0]));
}

export function getReviewIntervalDescription(stage: number): string {
  const index = Math.min(stage, REVIEW_INTERVALS.length - 1);
  const days = REVIEW_INTERVALS[index];
  if (days === 1) return '明天';
  return `${days}天后`;
}
