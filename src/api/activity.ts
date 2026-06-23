// 活动追踪 API
import { apiGet, apiPost } from './client';

export interface ActivityEvent {
  type: 'study' | 'review_definition' | 'review_spelling' | 'review_audio' | 'vocabulary' | 'checkin';
  startTime: number;
  endTime: number | null;
  duration: number;
  details: string;
  date: string;
}

export interface ActivityResponse {
  ok: boolean;
  event: ActivityEvent;
}

export interface ActivityListResponse {
  userId: string;
  date: string;
  events: ActivityEvent[];
}

export interface ActivityRangeResponse {
  userId: string;
  range: string;
  results: Record<string, ActivityEvent[]>;
}

export async function logActivity(event: {
  type: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  details?: string;
  date: string;
}): Promise<ActivityResponse> {
  return apiPost<ActivityResponse>('/activity', event);
}

export async function getActivity(date: string): Promise<ActivityListResponse> {
  return apiGet<ActivityListResponse>(`/activity?date=${date}`);
}

export async function getActivityRange(range: 'week' | 'month'): Promise<ActivityRangeResponse> {
  return apiGet<ActivityRangeResponse>(`/activity?range=${range}`);
}
