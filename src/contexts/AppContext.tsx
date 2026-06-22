import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getState, updateState, UserState } from '../api/state';
import { createCheckIn, getCheckIns } from '../api/checkin';
import type { CheckInRecord } from '../types/study';
import { getStats, DashboardStats } from '../api/stats';
import { loadVocab, ScheduleWord, VocabIndex, getDayWords } from '../services/utils/vocabLoader';
import { canCheckIn } from '../services/checkIn/checkInService';
import { calculateStreak } from '../services/checkIn/streakCalculator';
import { getToday, getCurrentYear, getCurrentMonth } from '../services/utils/dateUtils';

interface AppContextType {
  // 词库
  vocabIndex: VocabIndex | null;
  // 学习状态
  state: UserState;
  // 打卡
  checkIns: Record<string, CheckInRecord>;
  streak: number;
  // 统计
  stats: DashboardStats | null;
  // 今日学习
  todayNewWords: ScheduleWord[];
  // Actions
  loadAll: () => Promise<void>;
  updateUserState: (newState: UserState) => Promise<void>;
  doCheckIn: (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => Promise<boolean>;
  refreshCheckIns: () => Promise<void>;
  refreshStats: () => Promise<void>;
}

const defaultState: UserState = { currentDay: 1, states: {} };

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [vocabIndex, setVocabIndex] = useState<VocabIndex | null>(null);
  const [userState, setUserState] = useState<UserState>(defaultState);
  const [checkIns, setCheckIns] = useState<Record<string, CheckInRecord>>({});
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayNewWords, setTodayNewWords] = useState<ScheduleWord[]>([]);

  const loadAll = useCallback(async () => {
    // 加载词库（本地，无网络请求）
    const vi = await loadVocab();
    setVocabIndex(vi);

    if (!user) return;

    // 并行加载学习状态、打卡（减少串行等待）
    try {
      const [stateResp, checkinResp] = await Promise.all([
        getState(user.id),
        getCheckIns(`${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`),
      ]);

      // 学习状态
      setUserState(stateResp.state);

      // 今日新词
      const tnw = getDayWords(stateResp.state.currentDay, vi);
      setTodayNewWords(tnw);

      // 打卡记录
      setCheckIns(checkinResp.records);
      const records = Object.values(checkinResp.records);
      setStreak(calculateStreak(records));
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, [user]);

  const refreshCheckIns = useCallback(async () => {
    if (!user) return;
    try {
      const monthStr = `${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`;
      const resp = await getCheckIns(monthStr);
      setCheckIns(resp.records);
      const records = Object.values(resp.records);
      setStreak(calculateStreak(records));
    } catch (e) {
      console.error('Failed to load checkins:', e);
    }
  }, [user]);

  const refreshStats = useCallback(async () => {
    if (!user) return;
    try {
      const s = await getStats(user.id);
      setStats(s);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  }, [user]);

  const updateUserState = useCallback(async (newState: UserState) => {
    if (!user) return;
    try {
      await updateState(user.id, newState);
      setUserState(newState);
      const tnw = getDayWords(newState.currentDay, vocabIndex || await loadVocab());
      setTodayNewWords(tnw);
    } catch (e) {
      console.error('Failed to update state:', e);
      throw e;
    }
  }, [user]);

  const doCheckIn = useCallback(async (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => {
    if (!user) return false;
    const checkable = canCheckIn({
      ...params,
      newWordsTarget: 8,
      reviewWordsTarget: 15,
    });
    if (!checkable) return false;

    try {
      const today = getToday();
      await createCheckIn({
        date: today,
        isCompleted: true,
        studyDuration: params.studyDurationMinutes,
        newWordsCount: params.newWordsCompleted,
        reviewWordsCount: params.reviewWordsCompleted,
        conversationRounds: 0,
      });
      await refreshCheckIns();
      await refreshStats();
      return true;
    } catch (e) {
      console.error('Failed to check in:', e);
      return false;
    }
  }, [user, refreshCheckIns, refreshStats]);

  return (
    <AppContext.Provider value={{
      vocabIndex,
      state: userState,
      checkIns,
      streak,
      stats,
      todayNewWords,
      loadAll,
      updateUserState,
      doCheckIn,
      refreshCheckIns,
      refreshStats,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
