import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { getTotalDays, MASTER_WORDS } from '../services/utils/petVocabLoader';
import { getActiveTracking } from '../services/activity/activityTracker';
import { getActivity } from '../api/activity';

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
  const [todayDuration, setTodayDuration] = useState(0); // 今日学习时长（毫秒）

  useEffect(() => { loadAll(); }, []);

  // 单独获取今日学习时长
  useEffect(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    getActivity(todayStr).then(resp => {
      const total = (resp.events || []).reduce((s, e) => s + e.duration, 0);
      setTodayDuration(total);
    }).catch(() => {});
  }, []);

  const levelStats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const w of MASTER_WORDS) {
      const lvl = state.states[w.word] || 0;
      counts[Math.min(lvl, 4)]++;
    }
    return counts; // [未学, 刚学, 模糊, 已知, 掌握]
  }, [state.states]);

  const mastered = useMemo(() => levelStats[4], [levelStats]);
  const fuzzyCount = useMemo(() => levelStats[1] + levelStats[2] + levelStats[3], [levelStats]);

  const level = useMemo(() => getLevel(mastered), [mastered]);
  const pct = Math.min(100, Math.round((mastered / MASTER_WORDS.length) * 100));

  const { masteredToday, fuzzyToday, studiedToday } = useMemo(() => {
    const masteredToday = todayNewWords.filter(w => (state.states[w.word] || 0) >= 4).length;
    const fuzzyToday = todayNewWords.filter(w => {
      const lvl = state.states[w.word] || 0;
      return lvl >= 1 && lvl <= 3;
    }).length;
    const studiedToday = masteredToday + fuzzyToday;
    return { masteredToday, fuzzyToday, studiedToday };
  }, [todayNewWords, state.states]);

  const reviewWordsCompleted = useMemo(() => {
    const todayWordSet = new Set(todayNewWords.map(w => w.word));
    let count = 0;
    for (const w of MASTER_WORDS) {
      if (!todayWordSet.has(w.word) && (state.states[w.word] || 0) > 0) count++;
    }
    return count;
  }, [todayNewWords, state.states]);

  const handleCheckIn = async () => {
    // 打卡前重新获取服务器端时长，与客户端实时记录合并
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let serverMs = todayDuration;
    try {
      const resp = await getActivity(todayStr);
      serverMs = (resp.events || []).reduce((s, e) => s + e.duration, 0);
    } catch { /* fallback to cached todayDuration */ }
    const active = getActiveTracking();
    const totalMs = serverMs + (active ? active.elapsed : 0);
    const min = Math.max(1, Math.round(totalMs / 60000));
    const ok = await doCheckIn({ newWordsCompleted: studiedToday, reviewWordsCompleted, studyDurationMinutes: min });
    if (!ok) alert('任务未完成，还不能打卡');
  };

  const LEVEL_COLORS = [
    { bg: 'bg-gray-200', text: 'text-gray-500' },
    { bg: 'bg-blue-300', text: 'text-blue-700' },
    { bg: 'bg-amber-300', text: 'text-amber-700' },
    { bg: 'bg-teal-300', text: 'text-teal-700' },
    { bg: 'bg-green-400', text: 'text-green-700' },
  ];
  const levelLabels = ['未学', '刚学', '模糊', '已知', '掌握'];

  return (
    <div className="space-y-4">
      {/* 头部：等级 + 进度环 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800">
            {user?.name || '同学'}，加油！
          </h1>
          <div className="flex gap-2 mt-2">
            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
              Lv.{level.level} {level.title}
            </span>
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">
              连续 {streak} 天
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            PET 备考 · Day {state.currentDay}/{totalDays}
          </p>
        </div>
        <div className="relative" style={{ width: 52, height: 52 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="21" fill="none" stroke="#e5e7eb" stroke-width="4"/>
            <circle cx="26" cy="26" r="21" fill="none" stroke="#4f46e5" stroke-width="4" stroke-dasharray={(2 * Math.PI * 21).toFixed(1)} stroke-dashoffset={(2 * Math.PI * 21 * (1 - pct / 100)).toFixed(1)} stroke-linecap="round" transform="rotate(-90 26 26)"/>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-indigo-500">{pct}%</span>
        </div>
      </div>

      {/* 今日任务 */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 text-sm">今日任务</h2>
          <span className="text-xs text-gray-400">{studiedToday}/{todayNewWords.length} 词</span>
        </div>
        <div className="mb-3">
          <ProgressBar value={studiedToday} max={todayNewWords.length} label="" color="bg-primary-500" />
        </div>
        {/* 三格统计 */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-green-700">{masteredToday}</p>
            <p className="text-[10px] text-green-600">已掌握</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-amber-700">{fuzzyToday}</p>
            <p className="text-[10px] text-amber-600">待复习</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold text-indigo-700">{todayNewWords.length - studiedToday}</p>
            <p className="text-[10px] text-indigo-600">刚学</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/study')} className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm">
            开始学习
          </button>
          <button onClick={handleCheckIn} className="px-4 py-2.5 bg-orange-500 text-white rounded-xl font-medium text-sm">
            打卡
          </button>
          {isTodayComplete && state.currentDay < totalDays && (
            <button
              onClick={advanceDay}
              className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm animate-pulse"
            >
              Day {state.currentDay + 1} →
            </button>
          )}
        </div>
        {isTodayComplete && state.currentDay < totalDays && (
          <p className="text-xs text-amber-600 mt-2 text-center">所有词都学过了，可以进入下一天！</p>
        )}
      </Card>

      {/* 掌握分布（5级独立色块） */}
      <Card className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700 text-sm">掌握分布</h2>
          <span className="text-xs text-gray-400">共 {MASTER_WORDS.length} 词</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {levelStats.map((count, i) => {
            return (
              <div key={i} className="text-center">
                <div className={`${LEVEL_COLORS[i].bg} rounded-lg ${count > 0 ? 'opacity-100' : 'opacity-30'} p-2`}>
                  <p className={`text-base font-bold ${LEVEL_COLORS[i].text}`}>
                    {count > 0 ? count : '-'}
                  </p>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{levelLabels[i]}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 打卡日历（紧凑周视图） */}
      <Card className="!p-3">
        <MiniCalendar checkIns={checkIns} streak={streak} />
      </Card>

      {/* 学习统计 */}
      <Card className="!p-3">
        <div className="grid grid-cols-4 gap-2 text-center">
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
          <div>
            <div className="text-lg font-bold text-primary-500">
              {todayDuration >= 60000
                ? `${Math.round(todayDuration / 60000)}分钟`
                : todayDuration > 0
                  ? `${Math.round(todayDuration / 1000)}秒`
                  : '-'}
            </div>
            <div className="text-[10px] text-gray-400">今日学习</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
