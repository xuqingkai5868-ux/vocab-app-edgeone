import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getTotalDays } from '../services/utils/petVocabLoader';
import { getActivity, getActivityRange, ActivityEvent } from '../api/activity';
import { getDayWords } from '../services/utils/petVocabLoader';

const TYPE_LABELS: Record<string, string> = {
  study: '📚 学习新词',
  review_definition: '📖 释义复习',
  review_spelling: '✍️ 拼写练习',
  review_audio: '🎧 听写练习',
  review_spelling_result: '✍️ 拼写成绩',
  review_audio_result: '🎧 听写成绩',
  vocabulary: '📖 浏览词库',
  checkin: '✅ 打卡',
};

const TYPE_COLORS: Record<string, string> = {
  study: 'bg-indigo-100 text-indigo-700',
  review_definition: 'bg-blue-100 text-blue-700',
  review_spelling: 'bg-emerald-100 text-emerald-700',
  review_audio: 'bg-amber-100 text-amber-700',
  review_spelling_result: 'bg-emerald-100 text-emerald-700',
  review_audio_result: 'bg-amber-100 text-amber-700',
  vocabulary: 'bg-gray-100 text-gray-700',
  checkin: 'bg-green-100 text-green-700',
};

const PARENT_PASSWORD = 'scdq';

