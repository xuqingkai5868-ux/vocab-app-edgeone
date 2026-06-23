import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { getTotalDays } from '../services/utils/petVocabLoader';
import { getActivity, getActivityRange, ActivityEvent } from '../api/activity';

const TYPE_LABELS: Record<string, string> = {
  study: '📚 学习新词',
  review_definition: '📖 释义复习',
  review_spelling: '✍️ 拼写练习',
  review_audio: '🎧 听写练习',
  vocabulary: '📖 浏览词库',
  checkin: '✅ 打卡',
};

const TYPE_COLORS: Record<string, string> = {
  study: 'bg-indigo-100 text-indigo-700',
  review_definition: 'bg-blue-100 text-blue-700',
  review_spelling: 'bg-emerald-100 text-emerald-700',
  review_audio: 'bg-amber-100 text-amber-700',
  vocabulary: 'bg-gray-100 text-gray-700',
  checkin: 'bg-green-100 text-green-700',
};

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
  const { wordsPerDay, setWordsPerDay, state: appState } = useApp();
  const totalDays = getTotalDays(wordsPerDay);

  const [todayEvents, setTodayEvents] = useState<ActivityEvent[]>([]);
  const [weekStats, setWeekStats] = useState<{ type: string; totalMs: number }[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleReset = () => {
    if (!confirm(`确定重置 ${user?.name || '用户'} 的所有学习进度吗？`)) return;
    localStorage.removeItem('vocab_user');
    localStorage.removeItem('di_states');
    alert('已重置');
    logout();
  };

  const todayTotalMs = todayEvents.reduce((s, e) => s + e.duration, 0);

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
        {todayEvents.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            {loading ? '加载中...' : '今日暂无学习记录'}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">今日学习时长</span>
              <span className="text-lg font-bold text-primary-500">{formatDuration(todayTotalMs)}</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {todayEvents.filter(e => e.duration > 0).sort((a, b) => b.startTime - a.startTime).slice(0, 20).map((e, i) => (
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

      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">每日学习量</h2>
        <div className="flex items-center gap-4">
          <input
            type="range" min={5} max={50} step={5}
            value={wordsPerDay}
            onChange={e => setWordsPerDay(parseInt(e.target.value))}
            className="flex-1 accent-primary-500"
          />
          <span className="text-lg font-bold text-primary-500 min-w-[3rem] text-center">{wordsPerDay}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>每天 5 词</span>
          <span>每天 50 词</span>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          共 {totalDays} 天完成 · 当前 Day {appState.currentDay}
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
        <button onClick={handleReset} className="w-full py-2.5 bg-red-500 text-white rounded-lg text-sm">重置学习进度</button>
        <button onClick={() => { logout(); navigate('/'); }} className="w-full py-2.5 mt-2 border border-gray-200 text-gray-600 rounded-lg text-sm">退出登录</button>
      </Card>
    </div>
  );
}
