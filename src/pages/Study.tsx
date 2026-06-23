import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { getDayWords, getDayPhrases } from '../services/utils/petVocabLoader';

type WordStatus = 'new' | 'fuzzy' | 'mastered';

export function Study() {
  const navigate = useNavigate();
  const { state, wordsPerDay, updateUserState } = useApp();
  const day = state.currentDay;

  const words = getDayWords(day, wordsPerDay);
  const phrases = getDayPhrases(day, wordsPerDay);

  // Group into groups of 6
  const groups = useMemo(() => {
    const gs: { words: typeof words; phrases: typeof phrases }[] = [];
    for (let i = 0; i < words.length; i += 6) {
      gs.push({ words: words.slice(i, i + 6), phrases: [] });
    }
    // Distribute phrases across groups
    let pi = 0;
    for (const g of gs) {
      if (pi < phrases.length) {
        const chunkSize = Math.ceil((phrases.length - pi) / (gs.length - gs.indexOf(g)));
        g.phrases = phrases.slice(pi, pi + chunkSize);
        pi += chunkSize;
      }
    }
    return gs;
  }, [words, phrases]);

  const [currentGroup, setCurrentGroup] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);

  const group = groups[currentGroup];
  const allItems = group ? [...group.words.map(w => ({ type: 'word' as const, word: w.word, meaning: `${w.meaning} (${w.pos})`, source: null, assoc: null })), ...group.phrases.map(p => ({ type: 'phrase' as const, word: p.phrase, meaning: p.meaning, source: p.source, assoc: p.associated_word }))] : [];
  const currentItem = allItems[cardIndex];

  const markStatus = (status: WordStatus) => {
    if (!currentItem) return;
    const key = currentItem.word;
    const newStates = { ...state.states };
    if (status === 'mastered') newStates[key] = 'mastered';
    else if (status === 'fuzzy') newStates[key] = 'fuzzy';
    else delete newStates[key];
    updateUserState({ ...state, states: newStates });
    nextCard();
  };

  const nextCard = () => {
    setFlipped(false);
    if (cardIndex < allItems.length - 1) {
      setCardIndex(i => i + 1);
    } else if (currentGroup < groups.length - 1) {
      setCurrentGroup(g => g + 1);
      setCardIndex(0);
    } else {
      setCompleted(true);
    }
  };

  if (!words.length) return <Loading />;

  if (completed) {
    return (
      <div className="space-y-4 text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800">今日学习完成！</h1>
        <p className="text-gray-500">Day {day}/{Math.ceil(2672 / wordsPerDay)}</p>
        <p className="text-sm text-gray-400 mt-2">
          掌握了 {Object.values(state.states).filter(v => v === 'mastered').length} 个词
        </p>
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => navigate('/grammar/1')} className="px-6 py-3 bg-amber-500 text-white rounded-xl text-lg">
            查看语法 📘
          </button>
          <button onClick={() => navigate('/home')} className="px-6 py-3 bg-primary-500 text-white rounded-xl text-lg">
            返回首页 🏠
          </button>
        </div>
      </div>
    );
  }

  const totalCards = groups.reduce((s, g) => s + g.words.length + g.phrases.length, 0);
  const doneCards = groups.slice(0, currentGroup).reduce((s, g) => s + g.words.length + g.phrases.length, 0) + cardIndex;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
        <div className="text-sm text-gray-500">Day {day}</div>
      </div>

      <ProgressBar value={doneCards} max={totalCards} label="今日进度" />

      {currentItem && (
        <Card className="text-center py-12 min-h-[280px] flex flex-col items-center justify-center cursor-pointer select-none" onClick={() => setFlipped(!flipped)}>
          {currentItem.type === 'phrase' && (
            <span className={`text-xs px-2 py-0.5 rounded-full mb-3 ${currentItem.source === 'book' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              {currentItem.source === 'book' ? '📗 书本短语' : '📘 剑桥短语'}
            </span>
          )}
          <div className={`transition-all duration-200 ${flipped ? 'opacity-0 scale-95 absolute' : 'opacity-100 scale-100'}`}>
            <h2 className="text-3xl font-bold text-gray-800">{currentItem.word}</h2>
            <p className="text-sm text-gray-400 mt-3">点卡片翻转查看释义</p>
          </div>
          <div className={`transition-all duration-200 ${!flipped ? 'opacity-0 scale-95 absolute' : 'opacity-100 scale-100'}`}>
            <p className="text-xl text-gray-700">{currentItem.meaning}</p>
            {currentItem.assoc && (
              <p className="text-xs text-gray-400 mt-2">关联词：{currentItem.assoc}</p>
            )}
            <p className="text-xs text-gray-400 mt-4">点卡片返回</p>
          </div>
        </Card>
      )}

      {flipped && (
        <div className="flex gap-3">
          <button onClick={() => markStatus('fuzzy')} className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-medium text-lg">△ 模糊</button>
          <button onClick={() => markStatus('mastered')} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium text-lg">✓ 认识</button>
        </div>
      )}

      {!flipped && (
        <button onClick={() => setFlipped(true)} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium">
          翻转查看释义
        </button>
      )}

      <div className="text-center text-xs text-gray-400">
        第 {doneCards + 1}/{totalCards} 项
      </div>
    </div>
  );
}
