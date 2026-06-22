import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { getMonthDays, getMonthStartDayOfWeek, getCurrentYear, getCurrentMonth } from '../services/utils/dateUtils';

export function Calendar() {
  const navigate = useNavigate();
  const { checkIns, streak, refreshCheckIns } = useApp();
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());

  useEffect(() => {
    refreshCheckIns();
  }, []);

  const daysInMonth = getMonthDays(year, month);
  const startDay = getMonthStartDayOfWeek(year, month);
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const checkedDates = new Set(
    Object.values(checkIns)
      .filter((r) => r.isCompleted)
      .map((r) => r.date)
  );

  const monthCheckInCount = Object.values(checkIns).filter((r) => r.isCompleted).length;

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const dayCells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) {
    dayCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(d);
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">打卡日历</h1>

      {/* 当月统计 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-primary-500">{monthCheckInCount}</div>
          <div className="text-xs text-gray-500">本月打卡天数</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-bold text-success-500">{streak}</div>
          <div className="text-xs text-gray-500">连续打卡天数</div>
        </Card>
      </div>

      {/* 月历 */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="text-primary-500 text-lg">&larr;</button>
          <h2 className="font-semibold text-gray-700">
            {year}年 {monthNames[month - 1]}
          </h2>
          <button onClick={nextMonth} className="text-primary-500 text-lg">&rarr;</button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 gap-1">
          {dayCells.map((day, i) => {
            const dateStr = day ? `${monthStr}-${String(day).padStart(2, '0')}` : '';
            const checked = dateStr ? checkedDates.has(dateStr) : false;
            return (
              <div
                key={i}
                className={`aspect-square flex items-center justify-center rounded-lg text-sm ${
                  !day
                    ? ''
                    : checked
                    ? 'bg-success-500 text-white font-medium'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                {day || ''}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 打卡详情 */}
      <Card>
        <h3 className="font-semibold text-gray-700 mb-3">打卡详情</h3>
        {Object.values(checkIns).filter((r) => r.isCompleted).length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">本月暂无打卡记录</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Object.values(checkIns)
              .filter((r) => r.isCompleted)
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 30)
              .map((r) => (
                <div key={r.date} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{r.date}</span>
                  <span className="text-xs text-gray-400">
                    {r.studyDuration}分钟 · {r.newWordsCount}新词
                  </span>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
