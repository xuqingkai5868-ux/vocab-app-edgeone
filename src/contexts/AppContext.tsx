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
      loadDayData(newState.currentDay, wordsPerDay);
    } catch (e) {
      console.error('Failed to update state:', e);
    }
  }, [user, wordsPerDay, loadDayData]);

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
      // 打卡成功后，推进到下一天
      const totalDays = getTotalDays(wordsPerDay);
      const nextDay = Math.min(userState.currentDay + 1, totalDays);
      const newState = { ...userState, currentDay: nextDay };
      await updateState(user.id, newState);
      setUserState(newState);
      loadDayData(nextDay, wordsPerDay);
      await refreshCheckIns();
      return true;
    } catch {
      return false;
    }
  }, [user, wordsPerDay, userState, loadDayData, refreshCheckIns]);

  const totalDays = getTotalDays(wordsPerDay);

  return (
    <AppContext.Provider value={{
      state: userState, checkIns, streak,
      todayNewWords, todayPhrases, todayStage, wordsPerDay,
      loadAll, updateUserState, setWordsPerDay, doCheckIn,
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
