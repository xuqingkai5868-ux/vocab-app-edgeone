import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS } from '../services/utils/petVocabLoader';
import { startTracking, stopTracking } from '../services/activity/activityTracker';
import { speakWord } from '../services/utils/speak';

type SelfAssessment = 'forgot' | 'vague' | 'known';
type Mode = 'select' | 'definition' | 'spelling' | 'audio';

function getWordMeaning(word: string): string {
  const w = MASTER_WORDS.find(w => w.word.toLowerCase() === word.toLowerCase());
  return w ? `${w.meaning} (${w.pos})` : '';
}

export function Review() {
  const navigate = useNavigate();
  const { state, updateUserState } = useApp();
  const [mode, setMode] = useState<Mode>('select');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);

  // All words the user has interacted with, randomly shuffled
  const reviewWords = useMemo(() => {
    const all = Object.entries(state.states).map(([word]) => ({ word }));
    // Shuffle
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [state.states]);

  const currentWord = reviewWords[currentIndex];
  const total = reviewWords.length;
  const meaning = currentWord ? getWordMeaning(currentWord.word) : '';
  const currentStatus = currentWord ? (state.states[currentWord.word] || '') : '';

  // 追踪释义复习时长
  useEffect(() => {
    if (mode === 'definition') {
      startTracking('review_definition');
      return () => { stopTracking('review_definition'); };
    }
  }, [mode]);

  // 拼写/听写模式：跳转到独立页面
  useEffect(() => {
    if (mode === 'spelling') {
      navigate('/dictation?type=spelling');
    } else if (mode === 'audio') {
      navigate('/dictation?type=audio');
    }
  }, [mode, navigate]);

  const handleAssessment = (assessment: SelfAssessment) => {
    const newStates = { ...state.states };
    if (assessment === 'known') {
      newStates[currentWord.word] = 'mastered';
    } else {
      newStates[currentWord.word] = 'fuzzy';
    }
    updateUserState({ ...state, states: newStates });
    setShowMeaning(false);
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      alert('一轮复习完成！🎉');
      navigate('/home');
    }
  };

  // --- Mode selection screen ---
  if (mode === 'select') {
    if (total === 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
            <h1 className="text-lg font-bold text-gray-800">复习</h1>
          </div>
          <Card>
            <p className="text-gray-500 text-center py-8">还没有学过的单词，先去学习吧！📚</p>
            <button onClick={() => navigate('/study')} className="w-full py-2.5 bg-primary-500 text-white rounded-lg">开始学习</button>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
          <h1 className="text-lg font-bold text-gray-800">选择复习模式</h1>
        </div>

        <Card className="text-center py-6">
          <p className="text-sm text-gray-500 mb-6">
            共 {total} 个已学习的单词
          </p>

          <div className="space-y-4">
            {/* 释义模式 - 大按钮 */}
            <button
              onClick={() => setMode('definition')}
              className="w-full py-6 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform"
            >
              <div className="text-3xl mb-2">📖</div>
              <div className="text-lg font-bold">释义模式</div>
              <div className="text-sm text-indigo-100 mt-1">看英文 → 回想中文含义</div>
            </button>

            {/* 拼写模式 - 大按钮 */}
            <button
              onClick={() => setMode('spelling')}
              className="w-full py-6 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-transform"
            >
              <div className="text-3xl mb-2">✍️</div>
              <div className="text-lg font-bold">拼写模式</div>
              <div className="text-sm text-emerald-100 mt-1">看中文 → 拼写英文单词</div>
            </button>

            {/* 听写模式 - 大按钮 */}
            <button
              onClick={() => setMode('audio')}
              className="w-full py-6 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 active:scale-[0.98] transition-transform"
            >
              <div className="text-3xl mb-2">🎧</div>
              <div className="text-lg font-bold">听写模式</div>
              <div className="text-sm text-amber-100 mt-1">听发音 → 默写英文单词</div>
            </button>
          </div>
        </Card>
      </div>
    );
  }

  // --- 释义模式：当前复习流程 ---
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => setMode('select')} className="text-primary-500 text-sm">&larr; 返回选择</button>
        <h1 className="text-lg font-bold text-gray-800">
          释义复习
          <span className="text-sm font-normal text-gray-400 ml-2">({total} 个)</span>
        </h1>
        <div className="flex gap-1">
          <button onClick={() => navigate('/dictation?type=spelling')} className="text-emerald-500 text-xs border border-emerald-300 rounded-lg px-2 py-1" title="拼写模式">✍️</button>
          <button onClick={() => navigate('/dictation?type=audio')} className="text-amber-500 text-xs border border-amber-300 rounded-lg px-2 py-1" title="听写模式">🎧</button>
        </div>
      </div>

      <ProgressBar value={currentIndex} max={total} label="复习进度" />

      <Card className="text-center py-8 min-h-[250px]">
        <p className="text-xs text-gray-400 mb-1">
          第 {currentIndex + 1}/{total} 个
        </p>
        <p className="text-xs text-gray-400 mb-4">
          当前：{currentStatus === 'mastered' ? '✓ 已掌握' : currentStatus === 'fuzzy' ? '△ 模糊' : '○ 未标记'}
        </p>
        <div className="flex items-center justify-center gap-3 mb-6">
          <h2 className="text-3xl font-bold text-gray-800">{currentWord.word}</h2>
          <button
            onClick={() => speakWord(currentWord.word)}
            className="text-2xl text-primary-400 hover:text-primary-600 active:scale-110 transition-transform"
            title="点击朗读发音"
          >
            🔊
          </button>
        </div>

        {!showMeaning ? (
          <button onClick={() => setShowMeaning(true)} className="px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm">
            查看释义
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-lg text-gray-600">{meaning}</p>
            <p className="text-xs text-gray-400">自评</p>
            <div className="flex gap-2">
              <button onClick={() => handleAssessment('forgot')} className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm">忘记 ✗</button>
              <button onClick={() => handleAssessment('vague')} className="flex-1 py-2.5 bg-yellow-500 text-white rounded-lg text-sm">模糊 △</button>
              <button onClick={() => handleAssessment('known')} className="flex-1 py-2.5 bg-green-500 text-white rounded-lg text-sm">认识 ✓</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
