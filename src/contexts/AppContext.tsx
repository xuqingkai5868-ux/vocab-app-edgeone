import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
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
  /** 轻量更新单词状态（增量更新，只传变化的词），等级 0-4，乐观更新模式 */
  updateWordStates: (partialUpdates: Record<string, number | null>) => Promise<void>;
  setWordsPerDay: (n: number) => void;
  /** 打卡：仅记录，不再推进 currentDay */
  doCheckIn: (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => Promise<boolean>;
  /** 推进到下一天（当前 day 所有词都有等级 > 0 时可用） */
  advanceDay: () => Promise<void>;
  /** 当前 day 的词是否全部已完成 */
  isTodayComplete: boolean;
  /** 数据同步状态 */
  isSyncing: boolean;
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
    const parsed = parseInt(saved ?? '', 10);
    return Number.isFinite(parsed) ? parsed : DEFAULT_WORDS_PER_DAY;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // ---------- Refs for async safety ----------
  // P0-2: unmount 守卫，组件卸载后阻止 setState
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // P0-1: 用 ref 持有最新 user，interval/visibility 回调始终访问最新值
  const userRef = useRef(user);
  userRef.current = user;

  // P1-7: 用 ref 持有最新 loadAll，避免因 loadAll 引用变化导致 effect 频繁重建
  const loadAllRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // P1-5: advanceDay 防重入锁
  const advancingRef = useRef(false);

  // ---------- state / ref helpers ----------
  const stateRef = useRef(userState);
  stateRef.current = userState;

  // 登出时重置所有状态，防止跨用户数据泄漏
  useEffect(() => {
    if (!user) {
      setUserState(defaultState);
      setCheckIns({});
      setStreak(0);
      setTodayNewWords([]);
      setTodayPhrases([]);
      setTodayStage(1);
    }
  }, [user]);

  const loadDayData = useCallback((day: number, wpd: number) => {
    const words = getDayWords(day, wpd);
    const phrases = getDayPhrases(day, wpd);
    const stage = getGrammarStage(day, wpd);
    setTodayNewWords(words);
    setTodayPhrases(phrases);
    setTodayStage(stage);
  }, []);

  const loadAll = useCallback(async () => {
    if (!userRef.current) return;
    setIsSyncing(true);
    try {
      const thisMonth = `${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`;
      // 同时获取上月数据以支持跨月连续打卡计算
      const prevDate = new Date();
      prevDate.setDate(1); // 先设到 1 号，避免月末溢出（如 7月31日 → setMonth(-1) 变成 7月1日）
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const [stateResp, checkinResp, prevCheckinResp] = await Promise.all([
        getState(userRef.current.id),
        getCheckIns(thisMonth),
        getCheckIns(prevMonth),
      ]);

      // P0-2: 组件卸载后不再 setState
      if (!mountedRef.current) return;

      // 迁移：将老版本的字符串 states ('mastered'/'fuzzy') 转为数字等级
      const migratedStates: Record<string, number> = {};
      for (const [word, val] of Object.entries(stateResp.state.states)) {
        if (typeof val === 'number') {
          migratedStates[word] = val;
        } else if (val === 'mastered') {
          migratedStates[word] = 4;
        } else if (val === 'fuzzy') {
          migratedStates[word] = 2;
        } else {
          migratedStates[word] = 0;
        }
      }
      const migratedState = { ...stateResp.state, states: migratedStates };
      setUserState(migratedState);
      loadDayData(migratedState.currentDay, wordsPerDay);
      // 如果有数据迁移，同步回服务器
      if (JSON.stringify(stateResp.state.states) !== JSON.stringify(migratedStates)) {
        updateState(userRef.current.id, migratedState).catch(e => console.error('Failed to migrate states:', e));
      }
      // 合并本月和上月打卡记录
      const allRecords = { ...checkinResp.records, ...prevCheckinResp.records };
      setCheckIns(allRecords);
      // 计算连续天数时传入上月记录，支持跨月连续
      setStreak(calculateStreak(Object.values(checkinResp.records), Object.values(prevCheckinResp.records)));
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      if (!mountedRef.current) return;
      setIsSyncing(false);
    }
  }, [wordsPerDay, loadDayData]); // P1-7: loadAll 不再依赖 user，避免级联重建

  // P1-7: 创建稳定的 loadAllRef，使 visibilitychange / interval 的 useEffect 不再频繁重建
  loadAllRef.current = loadAll;

  // 跨设备同步：页面从后台切到前台时自动刷新数据
  useEffect(() => {
    if (!userRef.current) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Sync] 页面可见，自动刷新数据');
        loadAllRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []); // P1-7: 空依赖，事件监听只绑定一次

  // 跨设备同步：定期轮询（每 60 秒检查一次）
  useEffect(() => {
    if (!userRef.current) return;
    const interval = setInterval(() => {
      // P0-1: 每次触发时检查 user 是否仍有效
      if (!userRef.current) {
        clearInterval(interval);
        return;
      }
      console.log('[Sync] 定时轮询，刷新数据');
      loadAllRef.current();
    }, 60000);
    return () => clearInterval(interval);
  }, []); // P1-7: 空依赖，只创建一次 interval

  const refreshCheckIns = useCallback(async () => {
    if (!userRef.current) return;
    try {
      const thisMonth = `${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`;
      const prevDate = new Date();
      prevDate.setDate(1);
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

      const [resp, prevResp] = await Promise.all([
        getCheckIns(thisMonth),
        getCheckIns(prevMonth),
      ]);
      if (!mountedRef.current) return;
      const allRecords = { ...resp.records, ...prevResp.records };
      setCheckIns(allRecords);
      setStreak(calculateStreak(Object.values(resp.records), Object.values(prevResp.records)));
    } catch (e) {
      console.error('Failed to load checkins:', e);
    }
  }, []);

  const updateUserState = useCallback(async (newState: UserState) => {
    if (!userRef.current) return;
    try {
      await updateState(userRef.current.id, newState);
      setUserState(newState);
      // 仅当 currentDay 实际变化时才重载日数据，避免每次 states 变化都触发
      if (newState.currentDay !== userState.currentDay) {
        loadDayData(newState.currentDay, wordsPerDay);
      }
    } catch (e) {
      console.error('Failed to update state:', e);
    }
  }, [wordsPerDay, loadDayData, userState.currentDay]);

  /** 轻量更新单词状态（等级 0-4），乐观更新模式，不触发热 day data 重载 */
  const updateWordStates = useCallback(async (partialUpdates: Record<string, number | null>) => {
    if (!userRef.current) return;

    // 记录回滚点（用 ref 中最新值，不用 updater 副作用）
    const stateBeforeUpdate = stateRef.current;

    // P1-4: 只计算一次 merged，回滚和 UI 更新共用
    const mergedStates = { ...stateBeforeUpdate.states };
    for (const [word, level] of Object.entries(partialUpdates)) {
      if (level === null) delete mergedStates[word];
      else mergedStates[word] = level;
    }
    const newState: UserState = { ...stateBeforeUpdate, states: mergedStates };

    // 先更新 UI（直接使用已算好的 mergedStates）
    setUserState(newState);

    // 异步同步服务器
    try {
      await updateState(userRef.current.id, newState);
    } catch (e) {
      console.error('Failed to sync word states:', e);
      if (mountedRef.current && stateBeforeUpdate) setUserState(stateBeforeUpdate);
    }
  }, []);

  const setWordsPerDayFn = useCallback((n: number) => {
    const clamped = Math.max(5, Math.min(50, n));
    setWordsPerDayState(clamped);
    localStorage.setItem('vocab_wordsPerDay', String(clamped));
    // 检查 currentDay 是否超过新的总天数，防止用户卡死
    const newTotalDays = getTotalDays(clamped);
    const correctedDay = Math.min(userState.currentDay, newTotalDays);
    if (correctedDay !== userState.currentDay) {
      setUserState(prev => ({ ...prev, currentDay: correctedDay }));
    }
    loadDayData(correctedDay, clamped);
  }, [userState.currentDay, loadDayData]);

  /** 打卡：仅记录打卡，不再推进 currentDay */
  const doCheckInFn = useCallback(async (params: { newWordsCompleted: number; reviewWordsCompleted: number; studyDurationMinutes: number }) => {
    if (!userRef.current) return false;

    // 防止重复打卡：今天已打卡则跳过
    if (checkIns[getToday()]?.isCompleted) {
      console.log('[CheckIn] 今日已打卡，跳过');
      return false;
    }

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
      await refreshCheckIns();
      return true;
    } catch {
      return false;
    }
  }, [wordsPerDay, refreshCheckIns]);

  /** 判断当前 day 的所有词是否都已被标记过（等级 > 0） */
  const isTodayComplete = todayNewWords.length > 0 && todayNewWords.every(w => (userState.states[w.word] || 0) > 0);

  /** 推进到下一天：当前 day 所有词都学过后可用 */
  const advanceDay = useCallback(async () => {
    if (!userRef.current) return;
    if (!isTodayComplete) return;

    // P1-5: 防重入锁
    if (advancingRef.current) {
      console.warn('[advanceDay] 正在推进中，忽略重复请求');
      return;
    }
    advancingRef.current = true;

    const prevState = stateRef.current; // 捕获调用时刻的状态，不受后续 state 变化影响
    try {
      const totalDays = getTotalDays(wordsPerDay);
      const nextDay = Math.min(prevState.currentDay + 1, totalDays);
      const newState = { ...prevState, currentDay: nextDay };
      // 先乐观更新 UI
      setUserState(newState);
      loadDayData(nextDay, wordsPerDay);
      // 再同步服务器，失败则回滚
      await updateState(userRef.current.id, newState);
    } catch (e) {
      console.error('Failed to sync advance day, rolling back:', e);
      // 回滚到原来的 day
      if (mountedRef.current) {
        setUserState(prevState);
        loadDayData(prevState.currentDay, wordsPerDay);
      }
    } finally {
      advancingRef.current = false;
    }
  }, [isTodayComplete, wordsPerDay, loadDayData]);

  const totalDays = getTotalDays(wordsPerDay);

  const contextValue = useMemo(() => ({
    state: userState, checkIns, streak,
    todayNewWords, todayPhrases, todayStage, wordsPerDay,
    loadAll, setWordsPerDay: setWordsPerDayFn,
    updateUserState, updateWordStates, doCheckIn: doCheckInFn,
    advanceDay, isTodayComplete, isSyncing,
  }), [userState, checkIns, streak, todayNewWords, todayPhrases, todayStage, wordsPerDay, loadAll, updateUserState, updateWordStates, setWordsPerDayFn, doCheckInFn, advanceDay, isTodayComplete, isSyncing]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
