import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS, getDayWords } from '../services/utils/petVocabLoader';
import { startTracking, stopTracking } from '../services/activity/activityTracker';
import { logActivity } from '../api/activity';
import { speakWord } from '../services/utils/speak';

type Mode = 'today' | 'past';
type DictType = 'spelling' | 'audio';

interface DictationProgress {
  currentIdx: number;
  results: { word: string; correct: boolean }[];
  mode: Mode;
  dictType: string;
  wordsPerDay: number;
  currentDay: number;
  timestamp: number;
}

/** 从 localStorage 读取听写进度的统一入口 */
function loadDictationProgress(dictType: string): DictationProgress | null {
  try {
    const saved = localStorage.getItem('vocab_dictation_progress');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.dictType !== dictType) return null;
    return parsed as DictationProgress;
  } catch { return null; }
}

export function Dictation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dictType = (searchParams.get('type') || 'spelling') as DictType;
  const { state, wordsPerDay, updateWordStates } = useApp();

  // 初始化时一次性加载持久化进度，避免多次读 localStorage
  const savedRef = useRef(loadDictationProgress(searchParams.get('type') || 'spelling'));
  const saved = savedRef.current;

  const [mode, setMode] = useState<Mode>(() => (saved?.mode as Mode) || 'today');
  const [currentIdx, setCurrentIdx] = useState(() => saved?.currentIdx ?? 0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>(() => saved?.results ?? []);
  const [started, setStarted] = useState(() => !!(saved?.results?.length));
  const [finished, setFinished] = useState(false);
  const [autoPlayed, setAutoPlayed] = useState(false);
  const [feedback, setFeedback] = useState<{ fuzzyWords: number; masteredWords: number } | null>(null);
  // 是否刚恢复进度，用 ref 确保首个词不自动播放语音
  const resumedRef = useRef(!!(saved?.results?.length));

  const saveDictationProgress = (idx: number, res: { word: string; correct: boolean }[]) => {
    try {
      localStorage.setItem('vocab_dictation_progress', JSON.stringify({
        currentIdx: idx,
        results: res,
        mode,
        dictType,
        wordsPerDay,
        currentDay: state.currentDay,
        timestamp: Date.now(),
      }));
    } catch { /* ignore */ }
  };

  const clearDictationProgress = () => {
    try { localStorage.removeItem('vocab_dictation_progress'); } catch { /* ignore */ }
  };

  // 追踪拼写/听写时长
  const trackType = dictType === 'audio' ? 'review_audio' : 'review_spelling';
  useEffect(() => {
    startTracking(trackType, trackType);
    return () => { stopTracking(trackType); };
  }, [trackType]);

  // Generate dictation words
  const words = useMemo(() => {
    if (mode === 'today') {
      const day = state.currentDay;
      const dayWords = getDayWords(day, wordsPerDay);
      return dayWords.map(w => ({ word: w.word, meaning: w.meaning }));
    } else {
      // Random 30 from all past words
      const totalDays = Math.ceil(MASTER_WORDS.length / wordsPerDay);
      const allPast: { word: string; meaning: string }[] = [];
      for (let d = 1; d < Math.min(state.currentDay, totalDays); d++) {
        const dw = getDayWords(d, wordsPerDay);
        for (const w of dw) allPast.push({ word: w.word, meaning: w.meaning });
      }
      for (let i = allPast.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allPast[i], allPast[j]] = [allPast[j], allPast[i]];
      }
      return allPast.slice(0, 30);
    }
  }, [mode, state.currentDay, wordsPerDay]);

  const current = words[currentIdx];
  const total = words.length;

  // Auto-play audio when entering a new word (audio mode), skip if just resumed
  useEffect(() => {
    if (resumedRef.current) {
      resumedRef.current = false;
      return;
    }
    if (started && !finished && dictType === 'audio' && current) {
      // Short delay to ensure rendering before playing
      const timer = setTimeout(() => {
        speakWord(current.word);
        setAutoPlayed(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, started, finished, dictType, current]);

  // 听写完成后，将错误单词自动标为 fuzzy，正确单词标为 mastered，并记录成绩
  useEffect(() => {
    if (!finished || results.length === 0) return;
    if (feedback) return; // 避免重复保存

    const partialUpdates: Record<string, number> = {};
    let fuzzyCount = 0;
    let masteredCount = 0;
    const wrongList: string[] = [];

    for (const r of results) {
      if (r.correct) {
        // 正确：当前等级+1（最高4），如果已经是4则保持不变
        const currentLevel = state.states[r.word] || 0;
        partialUpdates[r.word] = Math.min(currentLevel + 1, 4);
        masteredCount++;
      } else {
        wrongList.push(r.word);
        // 错误：降到 level 2 (模糊)
        partialUpdates[r.word] = 2;
        fuzzyCount++;
      }
    }

    // 增量更新，只传变化的词
    updateWordStates(partialUpdates);
    setFeedback({ fuzzyWords: fuzzyCount, masteredWords: masteredCount });

    // 将听写结果上报到活动日志，家长端可查看
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const correct = results.filter(r => r.correct).length;
    logActivity({
      type: dictType === 'audio' ? 'review_audio_result' : 'review_spelling_result',
      startTime: Date.now(),
      duration: 0,
      details: `${correct}/${results.length} 正确，错误：${wrongList.join('、')}`,
      date: today,
    }).catch(() => {});
  }, [finished, results, state, feedback, dictType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
    const newResults = [...results, { word: current.word, correct: isCorrect }];
    setResults(newResults);
    setInput('');
    setAutoPlayed(false);

    if (currentIdx < total - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      // 每次作答后持久化进度
      saveDictationProgress(nextIdx, newResults);
    } else {
      setFinished(true);
      clearDictationProgress();
    }
  };

  const handleSkip = () => {
    if (!current) return;
    const newResults = [...results, { word: current.word, correct: false }];
    setResults(newResults);
    setInput('');
    setAutoPlayed(false);
    if (currentIdx < total - 1) {
      const nextIdx = currentIdx + 1;
      setCurrentIdx(nextIdx);
      // 每次跳过也持久化进度
      saveDictationProgress(nextIdx, newResults);
    } else {
      setFinished(true);
      clearDictationProgress();
    }
  };

  const modeTitle = dictType === 'audio' ? '听写模式' : '拼写模式';
  const modeIcon = dictType === 'audio' ? '🎧' : '✍️';

  if (!started) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="text-primary-500 text-sm">&larr; 返回</button>
        <Card className="text-center py-12">
          <div className="text-5xl mb-4">{modeIcon}</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">{modeTitle}</h1>
          <p className="text-sm text-gray-500 mb-6">
            {mode === 'today' ? `今日 ${total} 词` : `随机抽 ${total} 词`}
          </p>
          <div className="flex gap-3 justify-center mb-6">
            <button
              onClick={() => setMode('today')}
              className={`px-4 py-2 rounded-lg text-sm ${mode === 'today' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              当日
            </button>
            <button
              onClick={() => setMode('past')}
              className={`px-4 py-2 rounded-lg text-sm ${mode === 'past' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              之前日
            </button>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="px-8 py-3 bg-primary-500 text-white rounded-xl font-medium"
          >
            开始 {modeTitle} 🚀
          </button>
        </Card>
      </div>
    );
  }

  if (finished) {
    const correct = results.filter(r => r.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const wrongWords = results.filter(r => !r.correct);
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-6xl mb-4">{pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '📚'}</div>
        <h1 className="text-2xl font-bold text-gray-800">{modeTitle}完成！</h1>
        <p className="text-gray-500">{correct}/{total} 正确 ({pct}%)</p>

        {/* 结果反馈：哪些词被自动标记 */}
        {feedback && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700 mx-4">
            {feedback.fuzzyWords > 0 && (
              <p>✏️ {feedback.fuzzyWords} 个错误词已加入复习列表</p>
            )}
            {feedback.masteredWords > 0 && (
              <p>✅ {feedback.masteredWords} 个正确词已标为掌握</p>
            )}
          </div>
        )}

        {/* 错误词列表 */}
        {wrongWords.length > 0 && (
          <Card className="text-left !p-3">
            <p className="text-xs text-gray-400 mb-2 text-center">需要复习的单词：</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {wrongWords.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-800">{r.word}</span>
                    <span className="text-xs text-gray-400 ml-2">{MASTER_WORDS.find(w => w.word === r.word)?.meaning || ''}</span>
                  </div>
                  <span className="text-lg">✗</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => { setStarted(false); setFinished(false); setCurrentIdx(0); setResults([]); setMode('today'); setFeedback(null); clearDictationProgress(); }}
            className="px-6 py-2.5 bg-primary-500 text-white rounded-lg"
          >
            再来一次
          </button>
          <button onClick={() => navigate('/review')} className="px-6 py-2.5 bg-amber-500 text-white rounded-lg">
            去复习 🔄
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
        {dictType === 'audio' ? (
          <>
            {/* 听写模式：语音朗读 */}
            <button
              onClick={() => speakWord(current!.word)}
              className="text-6xl mb-6 hover:scale-110 active:scale-95 transition-transform"
              title="点击播放发音"
            >
              🔊
            </button>
            <p className="text-xs text-gray-400 mb-6">点击喇叭听发音，然后输入听到的单词</p>
          </>
        ) : (
          <>
            {/* 拼写模式：显示中文 */}
            <p className="text-2xl text-gray-800 mb-6 font-medium">{current?.meaning}</p>
            <p className="text-xs text-gray-400 mb-4">看中文 → 拼写英文单词</p>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            autoFocus
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={dictType === 'audio' ? '输入听到的英文...' : '输入英文...'}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-primary-500 text-white rounded-xl font-medium disabled:opacity-50"
              disabled={!input.trim()}
            >
              确认 ✓
            </button>
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-3 bg-gray-100 text-gray-500 rounded-xl text-sm"
            >
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
