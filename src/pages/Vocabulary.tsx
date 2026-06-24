import React, { useState, useMemo } from 'react';
import { Card } from '../components/Card';
import { useApp } from '../contexts/AppContext';
import { MASTER_WORDS } from '../services/utils/petVocabLoader';

const PAGE_SIZE = 50;

const LEVEL_FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'mastered', label: '✓ 掌握', min: 4, max: 4 },
  { id: 'known', label: '◑ 已知', min: 3, max: 3 },
  { id: 'fuzzy', label: '△ 模糊', min: 2, max: 2 },
  { id: 'learning', label: '◐ 刚学', min: 1, max: 1 },
] as const;

type FilterId = typeof LEVEL_FILTERS[number]['id'];

export function Vocabulary() {
  const { state, wordsPerDay } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');
  const [page, setPage] = useState(1);
  const saved = state.states;

  const allWords = useMemo(() => {
    return MASTER_WORDS.map((w, i) => ({ word: w, day: Math.floor(i / wordsPerDay) + 1 }));
  }, [wordsPerDay]);

  const filtered = useMemo(() => {
    let items = allWords;
    const q = query.toLowerCase().trim();
    if (q) {
      items = items.filter(i => i.word.word.toLowerCase().includes(q) || i.word.meaning.includes(q));
    }
    if (filter === 'all') return items;
    const f = LEVEL_FILTERS.find(x => x.id === filter) as { id: string; min: number; max: number } | undefined;
    if (!f) return items;
    return items.filter(i => {
      const level = saved[i.word.word] || 0;
      return level >= f.min && level <= f.max;
    });
  }, [allWords, query, filter, saved]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page < totalPages;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">PET 词库</h1>

      <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}
        placeholder="搜索单词..." className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      <div className="flex gap-1 flex-wrap">
        {LEVEL_FILTERS.map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id as FilterId); setPage(1); }}
            className={`px-2.5 py-1.5 rounded-full text-xs ${filter === f.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}
          >{f.label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {paged.map(i => {
          const level = saved[i.word.word] || 0;
          const levelLabels = ['○', '◐', '△', '◑', '✓'];
          const levelColors = ['bg-gray-100 text-gray-400', 'bg-blue-100 text-blue-700', 'bg-yellow-100 text-yellow-700', 'bg-teal-100 text-teal-700', 'bg-green-100 text-green-700'];
          const colorIdx = Math.min(level, 4);
          return (
            <Card key={i.word.word} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{i.word.word}</span>
                  <span className="text-xs text-gray-400 ml-2">_{i.word.pos}_</span>
                  <span className="text-sm text-gray-500 ml-2">{i.word.meaning}</span>
                  <span className="text-xs text-gray-400 ml-2">Day {i.day}</span>
                </div>
                <span className={`text-sm px-2 py-0.5 rounded-full ${levelColors[colorIdx]}`}>
                  {level >= 1 ? `${levelLabels[colorIdx]} Lv.${level}` : '○'}
                </span>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-gray-400 py-8">没有匹配结果</p>}
      </div>

      {hasMore && (
        <button onClick={() => setPage(p => p + 1)} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm">
          加载更多（已显示 {paged.length}/{filtered.length}）
        </button>
      )}
    </div>
  );
}
