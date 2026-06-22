import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { getTotalDays } from '../services/utils/vocabLoader';

export function Home() {
  const { user } = useAuth();
  const { state, streak, todayNewWords, vocabIndex, loadAll, doCheckIn } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    loadAll();
  }, []);

  if (!vocabIndex) return <Loading text="加载词库中..." />;

  const totalDays = getTotalDays(vocabIndex);
  const newWordsTarget = 8;
  const reviewWordsTarget = 15;

  const handleCheckIn = async () => {
    const ok = await doCheckIn({
      newWordsCompleted: 0,
      reviewWordsCompleted: 0,
      studyDurationMinutes: 15,
    });
    if (!ok) {
      alert('学习任务未完成，还不能打卡');
    }
  };

  const todayStr = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="space-y-4">
      {/* 顶部问候 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {user?.name || '用户'}，早上好！
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayStr}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">学习进度</div>
          <div className="text-lg font-bold text-primary-500">
            第 {state.currentDay}/{totalDays} 天
          </div>
        </div>
      </div>

      {/* 今日计划卡片 */}
      <Card>
        <h2 className="font-semibold text-gray-700 mb-3">今日学习计划</h2>
        <ProgressBar
          value={0}
          max={newWordsTarget}
          label={`新词 (${todayNewWords.length})`}
          color="bg-primary-500"
        />
        <div className="mt-3">
          <ProgressBar
            value={0}
            max={reviewWordsTarget}
            label="复习"
            color="bg-success-500"
          />
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 mb-1">
            <span>学习时长</span>
            <span>0/15 分钟</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-warning-500 h-full rounded-full" style={{ width: '0%' }} />
          </div>
        </div>
        <button
          onClick={() => navigate('/conversation')}
          className="mt-4 w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
        >
          开始今天的学习
        </button>
      </Card>

      {/* 快捷入口 */}
      <div className="grid grid-cols-3 gap-3">
        <Card onClick={() => navigate('/conversation')} className="text-center py-4">
          <div className="text-2xl mb-1">💬</div>
          <div className="text-sm text-gray-600">AI 对话</div>
        </Card>
        <Card onClick={() => navigate('/review')} className="text-center py-4">
          <div className="text-2xl mb-1">📝</div>
          <div className="text-sm text-gray-600">复习</div>
        </Card>
        <Card onClick={() => navigate('/vocabulary')} className="text-center py-4">
          <div className="text-2xl mb-1">📖</div>
          <div className="text-sm text-gray-600">生词本</div>
        </Card>
      </div>

      {/* 打卡区域 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">连续打卡</div>
            <div className="text-2xl font-bold text-primary-500">{streak} 天</div>
          </div>
          <button
            onClick={handleCheckIn}
            className="px-6 py-2.5 bg-success-500 text-white rounded-xl font-medium hover:bg-success-600 transition-colors"
          >
            今日打卡
          </button>
        </div>
      </Card>
    </div>
  );
}
