import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { getDayWords, getDayPhrases, getGrammarStage, MASTER_WORDS } from '../services/utils/petVocabLoader';
import { startTracking, stopTracking } from '../services/activity/activityTracker';
import { speakWord } from '../services/utils/speak';

interface GrammarCard {
  id: string; title: string; rule: string;
  examples: string[]; note: string; pdf_ref: string;
}
interface GrammarStage {
  stage: number; name: string; level: string; pdf: string;
  cards: GrammarCard[];
}

type WordStatus = 'new' | 'fuzzy' | 'mastered';
type Tab = 'list' | 'study';

export function Study() {
  const navigate = useNavigate();
  const { state, wordsPerDay, updateUserState, updateWordStates } = useApp();
  const day = state.currentDay;

  const [tab, setTab] = useState<Tab>('list');
  const [filter, setFilter] = useState<'all' | 'mastered' | 'fuzzy' | 'new'>('all');
  const [currentGroup, setCurrentGroup] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [grammarCardIdx, setGrammarCardIdx] = useState(0);
  const [grammarStages, setGrammarStages] = useState<GrammarStage[]>([]);

  // 防抖：连续点击只触发最后一次 API 同步
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStatesRef = useRef<Record<string, 'mastered' | 'fuzzy'> | null>(null);
  const flushPendingStates = useCallback(() => {
    if (pendingStatesRef.current && Object.keys(pendingStatesRef.current).length > 0) {
      updateWordStates(pendingStatesRef.current);
      pendingStatesRef.current = null;
    }
  }, [updateWordStates]);
  const debouncedUpdateWordStates = useCallback((newStates: Record<string, 'mastered' | 'fuzzy'>) => {
    pendingStatesRef.current = { ...(pendingStatesRef.current || {}), ...newStates };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(flushPendingStates, 300);
  }, [flushPendingStates]);

  // Load grammar data
  useEffect(() => {
    fetch('/grammar_cards.json')
      .then(r => r.json())
      .then(d => setGrammarStages(d.stages || []))
      .catch(() => {});
  }, []);

  const grammarStage = getGrammarStage(day, wordsPerDay);
  const stageData = grammarStages.find(s => s.stage === grammarStage);
  const grammarCards = stageData?.cards || [];
  const currentGrammar = grammarCards[grammarCardIdx];

  // 追踪学习时长
  useEffect(() => {
    startTracking('study');
    return () => {
      stopTracking('study', `Day${day}`);
      // 组件卸载时刷新防抖中未同步的状态
      flushPendingStates();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [day, flushPendingStates]);

  const words = getDayWords(day, wordsPerDay);
  const phrases = getDayPhrases(day, wordsPerDay);

  // 过滤后的单词列表
  const filteredWords = useMemo(() => {
    if (filter === 'all') return words;
    return words.filter(w => {
      const s = state.states[w.word];
      if (filter === 'mastered') return s === 'mastered';
      if (filter === 'fuzzy') return s === 'fuzzy';
      if (filter === 'new') return !s;
      return true;
    });
  }, [words, state.states, filter]);

  // 统计
  const masteredCount = words.filter(w => state.states[w.word] === 'mastered').length;
  const fuzzyCount = words.filter(w => state.states[w.word] === 'fuzzy').length;
  const newCount = words.filter(w => !state.states[w.word]).length;

  // Group into groups of 6
  const groups = useMemo(() => {
    const gs: { words: typeof words; phrases: typeof phrases }[] = [];
    for (let i = 0; i < words.length; i += 6) {
      gs.push({ words: words.slice(i, i + 6), phrases: [] });
    }
    let pi = 0;
    const gsLen = gs.length;
    for (let gi = 0; gi < gsLen; gi++) {
      if (pi < phrases.length) {
        const chunkSize = Math.ceil((phrases.length - pi) / (gsLen - gi));
        gs[gi].phrases = phrases.slice(pi, pi + chunkSize);
        pi += chunkSize;
      }
    }
    return gs;
  }, [words, phrases]);

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
    // 使用乐观更新 + 防抖，不阻塞 UI
    debouncedUpdateWordStates(newStates);
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

  const toggleWordStatus = (word: string) => {
    const current = state.states[word];
    let next: 'mastered' | 'fuzzy';
    if (!current) next = 'fuzzy';
    else if (current === 'fuzzy') next = 'mastered';
    else next = 'fuzzy';
    // 使用乐观更新 + 防抖，立即更新本地状态，异步同步服务器
    debouncedUpdateWordStates({ ...state.states, [word]: next });
  };

const totalDays = Math.ceil(MASTER_WORDS.length / wordsPerDay);

  if (!words.length) return <Loading />;

  // 学习完成界面
  if (completed) {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="text-6xl mb-2">🎉</div>
        <h1 className="text-2xl font-bold text-gray-800">今日学习完成！</h1>
        <p className="text-gray-500 text-sm">Day {day}/{totalDays}</p>

        {/* 语法卡片嵌入 */}
        {grammarCards.length > 0 && currentGrammar && (
          <Card className="!p-4 text-left">
            <div className="text-center mb-3">
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                📘 语法 · {stageData?.level} · {stageData?.name}
              </span>
            </div>
            <h3 className="font-bold text-gray-800 text-base mb-3 text-center">{currentGrammar.title}</h3>
            <div className="bg-blue-50 p-3 rounded-lg mb-3">
              <p className="text-sm text-gray-700 whitespace-pre-line">{currentGrammar.rule}</p>
            </div>
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">例句：</p>
              {currentGrammar.examples.map((ex: string, i: number) => (
                <p key={i} className="text-sm text-gray-700 mb-1">• {ex}</p>
              ))}
            </div>
            {currentGrammar.note && (
              <div className="bg-yellow-50 p-3 rounded-lg mb-2">
                <p className="text-xs text-yellow-700">💡 {currentGrammar.note}</p>
              </div>
            )}
            {grammarCards.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {grammarCards.map((_: GrammarCard, i: number) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i === grammarCardIdx ? 'bg-primary-500' : 'bg-gray-300'}`} />
                ))}
              </div>
            )}
          </Card>
        )}

        <p className="text-xs text-gray-400 mt-1">
          掌握了 {Object.values(state.states).filter(v => v === 'mastered').length} 个词
        </p>
        <div className="flex gap-3 justify-center mt-4">
          {grammarCards.length > 1 && grammarCardIdx < grammarCards.length - 1 ? (
            <button onClick={() => setGrammarCardIdx(i => i + 1)} className="px-6 py-2.5 bg-amber-500 text-white rounded-lg">
              下一个语法点 →
            </button>
          ) : (
            <button onClick={() => navigate('/home')} className="px-6 py-2.5 bg-primary-500 text-white rounded-lg">
              返回首页 🏠
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalCards = groups.reduce((s, g) => s + g.words.length + g.phrases.length, 0);
  const doneCards = groups.slice(0, currentGroup).reduce((s, g) => s + g.words.length + g.phrases.length, 0) + cardIndex;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/home')} className="text-primary-500 text-sm">&larr; 返回</button>
        <div className="text-sm text-gray-500">Day {day}</div>
      </div>

      {/* Tab 切换 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('list')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          📋 词表
        </button>
        <button
          onClick={() => setTab('study')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'study' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
        >
          🃏 学习
        </button>
      </div>

      {/* ===== 词表视图 ===== */}
      {tab === 'list' && (
        <>
          {/* 进度概览 */}
          <Card className="!p-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-3 text-sm">
                <span className="text-green-600 font-medium">✓ {masteredCount}</span>
                <span className="text-yellow-600 font-medium">△ {fuzzyCount}</span>
                <span className="text-gray-400">{words.length - masteredCount - fuzzyCount} 未学</span>
              </div>
              <div className="text-xs text-gray-400">{masteredCount + fuzzyCount}/{words.length} 已完成</div>
            </div>
            <ProgressBar value={masteredCount + fuzzyCount} max={words.length} label="" />
          </Card>

          {/* 过滤标签 */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {(['all', 'mastered', 'fuzzy', 'new'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                  filter === f ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f === 'all' ? '全部' : f === 'mastered' ? '✓ 已掌握' : f === 'fuzzy' ? '△ 模糊' : '○ 未学'}
              </button>
            ))}
          </div>

          {/* 单词列表 */}
          <Card className="!p-2 space-y-1">
            {filteredWords.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">没有符合条件的单词</p>
            ) : (
              filteredWords.map((w, i) => {
                const s = state.states[w.word];
                return (
                  <div
                    key={w.word}
                    onClick={() => toggleWordStatus(w.word)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer ${
                      s === 'mastered' ? 'bg-green-50' : s === 'fuzzy' ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-mono text-gray-400 w-5 shrink-0">{i + 1}</span>
                      <span className="font-medium text-gray-800 truncate">{w.word}</span>
                      <span className="text-sm text-gray-500 shrink-0">_{w.pos}_</span>
                      <span className="text-sm text-gray-500 truncate">{w.meaning}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); speakWord(w.word); }}
                        className="text-base text-primary-400 hover:text-primary-600"
                      >
                        🔊
                      </button>
                      <span className={`text-base w-5 text-center ${s ? '' : 'text-gray-300'}`}>
                        {s === 'mastered' ? '✓' : s === 'fuzzy' ? '△' : '○'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          {/* 短语列表 */}
          {phrases.length > 0 && (
            <details className="bg-white rounded-xl border border-gray-100">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer">
                关联短语 ({phrases.length})
              </summary>
              <div className="px-4 pb-3 space-y-2">
                {phrases.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={p.source === 'book' ? 'text-amber-600' : 'text-blue-600'}>
                      {p.source === 'book' ? '📗' : '📘'}
                    </span>
                    <span className="font-medium text-gray-800">{p.phrase}</span>
                    <span className="text-gray-500">{p.meaning}</span>
                    {p.associated_word && (
                      <span className="text-xs text-gray-400 ml-auto">→ {p.associated_word}</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* 开始学习按钮 */}
          <button
            onClick={() => setTab('study')}
            className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-medium text-lg shadow-lg shadow-primary-200"
          >
            开始学习 🚀
          </button>
        </>
      )}

      {/* ===== 学习视图（翻转卡片） ===== */}
      {tab === 'study' && (
        <>
          <ProgressBar value={doneCards} max={totalCards} label="今日进度" />

          {currentItem && (
            <Card
              className="text-center py-12 min-h-[280px] flex flex-col items-center justify-center cursor-pointer select-none"
              onClick={() => setFlipped(!flipped)}
            >
              {currentItem.type === 'phrase' && (
                <span className={`text-xs px-2 py-0.5 rounded-full mb-3 ${currentItem.source === 'book' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {currentItem.source === 'book' ? '📗 书本短语' : '📘 剑桥短语'}
                </span>
              )}
              <div className={`transition-all duration-200 ${flipped ? 'opacity-0 scale-95 absolute' : 'opacity-100 scale-100'}`}>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl font-bold text-gray-800">{currentItem.word}</h2>
                  <button onClick={e => { e.stopPropagation(); speakWord(currentItem.word); }} className="text-2xl text-primary-400 hover:text-primary-600 active:scale-110 transition-transform">🔊</button>
                </div>
                <p className="text-sm text-gray-400 mt-3">点卡片翻转查看释义</p>
              </div>
              <div className={`transition-all duration-200 ${!flipped ? 'opacity-0 scale-95 absolute' : 'opacity-100 scale-100'}`}>
                <p className="text-xl text-gray-700">{currentItem.meaning}</p>
                {currentItem.assoc && <p className="text-xs text-gray-400 mt-2">关联词：{currentItem.assoc}</p>}
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
            <button onClick={() => setFlipped(true)} className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium">翻转查看释义</button>
          )}

          <div className="text-center text-xs text-gray-400">
            第 {doneCards + 1}/{totalCards} 项
          </div>
        </>
      )}
    </div>
  );
}
