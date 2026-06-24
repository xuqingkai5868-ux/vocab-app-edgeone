// 学习进度 API
import { apiGet, apiPut } from './client';

export interface UserState {
  currentDay: number;
  /** 单词掌握等级: 0=未学, 1=刚学, 2=模糊, 3=已知, 4=掌握 */
  states: Record<string, number>;
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
