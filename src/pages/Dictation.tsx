import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { petSchedule } from '../services/utils/petVocabLoader';

type Mode = 'today' | 'past';

export function Dictation() {
  const navigate = useNavigate();
  const { state } = useApp();
  const [mode, setMode] = useState<Mode>('today');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  // Generate dictation words
  const words = useMemo(() => {
    if (mode === 'today') {
      const day = state.currentDay;
      const dayData = petSchedule.schedule.find(d => d.day === day);
      return (dayData?.words || []).map(w => ({ word: w.word, meaning: w.meaning }));
    } else {
      const pastDays = petSchedule.schedule.filter(d => d.day < state.currentDay);
      // Random 30 from all past days
      const allPast: { word: string; meaning: string }[] = [];
      for (const d of pastDays) {
        for (const w of d.words) allPast.push({ word: w.word, meaning: w.meaning });
      }
      // Shuffle
      for (let i = allPast.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPast[i], allPast[j]] = [allPast[j], allPast[i]];
      }
      return allPast.slice(0, 30);
    }
  }, [mode, state.currentDay]);

  const current = words[currentIdx];
  const total = words.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
    setResults(prev => [...prev, { word: current.word, correct: isCorrect }]);
    setInput('');

    if (currentIdx < total - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setFinished(true);
    }
  };

  const handleSkip = () => {
    if (!current) return;
    setResults(prev => [...prev, { word: current.word, correct: false }]);
    setInput('');
    if (currentIdx < total - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setFinished(true);
    }
  };

  if (!started) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-primary-500 text-sm">&larr; 返回</button>
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">✍️</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">听写模式</h1>
          <p className="text-sm text-gray-500 mb-6">
            {mode === 'today' ? `今日 ${total} 词` : `随机抽 ${total} 词`}
          </p>
          <div className="flex gap-3 justify-center mb-6">
            <button onClick={() => setMode('today')} className={`px-4 py-2 rounded-lg text-sm ${mode === 'today' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              当日
            </button>
            <button onClick={() => setMode('past')} className={`px-4 py-2 rounded-lg text-sm ${mode === 'past' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              之前日
            </button>
          </div>
          <button onClick={() => setStarted(true)} className="px-8 py-3 bg-primary-500 text-white rounded-xl font-medium">
            开始听写 🚀
          </button>
        </Card>
      </div>
    );
  }

  if (finished) {
    const correct = results.filter(r => r.correct).length;
    const pct = Math.round((correct / total) * 100);
    return (
      <div className="space-y-4 text-center py-12">
        <div className="text-6xl mb-4">{pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '📚'}</div>
        <h1 className="text-2xl font-bold text-gray-800">听写完成！</h1>
        <p className="text-gray-500">{correct}/{total} 正确 ({pct}%)</p>
        <div className="max-h-40 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className={`text-sm py-1 ${r.correct ? 'text-green-600' : 'text-red-500'}`}>
              {r.word} {r.correct ? '✓' : '✗'}
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center mt-4">
          <button onClick={() => { setStarted(false); setFinished(false); setCurrentIdx(0); setResults([]); }} className="px-6 py-2.5 bg-primary-500 text-white rounded-lg">
            再来一次
          </button>
          <button onClick={() => navigate('/home')} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg">
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-primary-500 text-sm">&larr; 返回</button>

      <div className="text-center text-xs text-gray-400 mb-2">
        {currentIdx + 1} / {total}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(currentIdx / total) * 100}%` }} />
      </div>

      <Card className="text-center py-10">
        <p className="text-2xl text-gray-800 mb-6 font-medium">{current?.meaning}</p>
        <p className="text-xs text-gray-400 mb-4">请输入对应的英文单词</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入英文..."
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium">
              确认 ✓
            </button>
            <button type="button" onClick={handleSkip} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm">
              跳过
            </button>
          </div>
        </form>
      </Card>

      {results.length > 0 && (
        <div className="text-xs text-center text-gray-400">
          已完成 {results.length} 题 · 正确 {results.filter(r => r.correct).length} 题
        </div>
      )}
    </div>
  );
}
