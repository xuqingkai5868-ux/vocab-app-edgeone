import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { getDayWords, getDayPhrases, getGrammarStage, MASTER_WORDS } from '../services/utils/petVocabLoader';
import { startTracking, stopTracking } from '../services/activity/activityTracker';
import { speakWord } from '../services/utils/speak';
import type { GrammarCard, GrammarStage } from '../types/study';

/** 单词等级显示方案 */
const LEVEL_META = [
  { label: '未学', icon: '○', bg: 'bg-gray-100', text: 'text-gray-400' },
  { label: '刚学', icon: '◐', bg: 'bg-blue-100', text: 'text-blue-700' },
  { label: '模糊', icon: '△', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  { label: '已知', icon: '◑', bg: 'bg-teal-100', text: 'text-teal-700' },
  { label: '掌握', icon: '✓', bg: 'bg-green-100', text: 'text-green-700' },
];

function getLevelInfo(level: number) {
  return LEVEL_META[Math.max(0, Math.min(4, level))];
}

const FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'learning', label: '◐ 刚学', level: 1 },
  { key: 'fuzzy', label: '△ 模糊', level: 2 },
  { key: 'known', label: '◑ 已知', level: 3 },
  { key: 'mastered', label: '✓ 掌握', level: 4 },
] as const;

type FilterKey = (typeof FILTER_OPTIONS)[number]['key'];
type Tab = 'list' | 'study';