// 获取上次重置时间戳，用于过滤活动日志
function getResetTimestamp(): number {
  try {
    return parseInt(localStorage.getItem('vocab_activity_reset_at') || '0', 10);
  } catch { return 0; }
}
function setResetTimestamp() {
  localStorage.setItem('vocab_activity_reset_at', String(Date.now()));
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}秒`;
  return `${min}分${sec}秒`;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { wordsPerDay, setWordsPerDay, state: appState, updateUserState } = useApp();
  const totalDays = getTotalDays(wordsPerDay);

  const [todayEvents, setTodayEvents] = useState<ActivityEvent[]>([]);
  const [weekStats, setWeekStats] = useState<{ type: string; totalMs: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [passwordMode, setPasswordMode] = useState<'wordsPerDay' | 'resetToday' | 'resetAll' | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [sliderUnlocked, setSliderUnlocked] = useState(false); // 密码验证后解锁

  useEffect(() => {
    loadActivity();
  }, []);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const today = await getActivity(getToday());
      setTodayEvents(today.events || []);
      
      const week = await getActivityRange('week');
      // 聚合本周各类活动的总时长
      const agg: Record<string, number> = {};
      for (const dateEvents of Object.values(week.results)) {
        for (const ev of dateEvents as ActivityEvent[]) {
          agg[ev.type] = (agg[ev.type] || 0) + ev.duration;
        }
      }
      setWeekStats(Object.entries(agg).map(([type, totalMs]) => ({ type, totalMs })));
    } catch {
      // 如果后端还不支持此接口，静默处理
    }
    setLoading(false);
  };

  const handleResetToday = () => {
    setPasswordMode('resetToday');
    setPasswordInput('');
    setPasswordError(false);
  };

  const handleResetAll = () => {
    setPasswordMode('resetAll');
    setPasswordInput('');
    setPasswordError(false);
  };

  const confirmResetToday = () => {
    const todayWords = getDayWords(appState.currentDay, wordsPerDay);
    const todayWordKeys = new Set(todayWords.map(w => w.word));
    const newStates: Record<string, 'mastered' | 'fuzzy'> = {};
    for (const [word, status] of Object.entries(appState.states)) {
      if (!todayWordKeys.has(word)) {
        newStates[word] = status;
      }
    }
    const newDay = Math.max(1, appState.currentDay - 1);
    updateUserState({ currentDay: newDay, states: newStates });
    setResetTimestamp(); // 标记重置时间，成绩单将过滤掉此时间之前的记录
    alert(`已重置到今天之前（Day ${newDay}），今日学习记录已清除`);
  };

  const confirmResetAll = () => {
    if (!confirm(`确定完全重置 ${user?.name || '用户'} 的所有学习进度吗？\n此操作不可撤销！`)) return;
    updateUserState({ currentDay: 1, states: {} });
    setResetTimestamp(); // 标记重置时间，所有历史活动日志将被过滤
    alert('已完全重置，从 Day 1 重新开始');
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === PARENT_PASSWORD) {
      setPasswordError(false);
      if (passwordMode === 'wordsPerDay') {
        setSliderUnlocked(true);
      } else if (passwordMode === 'resetToday') {
        confirmResetToday();
      } else if (passwordMode === 'resetAll') {
        confirmResetAll();
      }
      setPasswordMode(null);
      setPasswordInput('');
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  const todayTotalMs = todayEvents.reduce((s, e) => s + e.duration, 0);
  const resetAt = getResetTimestamp();
  // 过滤掉重置时间之前的事件
  const filteredTodayEvents = resetAt > 0
    ? todayEvents.filter(e => e.startTime >= resetAt)
    : todayEvents;
  const filteredTodayTotalMs = filteredTodayEvents.reduce((s, e) => s + e.duration, 0);
  // 成绩单事件也需要过滤
  const filteredResultEvents = resetAt > 0
    ? todayEvents.filter(e => (e.type === 'review_spelling_result' || e.type === 'review_audio_result') && e.startTime >= resetAt)
    : todayEvents.filter(e => e.type === 'review_spelling_result' || e.type === 'review_audio_result');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">设置</h1>
        <button onClick={loadActivity} className="text-xs text-primary-500" disabled={loading}>
          {loading ? '加载中...' : '刷新 📊'}
        </button>
      </div>

      {/* 学习报告 */}
      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">📊 今日学习报告</h2>
        {filteredTodayEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {loading ? '加载中...' : '今日暂无学习记录'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">今日学习时长</span>
              <span className="text-lg font-bold text-primary-500">{formatDuration(filteredTodayTotalMs)}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {filteredTodayEvents.filter(e => e.duration > 0).sort((a, b) => b.startTime - a.startTime).slice(0, 20).map((e, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${TYPE_COLORS[e.type] || 'bg-gray-100 text-gray-500'}`}>
                      {TYPE_LABELS[e.type] || e.type}
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs">{formatDuration(e.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {weekStats.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-500 mb-2">本周累计</p>
            <div className="space-y-1.5">
              {weekStats.filter(s => s.totalMs > 0).sort((a, b) => b.totalMs - a.totalMs).map((s, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{TYPE_LABELS[s.type] || s.type}</span>
                  <span className="text-gray-500">{formatDuration(s.totalMs)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 拼写/听写成绩单 */}
      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">📋 拼写/听写成绩单</h2>
        {(() => {
          if (filteredResultEvents.length === 0) {
            return <p className="text-sm text-gray-400 py-4 text-center">今日暂无听写记录</p>;
          }
          return (
            <div className="space-y-3">
              {filteredResultEvents.sort((a, b) => b.startTime - a.startTime).map((e, i) => {
                // 从 details 解析成绩，格式: "20/30 正确，错误：apple、banana"
                const match = e.details.match(/(\d+)\/(\d+) 正确/);
                const correct = match ? parseInt(match[1]) : 0;
                const total = match ? parseInt(match[2]) : 0;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                const label = e.type === 'review_spelling_result' ? '✍️ 拼写' : '🎧 听写';
                return (
                  <div key={i} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{label}</span>
                      <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {correct}/{total} · {pct}%
                      </span>
                    </div>
                    {e.details.includes('错误：') && (
                      <div className="text-xs text-gray-500">
                        错误词：{e.details.split('错误：')[1] || '无'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">每日学习量</h2>
        <div className="flex items-center gap-4">
          <input
            type="range" min={5} max={50} step={5}
            value={wordsPerDay}
            disabled={!sliderUnlocked}
            onChange={e => setWordsPerDay(parseInt(e.target.value))}
            className={`flex-1 accent-primary-500 ${!sliderUnlocked ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
          <span className="text-lg font-bold text-primary-500 min-w-[3rem] text-center">{wordsPerDay}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>每天 5 词</span>
          <span>每天 50 词</span>
        </div>
        <div className="mt-2 text-sm text-gray-500 flex items-center justify-between">
          <span>共 {totalDays} 天完成 · 当前 Day {appState.currentDay}</span>
          {!sliderUnlocked ? (
            <button
              onClick={() => { setPasswordMode('wordsPerDay'); setPasswordInput(''); setPasswordError(false); }}
              className="text-xs text-amber-600 border border-amber-300 rounded-lg px-2.5 py-1 hover:bg-amber-50"
            >
              🔒 家长验证修改
            </button>
          ) : (
            <span className="text-xs text-green-600">✅ 已解锁</span>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">学习信息</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">学员</span><span>{user?.name || '-'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">词库</span><span>PET {totalDays * wordsPerDay} 词</span></div>
          <div className="flex justify-between"><span className="text-gray-500">已掌握</span><span>{Object.values(appState.states).filter(v => v === 'mastered').length} 词</span></div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">操作</h2>
        <div className="space-y-3">
          <button onClick={handleResetToday} className="w-full py-2.5 bg-amber-500 text-white rounded-lg text-sm">
            🔄 只重置今天
            <span className="text-amber-100 text-xs ml-2">今日学习记录清空，回到前一天</span>
          </button>
          <button onClick={handleResetAll} className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm">
            ⚠️ 完全重置
            <span className="text-red-200 text-xs ml-2">所有进度归零，从 Day 1 开始</span>
          </button>
          <button onClick={() => { logout(); navigate('/'); }} className="w-full py-2.5 mt-1 border border-gray-200 text-gray-600 rounded-lg text-sm">退出登录</button>
        </div>
      </Card>

      {/* 密码验证弹窗 */}
      {passwordMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setPasswordMode(null); setPasswordInput(''); setPasswordError(false); }}>
          <div className="bg-white rounded-2xl p-6 w-80 mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 mb-2">🔒 家长验证</h3>
            <p className="text-sm text-gray-500 mb-4">
              {passwordMode === 'wordsPerDay' ? '修改每日学习量需要家长密码' : 
               passwordMode === 'resetToday' ? '重置今日学习记录需要家长密码' : 
               '完全重置学习进度需要家长密码'}
            </p>
            <input
              type="password"
              value={passwordInput}
              autoFocus
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="请输入家长密码"
              className={`w-full px-4 py-3 border rounded-xl text-center text-lg focus:outline-none focus:ring-2 ${passwordError ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-500'}`}
            />
            {passwordError && (
              <p className="text-red-500 text-xs mt-2 text-center">密码错误，请重试</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setPasswordMode(null); setPasswordInput(''); setPasswordError(false); }}
                className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm"
              >
                取消
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
