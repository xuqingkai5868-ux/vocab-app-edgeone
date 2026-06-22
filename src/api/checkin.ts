// 打卡 API
import { apiGet, apiPost } from './client';
import type { CheckInRecord } from '../types/study';

export interface CheckInResponse {
  ok: boolean;
  record: CheckInRecord;
}

export interface CheckInListResponse {
  userId: string;
  month: string;
  records: Record<string, CheckInRecord>;
}

export async function createCheckIn(record: Omit<CheckInRecord, 'checkInAt' | 'motivationId' | 'id'>): Promise<CheckInResponse> {
  return apiPost<CheckInResponse>('/checkin', record);
}

export async function getCheckIns(month: string): Promise<CheckInListResponse> {
  return apiGet<CheckInListResponse>(`/checkin?month=${month}`);
}
