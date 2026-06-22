// 学习进度 API
import { apiGet, apiPut } from './client';

export interface UserState {
  currentDay: number;
  states: Record<string, 'mastered' | 'fuzzy'>;
  lastUpdated?: number;
}

export interface StateResponse {
  userId: string;
  state: UserState;
}

export async function getState(userId: string): Promise<StateResponse> {
  return apiGet<StateResponse>(`/state?userId=${userId}`);
}

export async function updateState(userId: string, state: UserState): Promise<{ ok: boolean; userId: string; lastUpdated: number }> {
  return apiPut<{ ok: boolean; userId: string; lastUpdated: number }>('/state', { userId, state });
}
