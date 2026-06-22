import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Loading } from '../components/Loading';
import { useApp } from '../contexts/AppContext';
import { getAllWords, ScheduleWord, searchWords } from '../services/utils/vocabLoader';

type FilterType = 'all' | 'mastered' | 'fuzzy' | 'unmarked';

export function Vocabulary() {
  const navigate = useNavigate();
  const { vocabIndex, state } = useApp();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const allWords = useMemo(() => {
    if (!vocabIndex) return [];
    return getAllWords(vocabIndex);
  }, [vocabIndex]);

  const filteredWords = useMemo(() => {
    let words = allWords;
    if (query.trim()) {
      words = searchWords(query, vocabIndex!);
    }

    switch (filter) {
      case 'mastered':
        return words.filter((w) => state.states[`${w.theme}|${w.word}`] === 'mastered');
      case 'fuzzy':
        return words.filter((w) => state.states[`${w.theme}|${w.word}`] === 'fuzzy');
      case 'unmarked':
        return words.filter((w) => !state.states[`${w.theme}|${w.word}`]);
      default:
        return words;
    }
  }, [allWords, query, filter, state.states, vocabIndex]);

  const getWordStatus = (word: ScheduleWord): string => {
    const key = `${word.theme}|${word.word}`;
    const s = state.states[key];
    if (s === 'mastered') return '掌握';
    if (s === 'fuzzy') return '模糊';
    return '未标记';
  };

  if (!vocabIndex) return <Loading />;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-800">生词本</h1>

      {/* 搜索栏 */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索单词..."
        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />

      {/* 分类标签 */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'all' as FilterType, label: `全部 (${allWords.length})` },
          { id: 'mastered' as FilterType, label: '掌握' },
          { id: 'fuzzy' as FilterType, label: '模糊' },
          { id: 'unmarked' as FilterType, label: '未标记' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
              filter === f.id
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 单词列表 */}
      <div className="space-y-2">
        {filteredWords.slice(0, 100).map((w) => {
          const key = `${w.theme}|${w.word}`;
          return (
            <Card key={key} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-800">{w.word}</span>
                  <span className="text-gray-500 text-sm ml-2">{w.cn}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    state.states[key] === 'mastered'
                      ? 'bg-green-100 text-green-700'
                      : state.states[key] === 'fuzzy'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {getWordStatus(w)}
                </span>
              </div>
              {w.theme && (
                <p className="text-xs text-gray-400 mt-1">{w.theme}</p>
              )}
            </Card>
          );
        })}
        {filteredWords.length === 0 && (
          <p className="text-center text-gray-400 py-8">没有找到匹配的单词</p>
        )}
      </div>
    </div>
  );
}
