import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { getTotalDays } from '../services/utils/petVocabLoader';
import { MASTER_WORDS } from '../services/utils/petVocabLoader';
import { getActiveTracking } from '../services/activity/activityTracker';

function getLevel(mastered: number): { level: number; title: string; icon: string } {
  const levels = [
    { level: 1, title: '单词新手', icon: '🌱', req: 0 },
    { level: 2, title: '小小学员', icon: '🌿', req: 100 },
    { level: 3, title: '进步之星', icon: '🌳', req: 300 },
    { level: 4, title: '单词达人', icon: '⭐', req: 600 },
    { level: 5, title: 'PET 选手', icon: '🌟', req: 1000 },
    { level: 6, title: '冲刺选手', icon: '🔥', req: 1500 },
    { level: 7, title: 'PET 勇士', icon: '🏆', req: 2000 },
    { level: 8, title: 'PET 大师', icon: '👑', req: 2500 },
    { level: 9, title: 'PET 学霸', icon: '🎓', req: 3000 },
    { level: 10, title: 'PET 通关！', icon: '🏅', req: 99999 },
  ];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (mastered >= levels[i].req) return levels[i];
  }
  return levels[0];
}

function getStreakIcon(streak: number): string {
  if (streak >= 30) return '🦅';
  if (streak >= 14) return '🐔';
  if (streak >= 7) return '🐤';
  if (streak >= 3) return '🐣';
  return '🥚';
}

function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#6366f1" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

// 迷你打卡日历（周视图）
function MiniCalendar({ checkIns, streak }: { checkIns: Record<string, { isCompleted: boolean }>; streak: number }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // 补充末尾空白以对齐网格
  while (cells.length % 7 !== 0) cells.push(null);

  const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">{getStreakIcon(streak)}</span>
          <span className="text-sm font-medium text-gray-700">连续 {streak} 天</span>
        </div>
        <span className="text-xs text-gray-400">{year}年{monthNames[month]}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map(d => (
          <div key={d} className="text-[11px] text-gray-400 font-medium py-1">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="py-1" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const checked = checkIns[dateStr]?.isCompleted;
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`text-xs py-1.5 rounded-full ${isToday ? 'ring-1 ring-primary-400 font-bold' : ''} ${checked ? 'bg-green-100 text-green-700' : 'text-gray-500'}`}
            >
              {checked ? '✓' : d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Home() {
  const { state, streak, todayNewWords, todayPhrases, todayStage, wordsPerDay, loadAll, updateUserState, doCheckIn, checkIns, advanceDay, isTodayComplete } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const totalDays = getTotalDays(wordsPerDay);

  useEffect(() => { loadAll(); }, []);

  const mastered = useMemo(() =>
    Object.values(state.states).filter(v => v >= 4).length,
  [state.states]);

  const level = useMemo(() => getLevel(mastered), [mastered]);
  const pct = Math.min(100, Math.round((mastered / MASTER_WORDS.length) * 100));

  const { masteredToday, fuzzyToday, studiedToday, fuzzyCount } = useMemo(() => {
    const masteredToday = todayNewWords.filter(w => (state.states[w.word] || 0) >= 4).length;
    const fuzzyToday = todayNewWords.filter(w => {
      const lvl = state.states[w.word] || 0;
      return lvl >= 1 && lvl <= 3;
    }).length;
    const studiedToday = masteredToday + fuzzyToday;
    const fuzzyCount = Object.values(state.states).filter(v => v >= 1 && v <= 3).length;
    return { masteredToday, fuzzyToday, studiedToday, fuzzyCount };
  }, [todayNewWords, state.states]);

  const handleCheckIn = async () => {
    const active = getActiveTracking();
    const sessionSec = active ? Math.round(active.elapsed / 1000) : studiedToday * 10;
    const min = Math.max(1, Math.round(sessionSec / 60));
    const ok = await doCheckIn({ newWordsCompleted: studiedToday, reviewWordsCompleted: 0, studyDurationMinutes: min });
    if (!ok) alert('任务未完成，还不能打卡');
  };

  if (!state) return <Loading text="加载中..." />;

  return (
    <div className="space-y-4">
      {/* 头部：等级 + 进度环 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {user?.name || '同学'}，加油！{level.icon}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            PET 备考 · Day {state.currentDay}/{totalDays}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center" style={{ width: 60, height: 60 }}>
            <ProgressRing pct={pct} size={60} />
            <span className="absolute text-xs font-bold text-primary-500">{pct}%</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary-500">{level.title}</div>
            <div className="text-xs text-gray-400">Lv.{level.level}</div>
          </div>
        </div>
      </div>

      {/* 双进度条：学习进度 + 打卡 */}
      <Card className="!p-4">
        <h2 className="font-semibold text-gray-700 text-sm mb-3">今日任务</h2>
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>学习进度 · Day {state.currentDay}</span>
            <span>{studiedToday}/{todayNewWords.length} 词</span>
          </div>
          <ProgressBar value={studiedToday} max={todayNewWords.length} label="" color="bg-primary-500" />
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>连续打卡</span>
          <span>{streak} 天</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => navigate('/study')} className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm">
            开始学习 📚
          </button>
          <button onClick={handleCheckIn} className="px-4 py-2.5 bg-success-500 text-white rounded-xl font-medium text-sm">
            打卡 🐣
          </button>
          {isTodayComplete && state.currentDay < totalDays && (
            <button
              onClick={advanceDay}
              className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm animate-pulse"
            >
              进入 Day {state.currentDay + 1} →
            </button>
          )}
        </div>
        {isTodayComplete && state.currentDay < totalDays && (
          <p className="text-xs text-amber-600 mt-2 text-center">所有词都学过了，可以进入下一天！</p>
        )}
      </Card>

      {/* 打卡日历（紧凑周视图） */}
      <Card className="!p-3">
        <MiniCalendar checkIns={checkIns} streak={streak} />
      </Card>

      {/* 学习统计 */}
      <Card className="!p-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-gray-800">{mastered}</div>
            <div className="text-[10px] text-gray-400">已掌握</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-600">{fuzzyCount}</div>
            <div className="text-[10px] text-gray-400">待复习</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-800">{streak}</div>
            <div className="text-[10px] text-gray-400">连续打卡</div>
          </div>
        </div>
      </Card>

      {/* 底部导航卡片 */}
      <div className="grid grid-cols-3 gap-3">
        <Card onClick={() => navigate('/review')} className="text-center py-4 cursor-pointer">
          <div className="text-2xl mb-1">🔄</div>
          <div className="text-sm text-gray-600">复习</div>
        </Card>
        <Card onClick={() => navigate('/wrong-words')} className="text-center py-4 cursor-pointer">
          <div className="text-2xl mb-1">📕</div>
          <div className="text-sm text-gray-600">错词本 {fuzzyCount > 0 ? `(${fuzzyCount})` : ''}</div>
        </Card>
        <Card onClick={() => navigate('/settings')} className="text-center py-4 cursor-pointer">
          <div className="text-2xl mb-1">⚙️</div>
          <div className="text-sm text-gray-600">设置</div>
        </Card>
      </div>
    </div>
  );
}
