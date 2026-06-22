import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { formatTime } from '../services/utils/dateUtils';

export function Stats() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stats, refreshStats, loadAll } = useApp();

  useEffect(() => {
    refreshStats();
  }, []);

  if (!stats) return <Loading text="加载统计中..." />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">学习统计</h1>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-primary-500">{stats.totalDays}</div>
          <div className="text-xs text-gray-500">累计学习天数</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-success-500">{stats.totalWordsLearned}</div>
          <div className="text-xs text-gray-500">已学单词数</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-warning-500">{stats.streakDays}</div>
          <div className="text-xs text-gray-500">连续打卡天数</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-purple-500">{formatTime(stats.weekStudyMinutes)}</div>
          <div className="text-xs text-gray-500">本周学习时长</div>
        </Card>
      </div>

      {/* 学习趋势 */}
      <Card>
        <h3 className="font-semibold text-gray-700 mb-3">学习趋势</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">本周学习时长</span>
              <span className="font-medium">{formatTime(stats.weekStudyMinutes)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">上周学习时长</span>
              <span className="font-medium">{formatTime(stats.lastWeekStudyMinutes)}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.weekStudyMinutes > stats.lastWeekStudyMinutes
                ? '比上周进步了！'
                : stats.weekStudyMinutes < stats.lastWeekStudyMinutes
                ? '需要加油赶上上周'
                : '与上周持平'}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">本周新词</span>
              <span className="font-medium">{stats.weekNewWords}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">上周新词</span>
              <span className="font-medium">{stats.lastWeekNewWords}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 本月详情 */}
      <Card>
        <h3 className="font-semibold text-gray-700 mb-3">本月详情</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xl font-bold text-primary-500">{stats.monthCheckInDays}</div>
            <div className="text-xs text-gray-500">打卡 / {stats.monthTotalDays}天</div>
          </div>
          <div>
            <div className="text-xl font-bold text-success-500">{stats.monthNewWords}</div>
            <div className="text-xs text-gray-500">本月新词</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