export function Study() {
  const navigate = useNavigate();
  const { state, wordsPerDay, updateWordStates, advanceDay, isTodayComplete } = useApp();
  const day = state.currentDay;

  const [tab, setTab] = useState<Tab>('list');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [currentGroup, setCurrentGroup] = useState(0);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [feedbackWord, setFeedbackWord] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'mastered' | 'fuzzy' | null>(null);
  const [grammarCardIdx, setGrammarCardIdx] = useState(0);
  const [grammarStages, setGrammarStages] = useState<GrammarStage[]>([]);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animatingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      if (animatingTimerRef.current) clearTimeout(animatingTimerRef.current);
    };
  }, []);

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
    startTracking('study', 'study');
    return () => { stopTracking('study', `Day${day}`); };
  }, [day]);

  const words = getDayWords(day, wordsPerDay);
  const phrases = getDayPhrases(day, wordsPerDay);

  // 过滤后的单词列表
  const filteredWords = useMemo(() => {
    if (filter === 'all') return words;
    // 从 FILTER_OPTIONS 中获取当前筛选对应的等级
    const targetLevel = (FILTER_OPTIONS.find(o => o.key === filter) as { key: string; level: number } | undefined)?.level;
    return words.filter(w => {
      const level = state.states[w.word] || 0;
      return targetLevel ? level === targetLevel : true;
    });
  }, [words, state.states, filter]);

  // 统计（按等级）
  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const w of words) {
      const level = state.states[w.word] || 0;
      counts[Math.min(level, 4)]++;
    }
    return counts; // [new, learning, fuzzy, known, mastered]
  }, [words, state.states]);

  const completedCount = stats[1] + stats[2] + stats[3] + stats[4]; // 所有学过（level > 0）

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

  const markStatus = (isKnown: boolean) => {
    if (!currentItem) return;
    const key = currentItem.word;
    const currentLevel = state.states[key] || 0;
    // known → level 4, fuzzy → level 2
    const newLevel = isKnown ? 4 : 2;
    updateWordStates({ [key]: newLevel });
    setFeedbackWord(key);
    setFeedbackType(isKnown ? 'mastered' : 'fuzzy');
    feedbackTimerRef.current = setTimeout(() => { setFeedbackWord(null); setFeedbackType(null); }, 600);
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

  /** 点击单词列表中某个词 → 升级循环（0→1→2→3→4→0），回到未学状态更直观 */
  const [animatingWord, setAnimatingWord] = useState<string | null>(null);
  const toggleWordStatus = (word: string) => {
    const currentLevel = state.states[word] || 0;
    const nextLevel = currentLevel >= 4 ? 0 : currentLevel + 1;
    updateWordStates({ [word]: nextLevel });
    // 触发闪烁动画
    setAnimatingWord(word);
    animatingTimerRef.current = setTimeout(() => setAnimatingWord(null), 400);
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

        {/* 进度摘要 */}
        <Card className="!p-3">
          <div className="flex justify-around text-sm">
            {LEVEL_META.map((m, i) => (
              <div key={i} className="text-center">
                <div className={`text-lg ${m.text}`}>{m.icon}</div>
                <div className={`text-xs ${m.text}`}>{stats[i]}</div>
              </div>
            ))}
          </div>
        </Card>

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
          {stats[4]} 个词已达到掌握 (Lv.4)
        </p>
        <div className="flex gap-3 justify-center mt-4">
          {grammarCards.length > 1 && grammarCardIdx < grammarCards.length - 1 ? (
            <button onClick={() => setGrammarCardIdx(i => i + 1)} className="px-6 py-2.5 bg-amber-500 text-white rounded-lg">
              下一个语法点 →
            </button>
          ) : day < totalDays ? (
            <>
              {isTodayComplete && (
                <button
                  onClick={() => { advanceDay(); navigate('/study'); }}
                  className="px-6 py-2.5 bg-amber-500 text-white rounded-lg animate-pulse"
                >
                  进入 Day {day + 1} 🚀
                </button>
              )}
              <button onClick={() => navigate('/home')} className="px-6 py-2.5 bg-primary-500 text-white rounded-lg">
                返回首页 🏠
              </button>
            </>
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
          {/* 进度概览：5 级显示 */}
          <Card className="!p-3">
            <div className="flex justify-around text-sm">
              {LEVEL_META.map((m, i) => (
                <div key={i} className="text-center">
                  <div className={`text-lg ${stats[i] > 0 ? m.text : 'text-gray-300'}`}>{m.icon}{stats[i]}</div>
                  <div className={`text-[10px] ${stats[i] > 0 ? m.text : 'text-gray-400'}`}>{m.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <ProgressBar value={completedCount} max={words.length} label="" />
            </div>
          </Card>

          {/* 过滤标签 */}
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap ${
                  filter === f.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 单词列表 */}
          <Card className="!p-2 space-y-1">
            {filteredWords.length === 0 ? (
              <p className="text-gray-400 text-center py-6 text-sm">没有符合条件的单词</p>
            ) : (
              filteredWords.map((w, i) => {
                const level = state.states[w.word] || 0;
                const info = getLevelInfo(level);
                return (
                  <div
                    key={w.word}
                    onClick={() => toggleWordStatus(w.word)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300 ${
                      level >= 4 ? 'bg-green-50' : level >= 2 ? 'bg-yellow-50' : level >= 1 ? 'bg-blue-50' : ''
                    } ${
                      animatingWord === w.word ? 'animate-status-flash ring-2 ring-primary-400 scale-[1.02]' : ''
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
                      <span className={`text-sm px-1.5 py-0.5 rounded-full ${info.bg} ${info.text}`}>
                        {info.icon}
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
              className={`text-center py-12 min-h-[280px] flex flex-col items-center justify-center cursor-pointer select-none transition-all duration-300 ${
                feedbackWord === currentItem.word
                  ? feedbackType === 'mastered'
                    ? 'ring-4 ring-green-300 scale-[0.97]'
                    : 'ring-4 ring-yellow-300 scale-[1.02]'
                  : ''
              }`}
              onClick={() => setFlipped(!flipped)}
            >
              {currentItem.type === 'phrase' && (
                <span className={`text-xs px-2 py-0.5 rounded-full mb-3 ${currentItem.source === 'book' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                  {currentItem.source === 'book' ? '📗 书本短语' : '📘 剑桥短语'}
                </span>
              )}
              <div className={`relative w-full transition-all duration-300 ease-out ${flipped ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl font-bold text-gray-800">{currentItem.word}</h2>
                  <button onClick={e => { e.stopPropagation(); speakWord(currentItem.word); }} className="text-2xl text-primary-400 hover:text-primary-600 active:scale-110 transition-transform">🔊</button>
                </div>
                <p className="text-sm text-gray-400 mt-3">点卡片翻转查看释义</p>
              </div>
              <div className={`relative w-full transition-all duration-300 ease-out ${!flipped ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                <p className="text-xl text-gray-700">{currentItem.meaning}</p>
                {currentItem.assoc && <p className="text-xs text-gray-400 mt-2">关联词：{currentItem.assoc}</p>}
                <p className="text-xs text-gray-400 mt-4">点卡片返回</p>
              </div>
            </Card>
          )}

          {flipped && (
            <div className="flex gap-3">
              <button onClick={() => markStatus(false)} className="flex-1 py-3 bg-yellow-500 text-white rounded-xl font-medium text-lg">△ 模糊</button>
              <button onClick={() => markStatus(true)} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium text-lg">✓ 认识</button>
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
