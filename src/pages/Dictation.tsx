import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS, getDayWords } from '../services/utils/petVocabLoader';

type Mode = 'today' | 'past';
type DictType = 'spelling' | 'audio';

function speakWord(word: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export function Dictation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dictType = (searchParams.get('type') || 'spelling') as DictType;
  const { state, wordsPerDay } = useApp();

  const [mode, setMode] = useState<Mode>('today');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<{ word: string; correct: boolean }[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [autoPlayed, setAutoPlayed] = useState(false);

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

  // Auto-play audio when entering a new word (audio mode)
  useEffect(() => {
    if (started && !finished && dictType === 'audio' && current) {
      // Short delay to ensure rendering before playing
      const timer = setTimeout(() => {
        speakWord(current.word);
        setAutoPlayed(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentIdx, started, finished, dictType, current]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !input.trim()) return;
    const isCorrect = input.trim().toLowerCase() === current.word.toLowerCase();
    setResults(prev => [...prev, { word: current.word, correct: isCorrect }]);
    setInput('');
    setAutoPlayed(false);

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
    setAutoPlayed(false);
    if (currentIdx < total - 1) {
      setCurrentIdx(i => i + 1);
    } else {
      setFinished(true);
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
    const pct = Math.round((correct / total) * 100);
    const wrongWords = results.filter(r => !r.correct);
    return (
      <div className="space-y-4 text-center py-12">
        <div className="text-6xl mb-4">{pct >= 80 ? '🌟' : pct >= 50 ? '💪' : '📚'}</div>
        <h1 className="text-2xl font-bold text-gray-800">{modeTitle}完成！</h1>
        <p className="text-gray-500">{correct}/{total} 正确 ({pct}%)</p>
        {wrongWords.length > 0 && (
          <div className="max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-400 mb-1">错误的单词：</p>
            {wrongWords.map((r, i) => (
              <div key={i} className="text-sm py-1 text-red-500">{r.word} ✗</div>
            ))}
          </div>
        )}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={() => { setStarted(false); setFinished(false); setCurrentIdx(0); setResults([]); }}
            className="px-6 py-2.5 bg-primary-500 text-white rounded-lg"
          >
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
