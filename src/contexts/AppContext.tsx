import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getState, updateState, UserState } from '../api/state';
import { createCheckIn, getCheckIns } from '../api/checkin';
import type { CheckInRecord } from '../types/study';
import { canCheckIn } from '../services/checkIn/checkInService';
import { calculateStreak } from '../services/checkIn/streakCalculator';
import { getToday, getCurrentYear, getCurrentMonth } from '../services/utils/dateUtils';
import { getDayWords, getDayPhrases, getTotalDays, getGrammarStage, PETWord, PETPhrase } from '../services/utils/petVocabLoader';

const DEFAULT_WORDS_PER_DAY = 30;

interface AppContextType {
  state: UserState;
  checkIns: Record<string, CheckInRecord>;
  streak: number;
  todayNewWords: PETWord[];
  todayPhrases: PETPhrase[];
  todayStage: number;
  wordsPerDay: number;
  loadAll: () => Promise<void>;
  updateUserState: (newState: UserState) => Promise<void>;
  /** 轻量更新单词状态（仅修改 states，不触发热 day data 重载），使用乐观更新模式 */
  updateWordStates: (newStates: Record<string, 'mastered' | 'fuzzy'>) => Promise<void>;
  setWordsPerDay: (n: number) => void;
  doCheckIn: (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => Promise<boolean>;
}

const defaultState: UserState = { currentDay: 1, states: {} };

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [userState, setUserState] = useState<UserState>(defaultState);
  const [checkIns, setCheckIns] = useState<Record<string, CheckInRecord>>({});
  const [streak, setStreak] = useState(0);
  const [todayNewWords, setTodayNewWords] = useState<PETWord[]>([]);
  const [todayPhrases, setTodayPhrases] = useState<PETPhrase[]>([]);
  const [todayStage, setTodayStage] = useState(1);
  const [wordsPerDay, setWordsPerDayState] = useState(() => {
    const saved = localStorage.getItem('vocab_wordsPerDay');
    return saved ? parseInt(saved, 10) : DEFAULT_WORDS_PER_DAY;
  });

  const loadDayData = useCallback((day: number, wpd: number) => {
    const words = getDayWords(day, wpd);
    const phrases = getDayPhrases(day, wpd);
    const stage = getGrammarStage(day, wpd);
    setTodayNewWords(words);
    setTodayPhrases(phrases);
    setTodayStage(stage);
  }, []);

  const loadAll = useCallback(async () => {
    if (!user) return;
    try {
      const [stateResp, checkinResp] = await Promise.all([
        getState(user.id),
        getCheckIns(`${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`),
      ]);
      setUserState(stateResp.state);
      loadDayData(stateResp.state.currentDay, wordsPerDay);
      setCheckIns(checkinResp.records);
      setStreak(calculateStreak(Object.values(checkinResp.records)));
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }, [user, wordsPerDay, loadDayData]);

  const refreshCheckIns = useCallback(async () => {
    if (!user) return;
    try {
      const monthStr = `${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`;
      const resp = await getCheckIns(monthStr);
      setCheckIns(resp.records);
      setStreak(calculateStreak(Object.values(resp.records)));
    } catch (e) {
      console.error('Failed to load checkins:', e);
    }
  }, [user]);

  const updateUserState = useCallback(async (newState: UserState) => {
    if (!user) return;
    try {
      await updateState(user.id, newState);
      setUserState(newState);
      // 仅当 currentDay 实际变化时才重载日数据，避免每次 states 变化都触发
      if (newState.currentDay !== userState.currentDay) {
        loadDayData(newState.currentDay, wordsPerDay);
      }
    } catch (e) {
      console.error('Failed to update state:', e);
    }
  }, [user, wordsPerDay, loadDayData, userState.currentDay]);

  /** 轻量更新单词状态：乐观更新（先更新本地，再异步同步服务器），不重载日数据 */
  const updateWordStates = useCallback(async (newStates: Record<string, 'mastered' | 'fuzzy'>) => {
    if (!user) return;
    // 乐观更新：立即更新本地状态
    const prevState = userState;
    const newUserState = { ...prevState, states: newStates };
    setUserState(newUserState);
    try {
      await updateState(user.id, newUserState);
    } catch (e) {
      // 失败时回滚
      console.error('Failed to sync word states:', e);
      setUserState(prevState);
    }
  }, [user, userState]);

  const setWordsPerDay = useCallback((n: number) => {
    const clamped = Math.max(5, Math.min(50, n));
    setWordsPerDayState(clamped);
    localStorage.setItem('vocab_wordsPerDay', String(clamped));
    loadDayData(userState.currentDay, clamped);
  }, [userState.currentDay, loadDayData]);

  const doCheckIn = useCallback(async (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => {
    if (!user) return false;
    const checkable = canCheckIn({ ...params, newWordsTarget: wordsPerDay, reviewWordsTarget: 15 });
    if (!checkable) return false;
    try {
      await createCheckIn({
        date: getToday(), isCompleted: true,
        studyDuration: params.studyDurationMinutes,
        newWordsCount: params.newWordsCompleted,
        reviewWordsCount: params.reviewWordsCompleted,
        conversationRounds: 0,
      });
      // 打卡成功后，推进到下一天（使用函数式更新避免闭包过期）
      const totalDays = getTotalDays(wordsPerDay);
      let nextDay: number;
      setUserState(prev => {
        nextDay = Math.min(prev.currentDay + 1, totalDays);
        const newState = { ...prev, currentDay: nextDay! };
        // 异步同步服务器（不等待）
        updateState(user.id, newState).catch(e => console.error('Failed to sync checkin state:', e));
        return newState;
      });
      // 加载下一天数据
      loadDayData(nextDay!, wordsPerDay);
      await refreshCheckIns();
      return true;
    } catch {
      return false;
    }
  }, [user, wordsPerDay, loadDayData, refreshCheckIns]);

  const totalDays = getTotalDays(wordsPerDay);

  return (
    <AppContext.Provider value={{
      state: userState, checkIns, streak,
      todayNewWords, todayPhrases, todayStage, wordsPerDay,
      loadAll, updateUserState, updateWordStates, setWordsPerDay, doCheckIn,
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
