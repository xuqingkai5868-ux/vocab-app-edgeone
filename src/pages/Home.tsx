import React, { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { getTotalDays } from '../services/utils/petVocabLoader';
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

export function Home() {
  const { state, streak, todayNewWords, todayPhrases, todayStage, wordsPerDay, loadAll, updateUserState, doCheckIn } = useApp();
  const navigate = useNavigate();
  const totalDays = getTotalDays(wordsPerDay);

  useEffect(() => { loadAll(); }, []);

  const mastered = useMemo(() =>
    Object.values(state.states).filter(v => v === 'mastered').length,
  [state.states]);

  const level = useMemo(() => getLevel(mastered), [mastered]);
  const pct = Math.min(100, Math.round((mastered / 2679) * 100));

  const toggleState = useCallback((word: string) => {
    const current = state.states[word];
    let next: 'mastered' | 'fuzzy';
    if (!current) next = 'fuzzy';
    else if (current === 'fuzzy') next = 'mastered';
    else next = 'fuzzy';
    updateUserState({ ...state, states: { ...state.states, [word]: next } });
  }, [state, updateUserState]);

  if (!state) return <Loading text="加载中..." />;

  const masteredToday = todayNewWords.filter(w => state.states[w.word] === 'mastered').length;
  const fuzzyToday = todayNewWords.filter(w => state.states[w.word] === 'fuzzy').length;
  const studiedToday = masteredToday + fuzzyToday; // 所有学过（✓或△）的都算

  const handleCheckIn = async () => {
    // 从活动追踪器获取本次学习时长
    const active = getActiveTracking();
    const sessionSec = active ? Math.round(active.elapsed / 1000) : studiedToday * 10;
    const min = Math.max(1, Math.round(sessionSec / 60));
    const ok = await doCheckIn({ newWordsCompleted: studiedToday, reviewWordsCompleted: 0, studyDurationMinutes: min });
    if (!ok) alert('任务未完成，还不能打卡');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            弟弟，加油！{level.icon}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            PET 备考 · 第 {state.currentDay}/{totalDays} 天
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

      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">今日任务</h2>
        <ProgressBar value={studiedToday} max={todayNewWords.length} label={`新词 (${studiedToday}/${todayNewWords.length})`} color="bg-primary-500" />
        {todayPhrases.length > 0 && (
          <div className="mt-2 text-sm text-gray-500">
            关联短语 {todayPhrases.length} 条
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={() => navigate('/study')} className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl font-medium">
            开始学习 📚
          </button>
          <button onClick={handleCheckIn} className="px-4 py-2.5 bg-success-500 text-white rounded-xl font-medium">
            打卡 {getStreakIcon(streak)} {streak > 0 ? streak : ''}
          </button>
        </div>
      </Card>

      {todayNewWords.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">
            今日新词
            <span className="text-xs text-gray-400 ml-2">切换 ○ → △ → ✓</span>
          </h2>
          <div className="space-y-2">
            {todayNewWords.map((w, i) => {
              const s = state.states[w.word];
              return (
                <div key={w.word} onClick={() => toggleState(w.word)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${
                    s === 'mastered' ? 'bg-green-50 border border-green-200' :
                    s === 'fuzzy' ? 'bg-yellow-50 border border-yellow-200' :
                    'bg-white border border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400 w-5">{i + 1}</span>
                    <div>
                      <span className="font-medium text-gray-800">{w.word}</span>
                      <span className="text-sm text-gray-500 ml-2">_{w.pos}_</span>
                      <span className="text-sm text-gray-500 ml-1">{w.meaning}</span>
                    </div>
                  </div>
                  <span className={`text-lg ${s ? '' : 'opacity-40'}`}>
                    {s === 'mastered' ? '✓' : s === 'fuzzy' ? '△' : '○'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {todayPhrases.length > 0 && (
        <Card>
          <h2 className="font-semibold text-gray-700 mb-3">关联短语</h2>
          <div className="space-y-2">
            {todayPhrases.map((p, i) => (
              <div key={i} className="flex items-center px-4 py-2 rounded-xl bg-gray-50">
                <span className={`mr-2 ${p.source === 'book' ? 'text-amber-600' : 'text-blue-600'}`}>
                  {p.source === 'book' ? '📗' : '📘'}
                </span>
                <div>
                  <span className="text-sm font-medium text-gray-800">{p.phrase}</span>
                  <span className="text-xs text-gray-500 ml-2">{p.meaning}</span>
                  {p.associated_word && (
                    <span className="text-xs text-gray-400 ml-1">（→ {p.associated_word}）</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card onClick={() => navigate('/review')} className="text-center py-4">
          <div className="text-2xl mb-1">🔄</div>
          <div className="text-sm text-gray-600">复习 {fuzzyToday > 0 ? `(${fuzzyToday})` : ''}</div>
        </Card>
        <Card onClick={() => navigate('/vocabulary')} className="text-center py-4">
          <div className="text-2xl mb-1">📖</div>
          <div className="text-sm text-gray-600">词库</div>
        </Card>
        <Card onClick={() => navigate('/settings')} className="text-center py-4">
          <div className="text-2xl mb-1">⚙️</div>
          <div className="text-sm text-gray-600">设置</div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getStreakIcon(streak)}</span>
              <div>
                <div className="text-sm text-gray-500">连续打卡</div>
                <div className="text-xl font-bold text-gray-800">{streak} 天</div>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            总计已掌握：{mastered} 词
          </div>
        </div>
      </Card>
    </div>
  );
}
