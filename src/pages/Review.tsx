import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS } from '../services/utils/petVocabLoader';

type Mode = 'definition' | 'dictation';
type SelfAssessment = 'forgot' | 'vague' | 'known';

function getWordMeaning(word: string): string {
  const w = MASTER_WORDS.find(w => w.word.toLowerCase() === word.toLowerCase());
  return w ? `${w.meaning} (${w.pos})` : '';
}

export function Review() {
  const navigate = useNavigate();
  const { state, updateUserState } = useApp();
  const [mode, setMode] = useState<Mode>('definition');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [dictationInput, setDictationInput] = useState('');
  const [dictationChecked, setDictationChecked] = useState(false);
  const [dictationCorrect, setDictationCorrect] = useState(false);

  const fuzzyWords = useMemo(() => {
    return Object.entries(state.states)
      .filter(([_, v]) => v === 'fuzzy')
      .map(([k]) => ({ word: k }));
  }, [state.states]);

  const currentWord = fuzzyWords[currentIndex];
  const total = fuzzyWords.length;
  const meaning = currentWord ? getWordMeaning(currentWord.word) : '';

  const saveState = (word: string, status: 'mastered' | 'fuzzy') => {
    const newStates = { ...state.states, [word]: status };
    updateUserState({ ...state, states: newStates });
  };

  const nextCard = () => {
    setShowMeaning(false);
    setDictationInput('');
    setDictationChecked(false);
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      alert('复习完成！🎉');
      navigate('/home');
    }
  };

  const handleAssessment = (assessment: SelfAssessment) => {
    if (assessment === 'known') {
      saveState(currentWord.word, 'mastered');
    } else if (assessment === 'vague') {
      saveState(currentWord.word, 'fuzzy');
    } else {
      // forgot: keep fuzzy (will re-appear)
      saveState(currentWord.word, 'fuzzy');
    }
    nextCard();
  };

  const handleDictationCheck = () => {
    const correct = dictationInput.trim().toLowerCase() === currentWord.word.toLowerCase();
    setDictationCorrect(correct);
    setDictationChecked(true);
  };

  if (total === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-gray-800">复习</h1>
        <Card>
          <p className="text-gray-500 text-center py-8">🎉 当前没有模糊词，继续保持！</p>
          <button onClick={() => navigate('/dictation')} className="w-full py-2.5 bg-primary-500 text-white rounded-lg">进入听写 ✍️</button>
          <button onClick={() => navigate('/home')} className="w-full py-2.5 mt-2 bg-gray-100 text-gray-600 rounded-lg">返回首页</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
        <h1 className="text-lg font-bold text-gray-800">
          复习 <span className="text-sm font-normal text-gray-400">({total} 个)</span>
        </h1>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button onClick={() => setMode('definition')} className={`flex-1 py-2 rounded-lg text-sm ${mode === 'definition' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          📖 释义模式
        </button>
        <button onClick={() => setMode('dictation')} className={`flex-1 py-2 rounded-lg text-sm ${mode === 'dictation' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          ✍️ 听写模式
        </button>
      </div>

      <ProgressBar value={currentIndex} max={total} label="复习进度" />

      <Card className="text-center py-8 min-h-[250px]">
        <p className="text-xs text-gray-400 mb-3">第 {currentIndex + 1}/{total} 个</p>

        {mode === 'definition' ? (
          <>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">{currentWord.word}</h2>
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
          </>
        ) : (
          <>
            <p className="text-lg text-gray-700 mb-6">{meaning || currentWord.word}</p>
            {!dictationChecked ? (
              <div className="space-y-4">
                <input
                  type="text" autoFocus
                  value={dictationInput}
                  onChange={e => setDictationInput(e.target.value)}
                  placeholder="输入英文单词..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button onClick={handleDictationCheck} className="w-full py-2.5 bg-primary-500 text-white rounded-lg" disabled={!dictationInput.trim()}>
                  确认 ✓
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className={`text-lg ${dictationCorrect ? 'text-green-600' : 'text-red-500'}`}>
                  {dictationCorrect ? '✅ 正确！' : `❌ 正确拼写：${currentWord.word}`}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleAssessment('forgot')} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm">忘记</button>
                  <button onClick={() => handleAssessment('vague')} className="flex-1 py-2 bg-yellow-500 text-white rounded-lg text-sm">模糊</button>
                  <button onClick={() => handleAssessment('known')} className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm">认识</button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
