import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS } from '../services/utils/petVocabLoader';
import { speakWord } from '../services/utils/speak';
import { startTracking, stopTracking } from '../services/activity/activityTracker';
import { logActivity } from '../api/activity';

export function WrongWords() {
  const navigate = useNavigate();
  const { state, updateWordStates } = useApp();

  // 收集所有 △ 模糊的词
  const wrongWords = useMemo(() => {
    const result: { word: string; meaning: string; pos: string }[] = [];
    for (const [word, level] of Object.entries(state.states)) {
      if (level >= 1 && level <= 3) {
        const w = MASTER_WORDS.find(mw => mw.word.toLowerCase() === word.toLowerCase());
        result.push({ word, meaning: w?.meaning || '', pos: w?.pos || '' });
      }
    }
    return result;
  }, [state.states]);

  const [selectedTab, setSelectedTab] = useState<'list' | 'dictation' | 'finish'>('list');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);
  const [feedback, setFeedback] = useState<{ fuzzyWords: number; masteredWords: number } | null>(null);
  const feedbackRef = useRef(false); // 防止重复保存

  // 追踪学习时长（只在听写过程中追踪）
  useEffect(() => {
    if (selectedTab !== 'dictation') return;
    startTracking('review_spelling', 'wrongwords_dictation');
    return () => { stopTracking('wrongwords_dictation', 'wrongwords_dictation'); };
  }, [selectedTab]);

  // 听写完成后保存等级变更并上报日志
  useEffect(() => {
    if (selectedTab !== 'finish' || results.length === 0 || feedbackRef.current) return;

    const partialUpdates: Record<string, number> = {};
    let fuzzyCount = 0;
    let masteredCount = 0;
    const wrongList: string[] = [];

    for (const r of results) {
      if (r.correct) {
        const currentLevel = state.states[r.word] || 0;
        partialUpdates[r.word] = Math.min(currentLevel + 1, 4);
        masteredCount++;
      } else {
        wrongList.push(r.word);
        partialUpdates[r.word] = 2;
        fuzzyCount++;
      }
    }

    feedbackRef.current = true;
    updateWordStates(partialUpdates);
    setFeedback({ fuzzyWords: fuzzyCount, masteredWords: masteredCount });

    // 上报活动日志
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const correct = results.filter(r => r.correct).length;
    logActivity({
      type: 'review_spelling_result',
      startTime: Date.now(),
      duration: 0,
      details: `${correct}/${results.length} 正确，错误：${wrongList.join('、')}`,
      date: today,
    }).catch(() => {});
  }, [selectedTab, results, state.states, updateWordStates]);

  const total = wrongWords.length;

  // 听写完成
  if (selectedTab === 'finish') {
    const correct = results.filter(r => r.correct).length;
    const wrongList = results.filter(r => !r.correct);
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-5xl mb-4">📕</div>
        <h1 className="text-2xl font-bold text-gray-800">错词本听写完成！</h1>
        <p className="text-gray-500">{correct}/{results.length} 正确</p>

        {feedback && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 mx-4">
            {feedback.fuzzyWords > 0 && <p>✏️ {feedback.fuzzyWords} 个错误词已加入复习列表</p>}
            {feedback.masteredWords > 0 && <p>✅ {feedback.masteredWords} 个正确词已升级</p>}
          </div>
        )}

        {wrongList.length > 0 && (
          <Card className="!p-3 text-left">
            <p className="text-xs text-gray-400 mb-2 text-center">仍需复习：</p>
            {wrongList.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg mb-1">
                <div>
                  <span className="text-sm font-medium text-gray-800">{r.word}</span>
                  <span className="text-xs text-gray-400 ml-2">{MASTER_WORDS.find(w => w.word === r.word)?.meaning || ''}</span>
                </div>
                <span className="text-lg">✗</span>
              </div>
            ))}
          </Card>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setSelectedTab('list'); setCurrentIdx(0); setResults([]); setFeedback(null); feedbackRef.current = false; }} className="px-6 py-2.5 bg-primary-500 text-white rounded-lg">返回错词本</button>
          <button onClick={() => navigate('/home')} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg">返回首页</button>
        </div>
      </div>
    );
  }

  // 听写模式
  if (selectedTab === 'dictation') {
    const current = wrongWords[currentIdx];
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!current || !input.trim()) return;
      const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
      setResults(prev => [...prev, { word: current.word, correct: isCorrect }]);
      setInput('');
      if (currentIdx < total - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        setSelectedTab('finish');
      }
    };
    const handleSkip = () => {
      if (!current) return;
      setResults(prev => [...prev, { word: current.word, correct: false }]);
      setInput('');
      if (currentIdx < total - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        setSelectedTab('finish');
      }
    };

    return (
      <div className="space-y-4">
        <button onClick={() => { setSelectedTab('list'); setCurrentIdx(0); setResults([]); setFeedback(null); feedbackRef.current = false; }} className="text-primary-500 text-sm">&larr; 返回错词本</button>
        <div className="text-center text-xs text-gray-400 mb-1">{currentIdx + 1} / {total}</div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 mb-4">
          <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${(currentIdx / total) * 100}%` }} />
        </div>
        <Card className="text-center py-10">
          <p className="text-2xl text-gray-800 mb-6 font-medium">{current?.meaning}</p>
          <p className="text-xs text-gray-400 mb-4">输入这个单词的英文拼写</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" autoFocus value={input} onChange={e => setInput(e.target.value)}
              placeholder="输入英文..." className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500" />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-medium hover:bg-indigo-100 active:scale-[0.98] transition-all disabled:opacity-50" disabled={!input.trim()}>确认</button>
              <button type="button" onClick={handleSkip} className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm">跳过</button>
            </div>
          </form>
        </Card>
        {results.length > 0 && (
          <div className="text-xs text-center text-gray-400">已完成 {results.length} 题 · 正确 {results.filter(r => r.correct).length} 题</div>
        )}
      </div>
    );
  }

  // 词表模式
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
        <h1 className="text-lg font-bold text-gray-800">📕 错词本</h1>
        <div className="w-12" />
      </div>

      {total === 0 ? (
        <Card>
          <p className="text-gray-500 text-center py-8">没有错误单词，继续保持！🎉</p>
          <button onClick={() => navigate('/study')} className="w-full py-2.5 bg-primary-500 text-white rounded-lg">去学习新词</button>
        </Card>
      ) : (
        <>
          {/* 概览 */}
          <Card className="!p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">共 <strong className="text-amber-600">{total}</strong> 个词需要复习</span>
              <button onClick={() => { setSelectedTab('dictation'); setCurrentIdx(0); setResults([]); feedbackRef.current = false; setFeedback(null); }}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-sm font-medium hover:bg-indigo-100 active:scale-[0.98] transition-all">
                错词本听写 ✍️
              </button>
            </div>
          </Card>

          {/* 错词列表 */}
          <Card className="!p-2 space-y-1">
            {wrongWords.map((w, i) => (
              <div key={w.word} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-red-50 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-mono text-gray-400 w-5 shrink-0">{i + 1}</span>
                  <span className="font-medium text-gray-800">{w.word}</span>
                  <span className="text-sm text-gray-500 shrink-0">_{w.pos}_</span>
                  <span className="text-sm text-gray-500 truncate">{w.meaning}</span>
                </div>
                <button onClick={() => speakWord(w.word)} className="text-base text-primary-400 hover:text-primary-600 shrink-0">
                  🔊
                </button>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
